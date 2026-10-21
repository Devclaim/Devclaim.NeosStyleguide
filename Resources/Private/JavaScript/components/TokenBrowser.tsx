import * as React from 'react';
import { useState } from 'react';
import { useData } from '../context';
import { searchTerm, searchTokens } from '../search';
import {
	hasLayers,
	isScaleGroup,
	kindsOf,
	layerKinds,
	listedTokens,
	resolveToken,
	scalesOf,
	shortName,
	shortValue
} from '../tokens';
import { StateDot, tokenState } from './Rail';

// outside of React: the open kinds stay while the editor is rendered anew
const open = new Set<string>(['colors']);

/**
 * All tokens in the inspector, by kind, to change any of them next to whatever the styleguide shows (the elements,
 * one element); a click opens the editor of a token
 */
export function TokenBrowser() {
	const data = useData();
	const [search, setSearch] = useState('');
	const [, rerender] = useState(0);
	// with layers: the semantic tokens (what the website uses); their variants are in the editor
	const layered = hasLayers(data.tokens);
	const kinds = layered ? layerKinds(data.tokens, 'semantic') : kindsOf(data.tokens);
	const term = searchTerm(search);
	const editable = (layered ? listedTokens(data.tokens, 'semantic') : data.tokens.tokens).filter(
		(token) => token.editable
	);
	const matches = term ? searchTokens(editable, data.tokens.groups, term) : [];

	const row = (name: string) => {
		const token = data.tokensByName.get(name);
		if (!token) {
			return null;
		}
		// a semantic token with variants: its first variant (the token itself only switches between them)
		const shown = token.variants?.[0]?.token ?? name;
		const value = data.draft[shown] ?? data.tokensByName.get(shown)?.value ?? token.value;
		return (
			<button key={name} type="button" className="sg-browser__row" onClick={() => data.selectToken(name)}>
				{token.type === 'color' ? (
					<span className="sg-swatch sg-swatch--small" style={{ background: resolveToken(shown, data.tokensByName, data.draft) }} />
				) : (
					<span className="sg-browser__type">{token.type === 'font' ? 'Aa' : ''}</span>
				)}
				<span className="sg-browser__name">{shortName(name)}</span>
				<StateDot state={tokenState(data, name)} />
				<span className="sg-browser__value">{shortValue(value)}</span>
			</button>
		);
	};

	return (
		<div className="sg-browser">
			<input
				type="search"
				className="sg-input"
				placeholder="Token suchen"
				aria-label="Token suchen"
				value={search}
				onChange={(event) => setSearch(event.target.value)}
			/>
			{term ? (
				<div className="sg-browser__rows">
					{matches.length === 0 ? <p className="sg-muted">Kein Token gefunden.</p> : matches.map((token) => row(token.name))}
				</div>
			) : (
				kinds.map((kind) => {
					const isOpen = open.has(kind.id);
					return (
						<div key={kind.id} className="sg-browser__kind">
							<button
								type="button"
								className="sg-browser__toggle"
								aria-expanded={isOpen}
								onClick={() => {
									if (isOpen) {
										open.delete(kind.id);
									} else {
										open.add(kind.id);
									}
									rerender((count) => count + 1);
								}}
							>
								<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
									<path d="M9 6l6 6-6 6" />
								</svg>
								{kind.label}
							</button>
							{isOpen &&
								kind.groups.map((group) => {
									const tokens = editable.filter((token) => token.group === group.id);
									if (tokens.length === 0) {
										return null;
									}
									return isScaleGroup(tokens) ? (
										<div key={group.id} className="sg-browser__scales">
											{scalesOf(tokens).map(([scale, steps]) => (
												<div key={scale} className="sg-editor__palette-row">
													{steps.map((step) => (
														<button
															key={step.name}
															type="button"
															title={shortName(step.name)}
															aria-label={shortName(step.name)}
															className="sg-editor__palette-step"
															style={{ background: resolveToken(step.name, data.tokensByName, data.draft) }}
															onClick={() => data.selectToken(step.name)}
														/>
													))}
												</div>
											))}
										</div>
									) : (
										<div key={group.id} className="sg-browser__rows">
											{tokens.map((token) => row(token.name))}
										</div>
									);
								})}
						</div>
					);
				})
			)}
		</div>
	);
}
