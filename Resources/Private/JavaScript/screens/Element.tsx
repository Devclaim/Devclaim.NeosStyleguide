import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { previewUrl } from '../api';
import { ColorSchemes, useColorScheme } from '../components/ColorSchemes';
import { StateDot, tokenState } from '../components/Rail';
import { useStageStyle } from '../components/stageHeight';
import { LoadingBar, usePreviewFrame } from '../components/usePreviewFrame';
import { useSize } from '../components/useWidth';
import { type Size, viewportSizes, Viewports } from '../components/Viewports';
import { useData } from '../context';
import { showColorScheme, showGrid, usedTokens } from '../frames';
import type { Editor, EntryDetails } from '../protocol';
import { hasLayers, resolveToken, shortName, valueName } from '../tokens';
import { shownToken } from '../usage';

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

/** a token the element uses as a chip; a click opens it in the design panel */
function TokenChip({ name, warning }: { name: string; warning?: boolean }) {
	const data = useData();
	const token = data.tokensByName.get(name);
	const shown = token?.variants?.[0]?.token ?? name;
	return (
		<button
			type="button"
			className={warning ? 'sg-chip sg-chip--warning' : 'sg-chip'}
			aria-pressed={data.selectedToken === name}
			onClick={() => data.selectToken(name)}
		>
			{token?.type === 'color' && (
				<span
					className="sg-swatch sg-swatch--tiny"
					style={{ background: resolveToken(shown, data.tokensByName, data.draft) }}
				/>
			)}
			{name.startsWith('--text-size-') ? valueName(name) : shortName(name)}
			<StateDot state={tokenState(data, name)} />
		</button>
	);
}

/**
 * The tokens an element uses: with layers the semantic tokens (a variant counts as its token) and, as a warning, the
 * design tokens it uses directly
 */
function UsedTokens({ used }: { used: string[] }) {
	const { tokens, tokensByName } = useData();
	if (!hasLayers(tokens)) {
		return (
			<div className="sg-chips">
				{used.map((name) => (
					<TokenChip key={name} name={name} />
				))}
			</div>
		);
	}
	// as the editor shows them: a variant as its token, the line height of a text style as its size (usage.ts)
	const shown = used.map((name) => shownToken(name, tokensByName)).filter((name) => name !== null);
	const semantic = [...new Set(shown.filter((name) => tokensByName.get(name)?.layer === 'semantic'))];
	const design = [...new Set(shown.filter((name) => tokensByName.get(name)?.layer === 'design'))];
	return (
		<>
			<div className="sg-chips">
				{semantic.map((name) => (
					<TokenChip key={name} name={name} />
				))}
			</div>
			{design.length > 0 && (
				<>
					<p className="sg-used__warning">Direkt aus den Design Tokens: sollten Semantic Tokens sein</p>
					<div className="sg-chips">
						{design.map((name) => (
							<TokenChip key={name} name={name} warning />
						))}
					</div>
				</>
			)}
		</>
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
	const [scheme, setScheme] = useColorScheme();
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
	const preview = usePreviewFrame(src, target, previewDraft, (document) => {
		showGrid(document, grid);
		if (manifest.features.colorScheme) {
			showColorScheme(document, scheme);
		}
	});
	// while the next page loads, the room keeps the layout of the shown one (no stretched old preview)
	const { page, width } = preview.loading ? (preview.shownLayout ?? target) : target;
	const scaleOf = (frameWidth: number) => (room.width > 0 ? Math.min(1, room.width / frameWidth) : 1);
	const scale = scaleOf(width);
	// a page: as high as the room (in pixels of the page, before scaling); else as high as what it shows
	const heightOf = (isPage: boolean, frameScale: number) =>
		isPage ? Math.max(1, Math.floor(room.height / frameScale)) : preview.height || 240;
	const height = heightOf(page, scale);
	const stageStyle = useStageStyle(!!preview.document, height * scale, 240 * scale, width * scale);

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

	useEffect(() => {
		if (preview.document && manifest.features.colorScheme) {
			showColorScheme(preview.document, scheme);
		}
	}, [preview.document, scheme, manifest.features.colorScheme]);

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
				{/* in the header, so the preview stays in place whether an element has use cases or not */}
				{variants.length > 0 && (
					<select
						className="sg-header-select"
						aria-label="Anwendungsfall"
						title="Anwendungsfall"
						value={chosen ? `${chosen.type}:${chosen.id}` : ''}
						onChange={(event) => {
							const next = variants.find((candidate) => `${candidate.type}:${candidate.id}` === event.target.value);
							setVariant(next ? { type: next.type, id: next.id } : null);
							setChanged({});
						}}
					>
						<option value="">Standard</option>
						{variants.map((candidate) => (
							<option key={`${candidate.type}-${candidate.id}`} value={`${candidate.type}:${candidate.id}`}>
								{candidate.title}
							</option>
						))}
					</select>
				)}
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
				{manifest.features.colorScheme && <ColorSchemes value={scheme} onChange={setScheme} />}
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
				<div ref={stage} className={page ? 'sg-preview sg-preview--page' : 'sg-preview'}>
					<div className="sg-preview__stage" style={stageStyle}>
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
								<UsedTokens used={used} />
							)}
						</section>
					</div>
				)}
			</div>
		</>
	);
}
