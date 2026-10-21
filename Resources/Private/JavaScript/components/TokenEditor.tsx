import * as React from 'react';
import { useState } from 'react';
import { useData } from '../context';
import type { Token } from '../protocol';
import { Sample } from '../screens/TokensOverview';
import {
	colorRows,
	describe,
	designOptions,
	editedToken,
	firstFamily,
	isScaleGroup,
	namespaceOf,
	resolveToken,
	scalesOf,
	shortName,
	shortValue,
	textStyleCounterparts,
	textStyleDetails,
	valueName,
	variantLabel,
	variantValue
} from '../tokens';
import { navigate } from '../route';
import { useTokenUsage } from '../usage';
import { isChanged, StateDot, valueState } from './Rail';

/**
 * Fonts of the systems, nothing is loaded: the stacks of the theme, and the ones of Modern Font Stacks
 * (https://modernfontstacks.com, CC0): a style with the most similar font every system (Windows, macOS, iOS, Android,
 * Linux) has installed, so it looks alike everywhere. Any other value can be typed
 */
const FONT_STACKS = [
	{ label: 'System Sans (Standard)', value: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" },
	{ label: 'System Serif (Standard)', value: "ui-serif, Georgia, Cambria, 'Times New Roman', serif" },
	{ label: 'Neo-Grotesk (Helvetica, Arial)', value: "Inter, Roboto, 'Helvetica Neue', 'Arial Nova', 'Nimbus Sans', Arial, sans-serif" },
	{ label: 'Humanistisch (Gill Sans, Calibri)', value: "Seravek, 'Gill Sans Nova', Ubuntu, Calibri, 'DejaVu Sans', source-sans-pro, sans-serif" },
	{ label: 'Geometrisch (Avenir, Corbel)', value: "Avenir, Montserrat, Corbel, 'URW Gothic', source-sans-pro, sans-serif" },
	{ label: 'Klassisch humanistisch (Optima, Candara)', value: "Optima, Candara, 'Noto Sans', source-sans-pro, sans-serif" },
	{ label: 'Industrie (DIN, Bahnschrift)', value: "Bahnschrift, 'DIN Alternate', 'Franklin Gothic Medium', 'Nimbus Sans Narrow', sans-serif-condensed, sans-serif" },
	{ label: 'Abgerundet (Arial Rounded)', value: "ui-rounded, 'Hiragino Maru Gothic ProN', Quicksand, Comfortaa, Manjari, 'Arial Rounded MT', 'Arial Rounded MT Bold', Calibri, source-sans-pro, sans-serif" },
	{ label: 'Übergangs-Antiqua (Charter, Cambria)', value: "Charter, 'Bitstream Charter', 'Sitka Text', Cambria, serif" },
	{ label: 'Renaissance-Antiqua (Palatino)', value: "'Iowan Old Style', 'Palatino Linotype', 'URW Palladio L', P052, serif" },
	{ label: 'Klassizistisch (Didot, Bodoni)', value: "Didot, 'Bodoni MT', 'Noto Serif Display', 'URW Palladio L', P052, Sylfaen, serif" },
	{ label: 'Antik (Bookman, Georgia)', value: "Superclarendon, 'Bookman Old Style', 'URW Bookman', 'URW Bookman L', 'Georgia Pro', Georgia, serif" },
	{ label: 'Serifenbetont (Rockwell)', value: "Rockwell, 'Rockwell Nova', 'Roboto Slab', 'DejaVu Serif', 'Sitka Small', serif" },
	{ label: 'Monospace Code (Menlo, Consolas)', value: "ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, 'DejaVu Sans Mono', monospace" },
	{ label: 'Monospace Schreibmaschine (Courier)', value: "'Nimbus Mono PS', 'Courier New', monospace" },
	{ label: 'Handschrift', value: "'Segoe Print', 'Bradley Hand', Chilanka, TSCu_Comic, casual, cursive" }
];

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** an uploaded font with the fonts of the system behind it that fit the token (while it loads, or if it is missing) */
function fontValue(family: string, token: Token) {
	const fallback = /monospace/.test(token.value)
		? 'ui-monospace, monospace'
		: /(^|[\s,])serif/.test(token.value.replace(/sans-serif/g, ''))
			? 'ui-serif, Georgia, serif'
			: 'ui-sans-serif, system-ui, sans-serif';
	return `'${family}', ${fallback}`;
}

/** the colors of the palette: the steps of the scales, plus black and white */
function usePalette(token: Token) {
	const data = useData();
	const groups = data.tokens.groups.filter((group) =>
		isScaleGroup(data.tokens.tokens.filter((candidate) => candidate.group === group.id))
	);
	const steps = data.tokens.tokens.filter((candidate) => groups.some((group) => group.id === candidate.group));
	return token.type === 'color' ? scalesOf(steps) : [];
}

/**
 * The editor of a semantic token (PROTOCOL.md, "Layers and variants"): a slot per variant, the design tokens it may
 * point at, and a value of its own. The editor changes the variants, the token itself only without variants
 */
function SemanticEditor({ token, variant, onBack }: { token: Token; variant?: string; onBack?: () => void }) {
	const data = useData();
	const variants = token.variants ?? [];
	const [armed, setArmed] = useState(variant ?? variants[0]?.id ?? null);
	const armedVariant = variants.find((candidate) => candidate.id === armed);
	const target = data.tokensByName.get(armedVariant?.token ?? token.name) ?? token;
	const value = data.draft[target.name] ?? target.value;
	const resolved = resolveToken(target.name, data.tokensByName, data.draft);
	// null for a value that is the default: no override
	const change = (name: string, next: string) => (next === data.tokensByName.get(name)?.value ? null : next);
	// an old value of the token itself (from before it had variants) wins over every variant: a change of a variant
	// removes it, so the change is seen at once
	const legacy = variants.length > 0 && data.draft[token.name] !== undefined ? { [token.name]: null } : {};
	const set = (next: string) => data.setTokens({ ...legacy, [target.name]: change(target.name, next) });
	const [ownValue, setOwnValue] = useState(false);
	// a text style is changed as one: with a size, the line height and paragraph spacing of the same style
	const details = textStyleDetails(target.name, data.tokensByName);
	const pick = (size: string) =>
		data.setTokens({
			...legacy,
			[target.name]: change(target.name, `var(${size})`),
			...Object.fromEntries(
				textStyleCounterparts(target.name, size, data.tokensByName).map(([detail, counterpart]) => [
					detail,
					change(detail, `var(${counterpart})`)
				])
			)
		});
	// only design tokens of its own namespace: a size points at sizes, not at line heights of the same group
	const options = designOptions(token, data.tokens).filter(
		(option) => namespaceOf(option.name) === namespaceOf(token.name)
	);
	const changedVariant = (name: string) =>
		data.draft[name] !== undefined && data.draft[name] !== data.tokensByName.get(name)?.value;
	// a width variant may take the value of the smaller width again
	const index = variants.findIndex((candidate) => candidate.id === armed);
	const smaller = armedVariant && index > 0 && !['light', 'dark'].includes(armedVariant.id) ? variants[index - 1] : null;
	const label = `${valueName(token.name)}${armedVariant ? ` ${variantLabel(armedVariant.id)}` : ''}`;
	const invalid = data.invalid[target.name];
	const description = describe(token, data.tokensByName);
	const usage = useTokenUsage(data.manifest, data.entries, data.site.key, data.tokensByName);
	const usedIn = (usage?.get(token.name) ?? [])
		.map((id) => data.entries.find((entry) => entry.id === id))
		.filter((entry) => entry !== undefined);

	return (
		<div className="sg-editor">
			{onBack && (
				<button type="button" className="sg-editor__back" onClick={onBack}>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
						<path d="M15 6l-6 6 6 6" />
					</svg>
					Alle Tokens
				</button>
			)}
			<div className="sg-editor__layer">Semantic Token</div>
			<div>
				<div className="sg-editor__name">{valueName(token.name)}</div>
				<div className="sg-editor__token">{token.name}</div>
			</div>
			{description && <p className="sg-muted sg-editor__hint">{description}</p>}

			{variants.length > 0 && (
				<div className="sg-slots" role="group" aria-label="Wert je Variante">
					{variants.map((candidate) => {
						const { value: slotValue, from } = variantValue(token, candidate.id, data.tokensByName, data.draft);
						return (
							<button
								key={candidate.id}
								type="button"
								className="sg-slot"
								aria-pressed={candidate.id === armed}
								onClick={() => setArmed(candidate.id)}
							>
								<span className="sg-slot__label">{variantLabel(candidate.id)}</span>
								<span
									className={from ? 'sg-slot__value sg-slot__value--inherited' : 'sg-slot__value'}
									title={from ? `wie ${variantLabel(from)}` : undefined}
								>
									{token.type === 'color' && (
										<span
											className="sg-swatch sg-swatch--tiny"
											style={{ background: resolveToken(candidate.token, data.tokensByName, data.draft) }}
										/>
									)}
									<span className="sg-slot__text">{shortValue(slotValue)}</span>
									<StateDot state={valueState(data, candidate.token)} />
								</span>
							</button>
						);
					})}
				</div>
			)}

			{details.length > 0 && (
				<p className="sg-muted sg-editor__hint">
					{details
						.map(
							(detail) =>
								`${detail.startsWith('--leading-') ? 'Zeilenhöhe' : 'Absatzabstand'} ${shortValue(
									data.draft[detail] ?? data.tokensByName.get(detail)?.value ?? ''
								)}`
						)
						.join(' · ')}
				</p>
			)}

			{options.length > 0 && (
				<div>
					<div className="sg-editor__label">Design Token{armedVariant ? ` für ${variantLabel(armedVariant.id)}` : ''}</div>
					{token.type === 'color' ? (
						<div className="sg-editor__palette" role="group" aria-label="Aus den Design Tokens">
							{colorRows(options).map(([scale, steps]) => (
								<div key={scale} className="sg-editor__palette-row">
									{steps.map((step) => (
										<button
											key={step.name}
											type="button"
											title={valueName(step.name)}
											aria-label={valueName(step.name)}
											aria-pressed={value === `var(${step.name})`}
											className="sg-editor__palette-step"
											style={{ background: resolveToken(step.name, data.tokensByName, data.draft) }}
											onClick={() => pick(step.name)}
										/>
									))}
								</div>
							))}
						</div>
					) : (
						<div className="sg-options" role="group" aria-label="Aus den Design Tokens">
							{smaller && (
								<button
									type="button"
									className="sg-option"
									aria-pressed={value === `var(${smaller.token})`}
									onClick={() => pick(smaller.token)}
								>
									<span className="sg-option__sample" />
									<span className="sg-option__name">wie {variantLabel(smaller.id)}</span>
								</button>
							)}
							{options.map((option) => {
								const optionValue = data.draft[option.name] ?? option.value;
								return (
									<button
										key={option.name}
										type="button"
										className="sg-option"
										aria-pressed={value === `var(${option.name})`}
										onClick={() => pick(option.name)}
									>
										<span className="sg-option__sample">
											<Sample token={option} resolved={resolveToken(option.name, data.tokensByName, data.draft)} max={22} />
										</span>
										<span className="sg-option__name">{valueName(option.name)}</span>
										<span className="sg-option__value">{shortValue(optionValue)}</span>
									</button>
								);
							})}
						</div>
					)}
				</div>
			)}

			{/* a value outside the design tokens (e.g. a brand color of its own): rarely needed, so behind a link */}
			{ownValue || !/^var\(--[\w-]+\)$/.test(value) ? (
				<div>
					<div className="sg-editor__label">Eigener Wert, außerhalb der Design Tokens</div>
					<div className="sg-editor__value">
						{token.type === 'color' && (
							<input
								type="color"
								aria-label={`${label}: Farbe wählen`}
								className="sg-editor__color"
								value={HEX.test(resolved) ? resolved : '#000000'}
								onChange={(event) => set(event.target.value)}
							/>
						)}
						<input
							type="text"
							aria-label={`${label}: Wert`}
							className="sg-input sg-input--mono"
							value={value}
							onChange={(event) => set(event.target.value)}
						/>
					</div>
				</div>
			) : (
				<button type="button" className="sg-link sg-editor__own" onClick={() => setOwnValue(true)}>
					Eigenen Wert eingeben …
				</button>
			)}

			{invalid && <p className="sg-editor__error">Nicht übernommen: {invalid}</p>}

			{variants.length > 0 && changedVariant(token.name) && (
				<div className="sg-editor__notice">
					<span>
						Ein alter Wert gilt noch für alle Varianten: <code>{shortValue(data.draft[token.name] ?? '')}</code>. Er
						fällt weg, sobald du oben einen Wert wählst.
					</span>
					<button type="button" className="sg-button" onClick={() => data.setToken(token.name, null)}>
						Jetzt entfernen
					</button>
				</div>
			)}

			<div>
				<div className="sg-editor__label">Verwendet in</div>
				{usage === null ? (
					<p className="sg-muted sg-editor__hint">…</p>
				) : usedIn.length === 0 ? (
					<p className="sg-muted sg-editor__hint">In keinem Element der Galerie. Wird der Token gebraucht?</p>
				) : (
					<div className="sg-chips">
						{usedIn.map((entry) => (
							<button
								key={entry.id}
								type="button"
								className="sg-chip"
								onClick={() => navigate({ screen: 'element', id: entry.id })}
							>
								{entry.title}
							</button>
						))}
					</div>
				)}
			</div>

			<ValueHistory name={target.name} />
			{variants.length > 0 && isChanged(data, token.name) && (
				<button
					type="button"
					className="sg-link sg-editor__reset-all"
					onClick={() =>
						data.setTokens(
							Object.fromEntries(
								[token.name, ...variants.map((candidate) => candidate.token)].map((name) => [name, null])
							)
						)
					}
				>
					Alle Varianten auf Standard
				</button>
			)}
		</div>
	);
}

/**
 * The ways back in the foot of the editor, small links: to the default (the site's own value goes), discarding the
 * unpublished change (back to what is live; when live is the default, resetting is the same), the unsaved change
 */
function ValueHistory({ name }: { name: string }) {
	const data = useData();
	const token = data.tokensByName.get(name);
	if (!token) {
		return null;
	}
	const current = data.draft[name] ?? token.value;
	const live = data.live ? (data.live[name] ?? token.value) : null;
	const unpublished = live !== null && live !== current;
	const unsaved = data.unsaved.includes(name);
	if (current === token.value && !unpublished && !unsaved) {
		return null;
	}
	return (
		<div className="sg-history">
			{current !== token.value && (
				<button
					type="button"
					className="sg-link"
					title={`Standard: ${shortValue(token.value)}`}
					onClick={() => data.setToken(name, null)}
				>
					Zurücksetzen auf Standard
				</button>
			)}
			{unpublished && live !== token.value && (
				<button
					type="button"
					className="sg-link"
					title={`Zurück auf den veröffentlichten Wert: ${shortValue(live)}`}
					onClick={() => data.setToken(name, data.live?.[name] ?? null)}
				>
					Verwerfen
				</button>
			)}
			{unsaved && (
				<button type="button" className="sg-link" onClick={() => data.discard(name)}>
					Rückgängig
				</button>
			)}
		</div>
	);
}

/** the editor of one token, by its type (protocol: Token.type), in the inspector */
export function TokenEditor({ token, variant, onBack }: { token: Token; variant?: string; onBack?: () => void }) {
	if (token.layer === 'semantic') {
		return <SemanticEditor key={token.name} token={token} variant={variant} onBack={onBack} />;
	}
	return <DesignEditor token={token} onBack={onBack} />;
}

/** the editor of a design token (or of any token of an adapter without layers), by its type */
function DesignEditor({ token, onBack }: { token: Token; onBack?: () => void }) {
	const data = useData();
	const value = data.draft[token.name] ?? token.value;
	const resolved = resolveToken(token.name, data.tokensByName, data.draft);
	const invalid = data.invalid[token.name];
	// a design token is a value of its own (a hex color); only without layers a token may point at the palette
	const palette = usePalette(token).filter(() => token.layer !== 'design');
	// the semantic tokens whose value (or the value of one of their variants) is this design token
	const pointedAtBy = [
		...new Set(
			data.tokens.tokens
				.filter(
					(other) => other.layer === 'semantic' && (data.draft[other.name] ?? other.value) === `var(${token.name})`
				)
				.map((other) => editedToken(other.name, data.tokensByName))
		)
	];
	// an uploaded font the value names (media module, collection "Schriften")
	const ownFamily = token.type === 'font' && data.fonts.families.includes(firstFamily(value)) ? firstFamily(value) : null;
	const set = (next: string) => data.setToken(token.name, next === token.value ? null : next);

	return (
		<div className="sg-editor">
			{onBack && (
				<button type="button" className="sg-editor__back" onClick={onBack}>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
						<path d="M15 6l-6 6 6 6" />
					</svg>
					Alle Tokens
				</button>
			)}
			<div className="sg-editor__name">
				{textStyleDetails(token.name, data.tokensByName).length > 0 ? valueName(token.name) : shortName(token.name)}
			</div>

			{!token.editable ? (
				<p className="sg-muted">{value} – steht beim Build fest und gilt für alle Sites.</p>
			) : (
				<>
					<div className="sg-editor__value">
						{token.type === 'color' && (
							<input
								type="color"
								aria-label={`${shortName(token.name)}: Farbe wählen`}
								className="sg-editor__color"
								value={HEX.test(resolved) ? resolved : '#000000'}
								onChange={(event) => set(event.target.value)}
							/>
						)}
						<input
							type="text"
							aria-label={`${shortName(token.name)}: Wert`}
							className="sg-input sg-input--mono"
							value={value}
							onChange={(event) => set(event.target.value)}
						/>
					</div>

					{/* a text style: the line height and paragraph spacing with its size */}
					{textStyleDetails(token.name, data.tokensByName).map((detail) => {
						const detailToken = data.tokensByName.get(detail);
						const label = detail.startsWith('--leading-') ? 'Zeilenhöhe' : 'Absatzabstand';
						return (
							<label key={detail} className="sg-editor__detail">
								<span className="sg-editor__label">{label}</span>
								<input
									type="text"
									aria-label={`${shortName(token.name)}: ${label}`}
									className="sg-input sg-input--mono"
									value={data.draft[detail] ?? detailToken?.value ?? ''}
									onChange={(event) =>
										data.setToken(detail, event.target.value === detailToken?.value ? null : event.target.value)
									}
								/>
							</label>
						);
					})}

					{palette.length > 0 && (
						<div className="sg-editor__palette" role="group" aria-label="Aus der Palette">
							{palette.map(([scale, steps]) => (
								<div key={scale} className="sg-editor__palette-row">
									{steps.map((step) => (
										<button
											key={step.name}
											type="button"
											title={shortName(step.name)}
											aria-label={shortName(step.name)}
											aria-pressed={value === `var(${step.name})`}
											className="sg-editor__palette-step"
											style={{ background: resolveToken(step.name, data.tokensByName, data.draft) }}
											onClick={() => set(`var(${step.name})`)}
										/>
									))}
								</div>
							))}
						</div>
					)}

					{token.type === 'font' && (
						<>
							<select
								className="sg-input"
								aria-label="Schrift wählen"
								value={
									FONT_STACKS.some((stack) => stack.value === value)
										? value
										: ownFamily
											? `own:${ownFamily}`
											: ''
								}
								onChange={(event) => {
									const choice = event.target.value;
									if (choice.startsWith('own:')) {
										set(fontValue(choice.slice(4), token));
									} else if (choice) {
										set(choice);
									}
								}}
							>
								<option value="">Schrift wählen …</option>
								<optgroup label="Systemschriften">
									{FONT_STACKS.map((stack) => (
										<option key={stack.label} value={stack.value}>
											{stack.label}
										</option>
									))}
								</optgroup>
								{data.fonts.families.length > 0 && (
									<optgroup label="Eigene Schriften">
										{data.fonts.families.map((family) => (
											<option key={family} value={`own:${family}`}>
												{family}
											</option>
										))}
									</optgroup>
								)}
							</select>
							<p className="sg-muted sg-editor__hint">
								Eigene Schriften: im Medienmodul in die Sammlung „Schriften“ hochladen, eine Datei je Schnitt
								(z. B. Inter-Regular.woff2, Inter-Bold.woff2).
							</p>
						</>
					)}

					{invalid && <p className="sg-editor__error">Nicht übernommen: {invalid}</p>}

					{token.layer === 'design' && (
						<div>
							<div className="sg-editor__label">Semantic Tokens, die darauf zeigen</div>
							{pointedAtBy.length === 0 ? (
								<p className="sg-muted sg-editor__hint">Keiner: eine Änderung hier ändert die Website nicht.</p>
							) : (
								<div className="sg-chips">
									{pointedAtBy.map((name) => (
										<button key={name} type="button" className="sg-chip" onClick={() => data.selectToken(name)}>
											{valueName(name)}
										</button>
									))}
								</div>
							)}
						</div>
					)}

					<ValueHistory name={token.name} />
				</>
			)}
		</div>
	);
}
