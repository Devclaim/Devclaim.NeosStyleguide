import * as React from 'react';
import { useEffect, useLayoutEffect, useState } from 'react';
import { useData } from '../context';
import { type Route, useRoute } from '../route';
import { AreaSwitch, Rail, StateDot, strongest, valueState } from '../components/Rail';
import { Element } from '../screens/Element';
import { Elements } from '../screens/Elements';
import { TokensOverview } from '../screens/TokensOverview';
import { EmbeddedData } from './data';
import { DesignPanel } from './DesignPanel';
import { setViewState, useViewState } from './store';

/** where the view goes: everything below the top bar of the Neos UI (measured), the inspector included */
function useTop() {
	const [top, setTop] = useState(41);
	useLayoutEffect(() => {
		const measure = () => setTop(document.querySelector('[class*="primaryToolbar"]')?.getBoundingClientRect().bottom ?? 41);
		measure();
		window.addEventListener('resize', measure);
		return () => window.removeEventListener('resize', measure);
	}, []);
	return top;
}

/** what lies over the screen where there is no room for its column (App.css, the narrow screens) */
type Drawer = 'rail' | 'panel' | null;

/** where the columns do not fit: the buttons that open them, the design one with the state of the tokens */
function Bar({ route, drawer, onOpen }: { route: Route; drawer: Drawer; onOpen: (drawer: Drawer) => void }) {
	const data = useData();
	return (
		<div className="sg-bar">
			<button
				type="button"
				className="sg-bar__button sg-bar__button--rail"
				aria-label="Navigation"
				aria-expanded={drawer === 'rail'}
				onClick={() => onOpen('rail')}
			>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
					<path d="M4 6h16M4 12h16M4 18h16" />
				</svg>
			</button>
			<AreaSwitch route={route} />
			<span className="sg-header__spacer" />
			<button type="button" className="sg-bar__button" aria-expanded={drawer === 'panel'} onClick={() => onOpen('panel')}>
				<StateDot state={strongest(data.tokens.tokens.map((token) => valueState(data, token.name)))} />
				Design
			</button>
		</div>
	);
}

/** the styleguide below the top bar: navigation, screens and the design panel (where the inspector would be) */
export function StyleguideView() {
	const route = useRoute();
	const top = useTop();
	const { selectedToken } = useViewState();
	const [drawer, setDrawer] = useState<Drawer>(null);
	const close = () => {
		// else the same token could not open the panel again
		if (drawer === 'panel') {
			setViewState({ selectedToken: null });
		}
		setDrawer(null);
	};

	// the navigation has done its work; a chosen token is edited in the panel (in this order: a token of the search does both)
	useEffect(() => setDrawer(null), [route]);
	useEffect(() => {
		if (selectedToken) {
			setDrawer('panel');
		}
	}, [selectedToken]);

	return (
		<div id="neos-styleguide-view" style={{ top }}>
			<EmbeddedData>
				<div
					className="sg-app"
					data-drawer={drawer ?? undefined}
					onKeyDown={(event) => {
						// Escape in a field is the field's (the search empties itself)
						if (event.key === 'Escape' && !(event.target instanceof HTMLInputElement)) {
							close();
						}
					}}
				>
					<Rail route={route} onClose={() => setViewState({ open: false })} />
					<div className="sg-stack">
						<Bar route={route} drawer={drawer} onOpen={setDrawer} />
						<main className="sg-main">
							{route.screen === 'tokens' && <TokensOverview kind={route.kind} layer={route.layer} />}
							{route.screen === 'elements' && <Elements level={route.level} />}
							{route.screen === 'element' && <Element id={route.id} />}
						</main>
					</div>
					{drawer && <button type="button" className="sg-backdrop" aria-label="Schließen" onClick={close} />}
					<DesignPanel onClose={close} />
				</div>
			</EmbeddedData>
		</div>
	);
}
