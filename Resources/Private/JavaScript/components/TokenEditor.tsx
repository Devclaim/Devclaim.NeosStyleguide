import * as React from 'react';
import { useData } from '../context';
import type { Token } from '../protocol';
import { firstFamily, isScaleGroup, resolveToken, scalesOf, shortName, shortValue } from '../tokens';
import { isChanged } from './Rail';

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

/** the editor of one token, by its type (protocol: Token.type), in the inspector */
export function TokenEditor({ token, onBack }: { token: Token; onBack?: () => void }) {
	const data = useData();
	const value = data.draft[token.name] ?? token.value;
	const resolved = resolveToken(token.name, data.tokensByName, data.draft);
	const changed = isChanged(data, token.name);
	const unsaved = data.unsaved.includes(token.name);
	const invalid = data.invalid[token.name];
	const palette = usePalette(token);
	// an uploaded font the value names (media module, collection "Schriften")
	const ownFamily = token.type === 'font' && data.fonts.families.includes(firstFamily(value)) ? firstFamily(value) : null;
	const set = (next: string) => data.setToken(token.name, next === token.value ? null : next);

	return (
		<div className="sg-editor">
			{onBack && (
				<button type="button" className="sg-editor__back" onClick={onBack}>
					← Alle Tokens
				</button>
			)}
			<div className="sg-editor__name">{shortName(token.name)}</div>

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

					<div className="sg-editor__foot">
						<span>Standard: {shortValue(token.value)}</span>
						<span className="sg-editor__links">
							{unsaved && (
								<button type="button" className="sg-link" onClick={() => data.discard(token.name)}>
									Rückgängig
								</button>
							)}
							{changed && (
								<button type="button" className="sg-link" onClick={() => data.setToken(token.name, null)}>
									Zurücksetzen
								</button>
							)}
						</span>
					</div>
				</>
			)}
		</div>
	);
}
