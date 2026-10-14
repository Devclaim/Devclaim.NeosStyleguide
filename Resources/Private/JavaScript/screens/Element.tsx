import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { previewUrl } from '../api';
import { isChanged } from '../components/Rail';
import { LoadingBar, usePreviewFrame } from '../components/usePreviewFrame';
import { useSize } from '../components/useWidth';
import { type Size, viewportSizes, Viewports } from '../components/Viewports';
import { useData } from '../context';
import { showGrid, usedTokens } from '../frames';
import type { Editor, EntryDetails } from '../protocol';
import { resolveToken, shortName } from '../tokens';

// outside of React: the choices stay while the view is open
let lastSize: Size = 'desktop';
let lastGrid = false;

/** a pause in typing a prop, then the preview loads with it */
const PROPS_DELAY = 250;

type Variant = { type: 'useCase' | 'propSet'; id: string } | null;

/** the editor of one prop, by the editor type of the adapter (PROTOCOL.md entries/{id}) */
function Field({ name, editor, value, onChange }: { name: string; editor: Editor; value: unknown; onChange: (value: unknown) => void }) {
	const id = `sg-prop-${name}`;
	let field: React.ReactNode;
	switch (editor.type) {
		case 'checkbox':
			field = <input id={id} type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />;
			break;
		case 'number':
			field = (
				<input id={id} type="number" className="sg-input" value={Number(value ?? 0)} onChange={(event) => onChange(Number(event.target.value))} />
			);
			break;
		case 'select':
			field = (
				<select id={id} className="sg-input" value={String(value ?? '')} onChange={(event) => onChange(event.target.value)}>
					{editor.options.map((option) => (
						<option key={option.value} value={option.value}>
							{option.label}
						</option>
					))}
				</select>
			);
			break;
		case 'textarea':
			field = <textarea id={id} className="sg-input" rows={3} value={String(value ?? '')} onChange={(event) => onChange(event.target.value)} />;
			break;
		default:
			field = <input id={id} type="text" className="sg-input" value={String(value ?? '')} onChange={(event) => onChange(event.target.value)} />;
	}
	return (
		<div className="sg-prop">
			<label htmlFor={id}>{name}</label>
			{field}
		</div>
	);
}

/**
 * one element: use cases, the preview at a viewport width (with the page grid), its props and the tokens it uses. A
 * whole page (entry.page) fills the room instead and scrolls inside its frame, like in a browser window: a frame as
 * high as the page would make every vh and sticky element of it wrong
 */
export function Element({ id }: { id: string }) {
	const data = useData();
	const { manifest, entries, site, tokensByName, previewDraft } = data;
	const entry = entries.find((candidate) => candidate.id === id);
	const [details, setDetails] = useState<EntryDetails | null>(null);
	const [variant, setVariant] = useState<Variant>(null);
	const [changed, setChanged] = useState<Record<string, unknown>>({});
	const [props, setProps] = useState<Record<string, unknown>>({});
	const [size, setSize] = useState<Size>(lastSize);
	const [grid, setGrid] = useState(lastGrid);
	const [used, setUsed] = useState<string[]>([]);
	const [shownId, setShownId] = useState(id);
	if (shownId !== id) {
		// another element: its own state at once, before anything renders (else the first preview URL of the new
		// element would carry the use case and props of the last one, and load for nothing)
		setShownId(id);
		setDetails(null);
		setVariant(null);
		setChanged({});
		setProps({});
		setUsed([]);
	}
	const stage = useRef<HTMLDivElement>(null);
	const room = useSize(stage);
	const targetWidth = viewportSizes(manifest.viewports)[size]?.width ?? 1280;
	const target = { page: entry?.page === true, width: targetWidth };
	const extra: Record<string, string> = {};
	if (variant) {
		extra[variant.type] = variant.id;
	}
	if (Object.keys(props).length > 0) {
		extra.props = JSON.stringify(props);
	}
	const src = entry ? previewUrl(manifest, entry.id, site.key, extra) : null;
	const preview = usePreviewFrame(src, target, previewDraft, (document) => showGrid(document, grid));
	// while the next page loads, the room keeps the layout of the shown one (no stretched old preview)
	const { page, width } = preview.loading ? (preview.shownLayout ?? target) : target;
	const scaleOf = (frameWidth: number) => (room.width > 0 ? Math.min(1, room.width / frameWidth) : 1);
	const scale = scaleOf(width);
	// a page: as high as the room (in pixels of the page, before scaling); else as high as what it shows
	const heightOf = (isPage: boolean, frameScale: number) =>
		isPage ? Math.max(1, Math.floor(room.height / frameScale)) : preview.height || 240;
	const height = heightOf(page, scale);

	useEffect(() => {
		data.api
			.entry(id)
			.then(setDetails)
			.catch(() => setDetails(null));
	}, [data.api, id]);

	// the props of the inspector reach the preview after a pause in typing (a new page each time)
	useEffect(() => {
		const timer = window.setTimeout(() => setProps(changed), PROPS_DELAY);
		return () => window.clearTimeout(timer);
	}, [changed]);

	useEffect(() => {
		if (preview.document) {
			showGrid(preview.document, grid);
		}
	}, [preview.document, grid]);

	// the tokens the element uses, once the preview is rendered
	useEffect(() => {
		const document = preview.document;
		const view = document?.defaultView;
		if (!document || !view || target.page) {
			setUsed([]);
			return;
		}
		const timer = view.setTimeout(() => setUsed(usedTokens(document).filter((name) => tokensByName.has(name))), 300);
		return () => view.clearTimeout(timer);
	}, [preview.document, tokensByName, target.page]);

	if (!entry) {
		return <div className="sg-message">Dieses Element gibt es nicht.</div>;
	}

	const variants = details
		? [
				...details.useCases.map((useCase) => ({ type: 'useCase' as const, id: useCase.id, title: useCase.title, props: useCase.props })),
				...details.propSets.map((propSet) => ({ type: 'propSet' as const, id: propSet.id, title: propSet.title, props: propSet.props }))
			]
		: [];
	const chosen = variants.find((candidate) => candidate.type === variant?.type && candidate.id === variant.id);
	const values = (name: string, value: unknown) => (name in changed ? changed[name] : chosen && name in chosen.props ? chosen.props[name] : value);
	const level = manifest.levels.find((candidate) => candidate.id === entry.level)?.label ?? entry.level;

	return (
		<>
			<header className="sg-header">
				<h1>{entry.title}</h1>
				<span className="sg-header__meta">{level}</span>
				<span className="sg-header__spacer" />
				{manifest.features.grid && (
					<button
						type="button"
						className="sg-icon-button sg-icon-button--boxed"
						aria-pressed={grid}
						aria-label="Raster zeigen"
						title="Raster zeigen"
						onClick={() => {
							lastGrid = !grid;
							setGrid(!grid);
						}}
					>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
							<path d="M5 3v18M10 3v18M15 3v18M20 3v18" />
						</svg>
					</button>
				)}
				<Viewports
					viewports={manifest.viewports}
					sizes={['mobile', 'tablet', 'desktop']}
					value={size}
					onChange={(next) => {
						lastSize = next;
						setSize(next);
					}}
				/>
			</header>
			<div className={page ? 'sg-content sg-content--page' : 'sg-content'}>
				{variants.length > 0 && (
					<div className="sg-pills" role="group" aria-label="Anwendungsfall">
						<button
							type="button"
							aria-pressed={!variant}
							onClick={() => {
								setVariant(null);
								setChanged({});
							}}
						>
							Standard
						</button>
						{variants.map((candidate) => (
							<button
								key={`${candidate.type}-${candidate.id}`}
								type="button"
								aria-pressed={chosen === candidate}
								onClick={() => {
									setVariant({ type: candidate.type, id: candidate.id });
									setChanged({});
								}}
							>
								{candidate.title}
							</button>
						))}
					</div>
				)}

				<div ref={stage} className={page ? 'sg-preview sg-preview--page' : 'sg-preview'}>
					<div className="sg-preview__stage" style={{ width: width * scale, height: height * scale }}>
						<LoadingBar active={preview.loading} />
						{preview.render({
							title: entry.title,
							className: 'sg-preview__frame',
							style: { width, height, transform: `scale(${scale})` },
							pendingStyle: {
								width: target.width,
								height: heightOf(target.page, scaleOf(target.width)),
								transform: `scale(${scaleOf(target.width)})`
							}
						})}
					</div>
				</div>

				{!target.page && (
					<div className="sg-columns">
						<section>
							<h2 className="sg-panel-title">Eigenschaften</h2>
							{!details ? (
								<p className="sg-muted">…</p>
							) : details.props.length === 0 ? (
								<p className="sg-muted">Keine Eigenschaften zum Ändern.</p>
							) : (
								<div className="sg-props">
									{details.props.map((prop) => (
										<Field
											key={prop.name}
											name={prop.name}
											editor={prop.editor}
											value={values(prop.name, prop.value)}
											onChange={(value) => setChanged((current) => ({ ...current, [prop.name]: value }))}
										/>
									))}
								</div>
							)}
						</section>
						<section>
							<h2 className="sg-panel-title">Verwendete Tokens</h2>
							{used.length === 0 ? (
								<p className="sg-muted">…</p>
							) : (
								<div className="sg-chips">
									{used.map((name) => {
										const token = tokensByName.get(name);
										return (
											<button
												key={name}
												type="button"
												className="sg-chip"
												aria-pressed={data.selectedToken === name}
												onClick={() => data.selectToken(name)}
											>
												{token?.type === 'color' && (
													<span className="sg-swatch sg-swatch--tiny" style={{ background: resolveToken(name, tokensByName, data.draft) }} />
												)}
												{shortName(name)}
												{isChanged(data, name) && <span className="sg-dot" aria-label="geändert" />}
											</button>
										);
									})}
								</div>
							)}
						</section>
					</div>
				)}
			</div>
		</>
	);
}
