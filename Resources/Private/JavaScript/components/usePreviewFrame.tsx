import * as React from 'react';
import { type CSSProperties, useEffect, useRef, useState } from 'react';
import type { PreviewDraft } from '../context';
import {
	applyDraft,
	applyFontCss,
	contentHeight,
	frameDocument,
	keepInPlace,
	pageBackground,
	settled,
	watchHeight
} from '../frames';
import { FADE_MS, PLACEHOLDER, PLACEHOLDER_LEAVING, SHEET } from '../preview';

/** the next page while it loads: in place of the shown one, invisible */
const LOADING: CSSProperties = { position: 'absolute', top: 0, left: 0, visibility: 'hidden', pointerEvents: 'none' };

/** the page that was shown, over the new one while it fades out (App.css .sg-frame--leaving) */
const LEAVING: CSSProperties = { position: 'absolute', top: 0, left: 0, zIndex: 1, pointerEvents: 'none' };

type Shown<L> = { src: string; document: Document | null; layout: L };

/** one state: a new page, the one it replaces and its height change in the same render, also after waiting for it */
type Frames<L> = { shown: Shown<L> | null; leaving: string | null; height: number };

// outside of React: the height of every page seen, by URL and layout. A screen opened again has the right size at once
const heights = new Map<string, number>();
const heightKey = (src: string, layout: unknown) => `${JSON.stringify(layout)} ${src}`;

/**
 * A preview of the adapter in an iframe that never shows an empty or half ready page: a new URL loads in a second,
 * hidden iframe, gets the draft tokens, what `prepare` does, its fonts and its height, and only then takes the place of
 * the shown one, which fades out over it. Until then the old preview stays, with the layout it was loaded with
 * (`shownLayout`), so the room around it does not change before the new page is there; before the first page there is
 * the PreviewPlaceholder, as high as this page was the last time.
 *
 * The iframes keep their place in the DOM (moving an iframe reloads it): the order is the order they were asked for.
 */
export function usePreviewFrame<L>(
	src: string | null,
	layout: L,
	draft: PreviewDraft,
	prepare?: (document: Document) => void
) {
	const [{ shown, leaving, height }, setFrames] = useState<Frames<L>>({ shown: null, leaving: null, height: 0 });
	const [background, setBackground] = useState<string | null>(null);
	const latest = useRef({ draft, prepare, layout });
	latest.current = { draft, prepare, layout };
	const order = useRef(new Map<string, number>());
	const document = shown?.document ?? null;

	useEffect(() => {
		if (document) {
			applyDraft(document, draft.tokens);
			applyFontCss(document, draft.fontCss);
		}
	}, [document, draft]);

	useEffect(() => {
		if (!document || !shown) {
			return;
		}
		return watchHeight(document, (next) => {
			heights.set(heightKey(shown.src, latest.current.layout), next);
			setFrames((current) => (current.height === next ? current : { ...current, height: next }));
		});
	}, [document]);

	// the color of the page, for the sheet around it: tokens and the color scheme change it
	useEffect(() => {
		const view = document?.defaultView;
		if (!document || !view) {
			setBackground(null);
			return;
		}
		const read = () => setBackground(pageBackground(document));
		read();
		const observer = new view.MutationObserver(read);
		observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-color-scheme'] });
		return () => observer.disconnect();
	}, [document, draft]);

	useEffect(() => {
		if (!leaving) {
			return;
		}
		const timer = window.setTimeout(() => setFrames((current) => ({ ...current, leaving: null })), FADE_MS);
		return () => window.clearTimeout(timer);
	}, [leaving]);

	const onLoad = (loaded: string, frame: HTMLIFrameElement) => {
		const next = frameDocument(frame);
		const show = () =>
			setFrames((current) => ({
				shown: { src: loaded, document: next, layout: latest.current.layout },
				leaving: current.shown && current.shown.src !== loaded ? current.shown.src : null,
				height: next ? contentHeight(next) : current.height
			}));
		if (!next) {
			show();
			return;
		}
		// ready before it is seen: no navigation, the draft, what the screen needs, the fonts, the height
		keepInPlace(next);
		applyDraft(next, latest.current.draft.tokens);
		applyFontCss(next, latest.current.draft.fontCss);
		latest.current.prepare?.(next);
		settled(next).then(() => {
			// not if another page was asked for meanwhile or the screen is gone: the iframe has left the DOM
			if (frame.contentDocument === next) {
				show();
			}
		});
	};

	const sources = [leaving, shown?.src, src].filter(
		(value, index, all): value is string => !!value && all.indexOf(value) === index
	);
	for (const value of sources) {
		if (!order.current.has(value)) {
			order.current.set(value, order.current.size);
		}
	}
	for (const value of [...order.current.keys()]) {
		if (!sources.includes(value)) {
			order.current.delete(value);
		}
	}
	sources.sort((a, b) => (order.current.get(a) ?? 0) - (order.current.get(b) ?? 0));

	/**
	 * The iframes: the shown one, the one fading out, the next one while it loads. style: of the shown (and leaving)
	 * page; pendingStyle: of the next one (its layout, e.g. another width), the shown style if missing
	 */
	const render = (props: { title: string; className: string; style: CSSProperties; pendingStyle?: CSSProperties }) =>
		sources.map((frameSrc) => {
			const role = frameSrc === shown?.src ? 'shown' : frameSrc === leaving ? 'leaving' : 'pending';
			const style =
				role === 'shown'
					? props.style
					: role === 'leaving'
						? { ...props.style, ...LEAVING }
						: { ...(props.pendingStyle ?? props.style), ...LOADING };
			return (
				<iframe
					key={frameSrc}
					src={frameSrc}
					title={props.title}
					className={role === 'leaving' ? `${props.className} sg-frame--leaving` : props.className}
					style={style}
					aria-hidden={role === 'shown' ? undefined : true}
					tabIndex={role === 'shown' ? undefined : -1}
					onLoad={(event) => onLoad(frameSrc, event.currentTarget)}
				/>
			);
		});

	return {
		document,
		/** the height of the shown page; before the first one what it had the last time, 0 if it was never seen */
		height: shown || src === null ? height : (heights.get(heightKey(src, layout)) ?? 0),
		/** the color of the window around the shown page; null before the first one */
		background: shown ? (background ?? SHEET) : null,
		/** a page is shown */
		ready: shown !== null,
		/** a new page is on its way (not shown yet) */
		loading: src !== null && src !== shown?.src,
		/** the layout the shown page was loaded with; null before the first page */
		shownLayout: shown?.layout ?? null,
		render
	};
}

/** a thin bar over the preview while the next page loads, only if that takes a moment (App.css .sg-loading) */
export function LoadingBar({ active }: { active: boolean }) {
	return active ? <div className="sg-loading" role="progressbar" aria-label="Vorschau wird geladen" /> : null;
}

/**
 * In the place of the first page of a stage: the logo of the Neos splash (preview.css) instead of an empty sheet; it fades
 * out over the real page
 */
export function PreviewPlaceholder({ active }: { active: boolean }) {
	const [present, setPresent] = useState(active);
	useEffect(() => {
		if (active) {
			setPresent(true);
			return;
		}
		const timer = window.setTimeout(() => setPresent(false), FADE_MS);
		return () => window.clearTimeout(timer);
	}, [active]);

	if (!active && !present) {
		return null;
	}
	return (
		<div
			className={active ? PLACEHOLDER : PLACEHOLDER_LEAVING}
			role="progressbar"
			aria-label="Vorschau wird geladen"
		/>
	);
}
