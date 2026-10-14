import * as React from 'react';
import { type CSSProperties, useEffect, useRef, useState } from 'react';
import type { PreviewDraft } from '../context';
import { applyDraft, applyFontCss, contentHeight, frameDocument, watchHeight } from '../frames';

/** the next page while it loads: in place of the shown one, invisible */
const LOADING: CSSProperties = { position: 'absolute', top: 0, left: 0, visibility: 'hidden', pointerEvents: 'none' };

/** the page that was shown, over the new one while it fades out (App.css .sg-frame--leaving) */
const LEAVING: CSSProperties = { position: 'absolute', top: 0, left: 0, zIndex: 1, pointerEvents: 'none' };

/** how long the old page fades out (App.css sg-fade-out) */
const FADE_MS = 180;

type Shown<L> = { src: string; document: Document | null; layout: L };

/**
 * A preview of the adapter in an iframe that never shows an empty or half ready page: a new URL loads in a second,
 * hidden iframe, gets the draft tokens, what `prepare` does and its height, and only then takes the place of the shown
 * one, which fades out over it. Until then the old preview stays, with the layout it was loaded with (`shownLayout`),
 * so the room around it does not change before the new page is there.
 *
 * The iframes keep their place in the DOM (moving an iframe reloads it): the order is the order they were asked for.
 */
export function usePreviewFrame<L>(
	src: string | null,
	layout: L,
	draft: PreviewDraft,
	prepare?: (document: Document) => void
) {
	const [shown, setShown] = useState<Shown<L> | null>(null);
	const [leaving, setLeaving] = useState<string | null>(null);
	const [height, setHeight] = useState(0);
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

	useEffect(() => (document ? watchHeight(document, setHeight) : undefined), [document]);

	useEffect(() => {
		if (!leaving) {
			return;
		}
		const timer = window.setTimeout(() => setLeaving(null), FADE_MS);
		return () => window.clearTimeout(timer);
	}, [leaving]);

	const onLoad = (loaded: string, frame: HTMLIFrameElement) => {
		const next = frameDocument(frame);
		if (next) {
			// ready before it is seen: the draft, what the screen needs, the height
			applyDraft(next, latest.current.draft.tokens);
			applyFontCss(next, latest.current.draft.fontCss);
			latest.current.prepare?.(next);
			setHeight(contentHeight(next));
		}
		setLeaving(shown && shown.src !== loaded ? shown.src : null);
		setShown({ src: loaded, document: next, layout: latest.current.layout });
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
		height,
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
