import * as React from 'react';
import { useState } from 'react';
import { type Data, useData } from '../context';
import { navigate, type Route } from '../route';
import { searchEntries, searchTerm, searchTokens } from '../search';
import { type Kind, kindsOf, resolveToken, shortName } from '../tokens';

/** a token the draft sets to something other than its default */
export const isChanged = (data: Data, name: string) =>
	data.draft[name] !== undefined && data.draft[name] !== data.tokensByName.get(name)?.value;

// outside of React: "Tokens" opens the kind that was open last, the search stays while the view is closed
let lastKind: string | null = null;
let lastSearch = '';

type ItemProps = {
	to: Route;
	/** instead of only navigating */
	onClick?: () => void;
	active: boolean;
	label: string;
	count?: number;
	dot?: boolean;
	nested?: boolean;
	/** before the label (a swatch) */
	icon?: React.ReactNode;
	/** after the label, quiet (the level of an element) */
	meta?: string;
};

function Item(props: ItemProps) {
	return (
		<button
			type="button"
			onClick={props.onClick ?? (() => navigate(props.to))}
			className={['sg-rail__item', props.active && 'sg-rail__item--active', props.nested && 'sg-rail__item--nested']
				.filter(Boolean)
				.join(' ')}
			aria-current={props.active ? 'page' : undefined}
		>
			{props.icon}
			<span className="sg-rail__label">{props.label}</span>
			{props.meta && <span className="sg-rail__meta">{props.meta}</span>}
			{props.dot && <span className="sg-dot" aria-label="geändert" />}
			{props.count !== undefined && <span className="sg-rail__count">{props.count}</span>}
		</button>
	);
}

/** what the search finds: elements and tokens, both areas at once; a token opens its kind and its editor */
function Results({ term, kinds, current }: { term: string; kinds: Kind[]; current: Route }) {
	const data = useData();
	const entries = searchEntries(data.entries, term);
	const tokens = searchTokens(data.tokens.tokens, data.tokens.groups, term);
	const levels = new Map(data.manifest.levels.map((level) => [level.id, level.label]));
	const kindOf = (group: string) => kinds.find((kind) => kind.groups.some((candidate) => candidate.id === group))?.id ?? null;

	if (entries.length === 0 && tokens.length === 0) {
		return <p className="sg-rail__empty">Nichts gefunden.</p>;
	}
	return (
		<>
			{entries.length > 0 && (
				<div className="sg-rail__results" role="group" aria-label="Gefundene Elemente">
					<h3 className="sg-rail__heading">
						Elemente <span>{entries.length}</span>
					</h3>
					{entries.map((entry) => (
						<Item
							key={entry.id}
							to={{ screen: 'element', id: entry.id }}
							active={current.screen === 'element' && current.id === entry.id}
							label={entry.title}
							meta={levels.get(entry.level)}
						/>
					))}
				</div>
			)}
			{tokens.length > 0 && (
				<div className="sg-rail__results" role="group" aria-label="Gefundene Tokens">
					<h3 className="sg-rail__heading">
						Tokens <span>{tokens.length}</span>
					</h3>
					{tokens.map((token) => {
						const to: Route = { screen: 'tokens', kind: kindOf(token.group) };
						const swatch = resolveToken(token.name, data.tokensByName, data.draft);
						return (
							<Item
								key={token.name}
								to={to}
								onClick={() => {
									navigate(to);
									data.selectToken(token.name);
								}}
								active={data.selectedToken === token.name}
								label={shortName(token.name)}
								dot={isChanged(data, token.name)}
								icon={
									token.type === 'color' ? (
										<span className="sg-swatch sg-swatch--tiny" style={{ background: swatch }} />
									) : (
										<span className="sg-rail__icon" />
									)
								}
							/>
						);
					})}
				</div>
			)}
		</>
	);
}

/** the navigation: tokens by kind, or elements by level (the entries of the open level below it) */
export function Rail({ route, onClose }: { route: Route; onClose: () => void }) {
	const data = useData();
	const [search, setSearch] = useState(lastSearch);
	lastSearch = search;
	const term = searchTerm(search);
	const kinds = kindsOf(data.tokens);
	const onTokens = route.screen === 'tokens';
	if (onTokens && route.kind) {
		lastKind = route.kind;
	}
	const current = route.screen === 'element' ? data.entries.find((entry) => entry.id === route.id) : undefined;
	const openLevel = route.screen === 'elements' ? route.level : current?.level;

	return (
		<nav className="sg-rail" aria-label="Styleguide">
			<div className="sg-rail__switch" role="group" aria-label="Bereich">
				<button
					type="button"
					aria-pressed={onTokens}
					onClick={() => navigate({ screen: 'tokens', kind: lastKind ?? kinds[0]?.id ?? null })}
				>
					Tokens
				</button>
				<button type="button" aria-pressed={!onTokens} onClick={() => navigate({ screen: 'elements', level: null })}>
					Elemente
				</button>
			</div>

			<input
				type="search"
				className="sg-input sg-rail__search"
				placeholder="Elemente und Tokens suchen"
				aria-label="Styleguide durchsuchen"
				value={search}
				onChange={(event) => setSearch(event.target.value)}
				onKeyDown={(event) => event.key === 'Escape' && setSearch('')}
			/>

			<div className="sg-rail__list">
				{term ? (
					<Results term={term} kinds={kinds} current={route} />
				) : onTokens
					? kinds.map((kind) => {
							const groups = new Set(kind.groups.map((group) => group.id));
							const changed = data.tokens.tokens.some((token) => groups.has(token.group) && isChanged(data, token.name));
							const active = route.kind === kind.id || (!route.kind && kind === kinds[0]);
							return (
								<Item key={kind.id} to={{ screen: 'tokens', kind: kind.id }} active={active} label={kind.label} dot={changed} />
							);
						})
					: [
							<Item
								key="all"
								to={{ screen: 'elements', level: null }}
								active={route.screen === 'elements' && !route.level}
								label="Alle"
								count={data.entries.length}
							/>,
							...data.manifest.levels.map((level) => {
								const entries = data.entries.filter((entry) => entry.level === level.id);
								return entries.length === 0 ? null : (
									<React.Fragment key={level.id}>
										<Item
											to={{ screen: 'elements', level: level.id }}
											active={route.screen === 'elements' && route.level === level.id}
											label={level.label}
											count={entries.length}
										/>
										{openLevel === level.id && (
											<div className="sg-rail__entries">
												{entries.map((entry) => (
													<Item
														key={entry.id}
														to={{ screen: 'element', id: entry.id }}
														active={route.screen === 'element' && route.id === entry.id}
														label={entry.title}
														nested
													/>
												))}
											</div>
										)}
									</React.Fragment>
								);
							})
						]}
			</div>

			<div className="sg-rail__footer">
				<span>Site · {data.site.title}</span>
				<button type="button" className="sg-icon-button" aria-label="Styleguide schließen" onClick={onClose}>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
						<path d="M6 6l12 12M18 6L6 18" />
					</svg>
				</button>
			</div>
		</nav>
	);
}
