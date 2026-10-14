import * as React from 'react';
import { useLayoutEffect, useState } from 'react';
import { useRoute } from '../route';
import { Rail } from '../components/Rail';
import { Element } from '../screens/Element';
import { Elements } from '../screens/Elements';
import { TokensOverview } from '../screens/TokensOverview';
import { EmbeddedData } from './data';
import { DesignPanel } from './DesignPanel';
import { setViewState } from './store';

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

/** the styleguide below the top bar: navigation, screens and the design panel (where the inspector would be) */
export function StyleguideView() {
	const route = useRoute();
	const top = useTop();
	return (
		<div id="neos-styleguide-view" style={{ top }}>
			<EmbeddedData>
				<div className="sg-app">
					<Rail route={route} onClose={() => setViewState({ open: false })} />
					<main className="sg-main">
						{route.screen === 'tokens' && <TokensOverview kind={route.kind} />}
						{route.screen === 'elements' && <Elements level={route.level} />}
						{route.screen === 'element' && <Element id={route.id} />}
					</main>
					<DesignPanel />
				</div>
			</EmbeddedData>
		</div>
	);
}
