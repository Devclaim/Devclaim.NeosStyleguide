import { useEffect, useState } from 'react';
import { actions, type NeosNode, selectors } from '@neos-project/neos-ui-redux-store';
import { getViewState, subscribeViewState } from './store';

/**
 * The Neos UI around the styleguide: its redux store (from the manifest of the plugin, index.tsx). The design tokens
 * are the property "designTokens" of the site node; they are saved like an inline edit (a change of the Neos UI into
 * the editor's workspace), published and discarded with the top bar and the workspace module.
 *
 * The page in the canvas is behind the view while it is open: it is rendered again with the saved tokens once, when
 * the view closes, not after every save (the property has no reloadPageIfChanged; each reload would render the whole
 * page and start the Neos UI in it again while the editor works in the styleguide).
 */

const PROPERTY = 'designTokens';

type Store = { getState: () => unknown; subscribe: (listener: () => void) => () => void; dispatch: (action: unknown) => void };

let store: Store | null = null;

/** a save of the tokens was sent; the canvas needs the page again once the workspace has it */
let saving = false;
/** the workspace has tokens the page in the canvas does not show yet */
let canvasStale = false;

const reloadCanvas = () => {
	canvasStale = false;
	store?.dispatch(actions.UI.ContentCanvas.reload(null));
};

export function connectStore(neosStore: unknown) {
	store = neosStore as Store;
	let tokens = siteNode()?.designTokens;
	store.subscribe(() => {
		const next = siteNode()?.designTokens;
		if (next === tokens) {
			return;
		}
		tokens = next;
		// only the styleguide's own saves: publishing and discarding reload the canvas themselves
		if (saving) {
			saving = false;
			if (getViewState().open) {
				canvasStale = true;
			} else {
				reloadCanvas();
			}
		}
	});
	subscribeViewState(() => {
		if (canvasStale && !getViewState().open) {
			reloadCanvas();
		}
	});
}

export type SiteNode = { contextPath: string; key: string; title: string; designTokens: string | null };

function siteNode(): SiteNode | null {
	const node: NeosNode | null = store ? selectors.CR.Nodes.siteNodeSelector(store.getState()) : null;
	if (!node?.contextPath) {
		return null;
	}
	const value = node.properties?.[PROPERTY];
	return {
		contextPath: node.contextPath,
		key: node.name ?? '',
		title: node.label ?? node.name ?? '',
		designTokens: typeof value === 'string' && value !== '' ? value : null
	};
}

/** the site node of the content module with its tokens in the editor's workspace, kept up to date */
export function useSiteNode(): SiteNode | null {
	const [node, setNode] = useState(siteNode);
	useEffect(() => {
		if (!store) {
			return;
		}
		const update = () =>
			setNode((current) => {
				const next = siteNode();
				return current?.contextPath === next?.contextPath && current?.designTokens === next?.designTokens ? current : next;
			});
		update();
		return store.subscribe(update);
	}, []);
	return node;
}

/** saves the tokens into the editor's workspace: the change the Neos UI sends for an inline edit of a property */
export function persistTokens(contextPath: string, designTokens: string) {
	saving = true;
	store?.dispatch(
		actions.Changes.persistChanges([
			{
				type: 'Neos.Neos.Ui:Property',
				subject: contextPath,
				payload: { propertyName: PROPERTY, value: designTokens, isInline: false }
			}
		])
	);
}
