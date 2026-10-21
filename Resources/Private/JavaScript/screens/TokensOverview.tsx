import * as React from 'react';
import { useState } from 'react';
import { StateDot, tokenState, valueState } from '../components/Rail';
import { type Data, useData } from '../context';
import type { Token, TokenGroup } from '../protocol';
import {
	hasLayers,
	isScaleGroup,
	kindsOf,
	type Layer,
	layerKinds,
	listedTokens,
	describe,
	resolveToken,
	scalesOf,
	shortName,
	shortValue,
	textStyleDetails,
	valueName,
	variantLabel,
	variantValue
} from '../tokens';

const classes = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(' ');

/** what a token looks like, by its type (not for colors: they are swatches) */
export function Sample({ token, resolved, max = 40 }: { token: Token; resolved: string; max?: number }) {
	switch (token.type) {
		case 'font':
			return (
				<span className="sg-sample-font" style={{ fontFamily: resolved }}>
					Aa Bb Cc 0123
				</span>
			);
		case 'shadow':
			return <span className="sg-sample-shadow" style={{ boxShadow: resolved }} />;
		case 'ratio':
			return <span className="sg-sample-ratio" style={{ aspectRatio: resolved }} />;
		case 'size':
			return token.name.startsWith('--text-size-') ? (
				<span className="sg-sample-text" style={{ fontSize: `min(${resolved}, ${max}px)` }}>
					Ag
				</span>
			) : (
				<span className="sg-sample-bar" style={{ width: `min(100%, ${resolved})` }} />
			);
		default:
			return token.name.startsWith('--radius-') ? (
				<span className="sg-sample-radius" style={{ borderTopLeftRadius: `min(${resolved}, 20px)` }} />
			) : null;
	}
}

/** one token as a row: swatch or sample, name, value; a click opens it in the inspector */
function Row({ token, data }: { token: Token; data: Data }) {
	const valueOf = (name: string) => data.draft[name] ?? data.tokensByName.get(name)?.value ?? '';
	// a text style: its size with the line height and paragraph spacing (one row, PROTOCOL.md "Layers and variants")
	const details = textStyleDetails(token.name, data.tokensByName);
	const value =
		details.length > 0
			? `${shortValue(valueOf(token.name))} / ${details.map((detail) => shortValue(valueOf(detail))).join(' · ')}`
			: valueOf(token.name);
	const resolved = resolveToken(token.name, data.tokensByName, data.draft);
	const state = tokenState(data, token.name);
	const color = token.type === 'color';
	return (
		<button
			type="button"
			className={classes('sg-row', !color && 'sg-row--sample', data.selectedToken === token.name && 'sg-row--selected')}
			aria-pressed={data.selectedToken === token.name}
			onClick={() => data.selectToken(token.name)}
		>
			{color ? (
				<span className="sg-swatch" style={{ background: resolved }} />
			) : (
				<span className="sg-row__sample">
					<Sample token={token} resolved={resolved} />
				</span>
			)}
			<span className="sg-row__name">{details.length > 0 ? valueName(token.name) : shortName(token.name)}</span>
			<StateDot state={state} />
			{data.invalid[token.name] && <span className="sg-row__invalid">ungültig</span>}
			<span className={classes('sg-row__value', state && `sg-row__value--${state}`)}>{shortValue(value)}</span>
		</button>
	);
}

/** the steps of the color scales as strips */
function Scales({ tokens, data }: { tokens: Token[]; data: Data }) {
	return (
		<div className="sg-scales">
			{scalesOf(tokens).map(([scale, steps]) => (
				<div key={scale} className="sg-scale">
					<span className="sg-scale__name">{scale}</span>
					<div className="sg-scale__steps" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
						{steps.map((token) => (
							<button
								key={token.name}
								type="button"
								title={`${shortName(token.name)}: ${shortValue(data.draft[token.name] ?? token.value)}`}
								aria-label={shortName(token.name)}
								className={classes(
									'sg-scale__step',
									tokenState(data, token.name) && `sg-scale__step--${tokenState(data, token.name)}`,
									data.selectedToken === token.name && 'sg-scale__step--selected'
								)}
								style={{ background: resolveToken(token.name, data.tokensByName, data.draft) }}
								onClick={() => data.selectToken(token.name)}
							/>
						))}
					</div>
				</div>
			))}
		</div>
	);
}

/** the width of a value across all variant columns (one value for every variant) */
const spanned = (columns: number) =>
	`calc(${Math.max(columns, 1)} * var(--sg-variant-width) + ${Math.max(columns - 1, 0)} * var(--sg-variant-gap))`;

/** a semantic token as a row: its sample, name and a column per variant (the design token it points at) */
function SemanticRow({ token, data, columns }: { token: Token; data: Data; columns: string[] }) {
	const variants = token.variants ?? [];
	// the sample shows the first variant: the token itself may only switch between them (light-dark(), a media query)
	const shown = variants[0]?.token ?? token.name;
	const resolved = resolveToken(shown, data.tokensByName, data.draft);
	const state = tokenState(data, token.name);
	const description = describe(token, data.tokensByName);
	const swatch = (name: string) =>
		token.type === 'color' && (
			<span
				className="sg-swatch sg-swatch--tiny"
				style={{ background: resolveToken(name, data.tokensByName, data.draft) }}
			/>
		);
	return (
		<button
			type="button"
			className={classes('sg-row', 'sg-row--semantic', data.selectedToken === token.name && 'sg-row--selected')}
			aria-pressed={data.selectedToken === token.name}
			title={description || undefined}
			onClick={() => data.selectToken(token.name)}
		>
			{token.type === 'color' ? (
				<span className="sg-swatch" style={{ background: resolved }} />
			) : (
				<span className="sg-row__sample">
					<Sample token={token} resolved={resolved} />
				</span>
			)}
			<span className="sg-row__name">{valueName(token.name)}</span>
			<StateDot state={state} />
			{data.invalid[token.name] && <span className="sg-row__invalid">ungültig</span>}
			{variants.length > 0 ? (
				<span className="sg-variants">
					{columns.map((id) => {
						const variant = variants.find((candidate) => candidate.id === id);
						if (!variant) {
							return <span key={id} className="sg-variant" />;
						}
						const { value, from } = variantValue(token, id, data.tokensByName, data.draft);
						return (
							<span
								key={id}
								className={classes(
									'sg-variant',
									from && 'sg-variant--inherited',
									valueState(data, variant.token) && `sg-variant--${valueState(data, variant.token)}`
								)}
								title={from ? `wie ${variantLabel(from)}: ${value}` : value}
							>
								{swatch(variant.token)}
								<span className="sg-variant__text">{shortValue(value)}</span>
							</span>
						);
					})}
				</span>
			) : (
				// one value for every variant: across the columns
				<span
					className={classes(
						'sg-variants',
						'sg-variants--single',
						valueState(data, token.name) && `sg-variant--${valueState(data, token.name)}`
					)}
					style={{ width: spanned(columns.length) }}
					title={data.draft[token.name] ?? token.value}
				>
					{swatch(token.name)}
					<span className="sg-variant__text">
						{/^var\(--[\w-]+\)$/.test(data.draft[token.name] ?? token.value)
							? shortValue(data.draft[token.name] ?? token.value)
							: 'berechnet'}
					</span>
				</span>
			)}
		</button>
	);
}

/** the semantic tokens of a group, with a column per variant (the variants of its tokens) */
function SemanticGroup({ group, tokens, data }: { group: TokenGroup; tokens: Token[]; data: Data }) {
	const columns = [...new Set(tokens.flatMap((token) => (token.variants ?? []).map((variant) => variant.id)))];
	return (
		<section className="sg-section">
			<div className="sg-section__head">
				<h2 title={group.description || undefined}>{group.label}</h2>
				<span className="sg-header__spacer" />
				{columns.length > 0 && (
					<span className="sg-variants sg-variants--head">
						{columns.map((id) => (
							<span key={id} className="sg-variant">
								{variantLabel(id)}
							</span>
						))}
					</span>
				)}
			</div>
			<div className="sg-rows">
				{tokens.map((token, index) => (
					<React.Fragment key={token.name}>
						{/* a heading where a part of the group starts (Subgroup: comments of the stylesheet) */}
						{token.subgroup && token.subgroup !== tokens[index - 1]?.subgroup && (
							<h3 className="sg-subgroup">{token.subgroup}</h3>
						)}
						<SemanticRow token={token} data={data} columns={columns} />
					</React.Fragment>
				))}
			</div>
		</section>
	);
}

function Group({ group, tokens, data }: { group: TokenGroup; tokens: Token[]; data: Data }) {
	const colors = tokens.every((token) => token.type === 'color');
	return (
		<section className="sg-section">
			<div className="sg-section__head">
				<h2>{group.label}</h2>
			</div>
			{tokens.some((token) => !token.editable) && (
				<p className="sg-section__note">Stehen beim Build fest und gelten für alle Sites.</p>
			)}
			{isScaleGroup(tokens) ? (
				<Scales tokens={tokens} data={data} />
			) : (
				<div className={colors ? 'sg-rows sg-rows--columns' : 'sg-rows'}>
					{tokens.map((token) => (
						<Row key={token.name} token={token} data={data} />
					))}
				</div>
			)}
		</section>
	);
}

/**
 * The tokens of one kind with the values of the site and the draft. With layers (PROTOCOL.md, "Layers and variants"):
 * the semantic tokens with a column per variant, or the design tokens they point at
 */
export function TokensOverview({ kind: kindId, layer: routeLayer }: { kind: string | null; layer?: Layer }) {
	const data = useData();
	const [onlyChanged, setOnlyChanged] = useState(false);
	const layered = hasLayers(data.tokens);
	const layer: Layer | null = layered ? (routeLayer ?? 'semantic') : null;
	const kinds = layer ? layerKinds(data.tokens, layer) : kindsOf(data.tokens);
	const kind = kinds.find((candidate) => candidate.id === kindId) ?? kinds[0];
	if (!kind) {
		return <div className="sg-message">Der Adapter hat keine Tokens.</div>;
	}
	const candidates = layer ? listedTokens(data.tokens, layer) : data.tokens.tokens;
	const inKind = candidates.filter((token) => kind.groups.some((group) => group.id === token.group));
	const states = inKind.map((token) => tokenState(data, token.name));
	const own = states.filter((state) => state === 'own').length;
	const unpublished = states.filter((state) => state === 'unpublished').length;
	const changed = own + unpublished;

	return (
		<>
			<header className="sg-header">
				<div className="sg-header__title">
					{layer && <span className="sg-header__layer">{layer === 'semantic' ? 'Semantic Tokens' : 'Design Tokens'}</span>}
					<h1>{kind.label}</h1>
				</div>
				<span className="sg-header__meta">
					{changed > 0
						? [own > 0 && `${own} eigene`, unpublished > 0 && `${unpublished} unveröffentlicht`].filter(Boolean).join(' · ')
						: `${inKind.length} Tokens`}
				</span>
				<span className="sg-header__spacer" />
				<label className="sg-check">
					<input type="checkbox" checked={onlyChanged} onChange={(event) => setOnlyChanged(event.target.checked)} />
					Nur abweichende
				</label>
			</header>
			<div className="sg-content">
				{layer === 'design' && (
					<p className="sg-layer-note">
						Die Werte des Designs. Die Website nutzt sie nicht direkt: Semantic Tokens zeigen auf sie, eine Änderung hier
						ändert jeden, der auf den Wert zeigt.
					</p>
				)}
				{kind.groups.map((group) => {
					const tokens = inKind.filter(
						(token) => token.group === group.id && (!onlyChanged || tokenState(data, token.name) !== null)
					);
					if (tokens.length === 0) {
						return null;
					}
					return layer === 'semantic' ? (
						<SemanticGroup key={group.id} group={group} tokens={tokens} data={data} />
					) : (
						<Group key={group.id} group={group} tokens={tokens} data={data} />
					);
				})}
				{onlyChanged && changed === 0 && <p className="sg-muted">Alle {kind.label} haben ihren Standardwert.</p>}
			</div>
		</>
	);
}
