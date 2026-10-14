import * as React from 'react';
import { useState } from 'react';
import { isChanged } from '../components/Rail';
import { type Data, useData } from '../context';
import type { Token, TokenGroup } from '../protocol';
import { isScaleGroup, kindsOf, resolveToken, scalesOf, shortName, shortValue } from '../tokens';

const classes = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(' ');

/** what a token looks like, by its type (not for colors: they are swatches) */
export function Sample({ token, resolved }: { token: Token; resolved: string }) {
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
				<span className="sg-sample-text" style={{ fontSize: `min(${resolved}, 40px)` }}>
					Ag
				</span>
			) : (
				<span className="sg-sample-bar" style={{ width: `min(100%, ${resolved})` }} />
			);
		default:
			return null;
	}
}

/** one token as a row: swatch or sample, name, value; a click opens it in the inspector */
function Row({ token, data }: { token: Token; data: Data }) {
	const value = data.draft[token.name] ?? token.value;
	const resolved = resolveToken(token.name, data.tokensByName, data.draft);
	const changed = isChanged(data, token.name);
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
			<span className="sg-row__name">{shortName(token.name)}</span>
			{changed && <span className="sg-dot" aria-label="geändert" />}
			{data.invalid[token.name] && <span className="sg-row__invalid">ungültig</span>}
			<span className={classes('sg-row__value', changed && 'sg-row__value--changed')}>{shortValue(value)}</span>
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
									isChanged(data, token.name) && 'sg-scale__step--changed',
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

/** the tokens of one kind with the values of the site and the draft (mockup: tokens) */
export function TokensOverview({ kind: kindId }: { kind: string | null }) {
	const data = useData();
	const [onlyChanged, setOnlyChanged] = useState(false);
	const kinds = kindsOf(data.tokens);
	const kind = kinds.find((candidate) => candidate.id === kindId) ?? kinds[0];
	if (!kind) {
		return <div className="sg-message">Der Adapter hat keine Tokens.</div>;
	}
	const inKind = data.tokens.tokens.filter((token) => kind.groups.some((group) => group.id === token.group));
	const changed = inKind.filter((token) => isChanged(data, token.name)).length;

	return (
		<>
			<header className="sg-header">
				<h1>{kind.label}</h1>
				<span className="sg-header__meta">{changed > 0 ? `${changed} geändert` : `${inKind.length} Tokens`}</span>
				<span className="sg-header__spacer" />
				<label className="sg-check">
					<input type="checkbox" checked={onlyChanged} onChange={(event) => setOnlyChanged(event.target.checked)} />
					Nur geänderte
				</label>
			</header>
			<div className="sg-content">
				{kind.groups.map((group) => {
					const tokens = inKind.filter(
						(token) => token.group === group.id && (!onlyChanged || isChanged(data, token.name))
					);
					return tokens.length === 0 ? null : <Group key={group.id} group={group} tokens={tokens} data={data} />;
				})}
				{onlyChanged && changed === 0 && <p className="sg-muted">Alle {kind.label} haben ihren Standardwert.</p>}
			</div>
		</>
	);
}
