import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { galleryUrl } from '../api';
import { useData } from '../context';
import { showColorScheme } from '../frames';
import { INSET } from '../preview';
import type { EntrySummary } from '../protocol';
import { navigate } from '../route';
import type { ColorScheme } from './ColorSchemes';
import { useStageStyle } from './stageHeight';
import { LoadingBar, PreviewPlaceholder, usePreviewFrame } from './usePreviewFrame';
import { useWidth } from './useWidth';

/** the height of a label over an entry, in px of the interface */
const LABEL = 36;

/** the stage before its page, in px of the interface: taller than the screen, the page will be too */
const EMPTY_HEIGHT = 1400;

/** room for the labels in the page, in its own px (the page is scaled), and every entry clipped to itself */
function reserveLabels(document: Document, scale: number) {
	let style = document.head.querySelector<HTMLStyleElement>('style[data-styleguide-gallery]');
	if (!style) {
		style = document.createElement('style');
		style.dataset.styleguideGallery = '';
		document.head.prepend(style);
	}
	// each entry stands alone: what sticks out of it (a skip link waiting above a header, a flyout) does not lie over
	// its neighbours; a little room for shadows
	style.textContent =
		`[data-styleguide-entry]{margin-top:${Math.ceil(LABEL / scale)}px;` +
		'overflow:clip;overflow-clip-margin:8px}';
}

/**
 * Many entries in one preview (the adapter's gallery page): the page is rendered at the width of the viewport and
 * scaled into the room there is. The labels are the interface's: room for them is reserved in the page (a style in its
 * head), they lie over it at the measured places of the entries; a click opens the entry.
 */
export function Gallery({
	entries,
	width,
	scheme
}: {
	entries: EntrySummary[];
	width: number;
	/** the color scheme of the page; null: the adapter cannot show one */
	scheme: ColorScheme | null;
}) {
	const { manifest, site, previewDraft } = useData();
	const container = useRef<HTMLDivElement>(null);
	const room = useWidth(container);
	const scale = room > 0 ? Math.min(1, Math.max(1, room - 2 * INSET) / width) : 1;
	const [places, setPlaces] = useState<{ id: string; top: number }[]>([]);
	const src = galleryUrl(
		manifest,
		entries.map((entry) => entry.id),
		site.key
	);
	const preview = usePreviewFrame(src, width, previewDraft, (document) => {
		reserveLabels(document, scale);
		if (scheme) {
			showColorScheme(document, scheme);
		}
	});

	useEffect(() => {
		if (preview.document) {
			reserveLabels(preview.document, scale);
		}
	}, [preview.document, scale]);

	useEffect(() => {
		if (preview.document && scheme) {
			showColorScheme(preview.document, scheme);
		}
	}, [preview.document, scheme]);

	// where the entries are: again whenever the page changes its height
	useEffect(() => {
		const document = preview.document;
		if (!document) {
			setPlaces([]);
			return;
		}
		setPlaces(
			Array.from(document.querySelectorAll<HTMLElement>('[data-styleguide-entry]')).map((element) => ({
				id: element.dataset.styleguideEntry ?? '',
				top: element.getBoundingClientRect().top + (document.defaultView?.scrollY ?? 0)
			}))
		);
	}, [preview.document, preview.height, scale]);

	const height = preview.height || 600;
	const stageStyle = useStageStyle(
		preview.height ? height * scale + INSET : EMPTY_HEIGHT,
		width * scale + 2 * INSET,
		room > 0
	);

	if (!src) {
		return null;
	}
	const titles = new Map(entries.map((entry) => [entry.id, entry]));

	return (
		<div ref={container} className="sg-gallery">
			<div className="sg-gallery__stage dc-preview-window" style={{ ...stageStyle, background: preview.background ?? undefined }}>
				<LoadingBar active={preview.loading && preview.ready} />
				{/* the labels lie at the top of the page: room only at the sides and below */}
				<div className="sg-stage__sheet" style={{ inset: `0 ${INSET}px ${INSET}px` }}>
					{preview.render({
						title: 'Elemente',
						className: 'sg-gallery__frame',
						style: { width, height, transform: `scale(${scale})` }
					})}
				</div>
				{places.map((place, index) => {
					const entry = titles.get(place.id);
					return entry ? (
						<div
							key={place.id}
							className={index === 0 ? 'sg-gallery__label sg-gallery__label--first' : 'sg-gallery__label'}
							style={{ top: place.top * scale - LABEL, height: LABEL }}
						>
							<span className="sg-gallery__title">{entry.title}</span>
							<button
								type="button"
								className="sg-icon-button sg-icon-button--boxed sg-gallery__open"
								aria-label={`${entry.title} öffnen`}
								title="Öffnen"
								onClick={() => navigate({ screen: 'element', id: place.id })}
							>
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
									<path d="M5 12h14M13 6l6 6-6 6" />
								</svg>
							</button>
						</div>
					) : null;
				})}
				<PreviewPlaceholder active={!preview.ready} />
			</div>
		</div>
	);
}
