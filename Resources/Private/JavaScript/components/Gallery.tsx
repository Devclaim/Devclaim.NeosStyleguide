import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { galleryUrl } from '../api';
import { useData } from '../context';
import type { EntrySummary } from '../protocol';
import { navigate } from '../route';
import { LoadingBar, usePreviewFrame } from './usePreviewFrame';
import { useWidth } from './useWidth';

/** the height of a label over an entry, in px of the interface */
const LABEL = 36;

/** room for the labels in the page, in its own px (the page is scaled) */
function reserveLabels(document: Document, scale: number) {
	let style = document.head.querySelector<HTMLStyleElement>('style[data-styleguide-gallery]');
	if (!style) {
		style = document.createElement('style');
		style.dataset.styleguideGallery = '';
		document.head.prepend(style);
	}
	style.textContent = `[data-styleguide-entry]{margin-top:${Math.ceil(LABEL / scale)}px}`;
}

/**
 * Many entries in one preview (the adapter's gallery page): the page is rendered at the width of the viewport and
 * scaled into the room there is. The labels are the interface's: room for them is reserved in the page (a style in its
 * head), they lie over it at the measured places of the entries; a click opens the entry.
 */
export function Gallery({ entries, width }: { entries: EntrySummary[]; width: number }) {
	const { manifest, site, previewDraft } = useData();
	const container = useRef<HTMLDivElement>(null);
	const room = useWidth(container);
	const scale = room > 0 ? Math.min(1, room / width) : 1;
	const [places, setPlaces] = useState<{ id: string; top: number }[]>([]);
	const src = galleryUrl(
		manifest,
		entries.map((entry) => entry.id),
		site.key
	);
	const preview = usePreviewFrame(src, null, previewDraft, (document) => reserveLabels(document, scale));

	useEffect(() => {
		if (preview.document) {
			reserveLabels(preview.document, scale);
		}
	}, [preview.document, scale]);

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

	if (!src) {
		return null;
	}
	const titles = new Map(entries.map((entry) => [entry.id, entry]));
	const height = preview.height || 600;

	return (
		<div ref={container} className="sg-gallery">
			<div className="sg-gallery__stage" style={{ width: width * scale, height: height * scale }}>
				{!preview.document && <p className="sg-muted sg-gallery__loading">Vorschau wird geladen …</p>}
				<LoadingBar active={preview.loading} />
				{preview.render({
					title: 'Elemente',
					className: 'sg-gallery__frame',
					style: { width, height, transform: `scale(${scale})` }
				})}
				{places.map((place, index) => {
					const entry = titles.get(place.id);
					return entry ? (
						<button
							key={place.id}
							type="button"
							className={index === 0 ? 'sg-gallery__label sg-gallery__label--first' : 'sg-gallery__label'}
							style={{ top: place.top * scale - LABEL, height: LABEL }}
							onClick={() => navigate({ screen: 'element', id: place.id })}
						>
							<span className="sg-gallery__title">{entry.title}</span>
							<span className="sg-gallery__open">Öffnen</span>
						</button>
					) : null;
				})}
			</div>
		</div>
	);
}
