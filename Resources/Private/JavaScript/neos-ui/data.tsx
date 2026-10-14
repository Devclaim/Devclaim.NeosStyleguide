import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type Api, createApi, parseOverrides, serializeOverrides } from '../api';
import { type Data, DataContext, type Fonts } from '../context';
import { useTokenDraft } from '../draft';
import { applyFontCss } from '../frames';
import type { EntrySummary, Manifest, Tokens } from '../protocol';
import { persistTokens, useSiteNode } from './neos';
import { getViewState, setViewState, useViewState } from './store';

type Loaded = { manifest: Manifest; entries: EntrySummary[]; tokens: Tokens; fonts: Fonts };

/** a pause in editing, then the draft is saved */
const SAVE_DELAY = 700;

let api: Api | null = null;
let fontsUrl: string | null = null;
let loading: Promise<Loaded> | null = null;

/**
 * The adapter (the adapter of the frontendConfiguration of the Neos UI, Configuration/Settings.yaml) and the fonts of Neos (this
 * package's API), loaded once
 */
export function configure(adapter: string, fonts: string | null) {
	api = createApi(adapter);
	fontsUrl = fonts;
}

/** the fonts editors uploaded; none if Neos does not answer (the system fonts still work) */
async function loadFonts(): Promise<Fonts> {
	if (!fontsUrl) {
		return { families: [], css: '' };
	}
	try {
		const response = await fetch(fontsUrl, { credentials: 'same-origin', headers: { accept: 'application/json' } });
		return response.ok ? ((await response.json()) as Fonts) : { families: [], css: '' };
	} catch {
		return { families: [], css: '' };
	}
}

function load(): Promise<Loaded> {
	if (!api) {
		return Promise.reject(new Error('The styleguide plugin has no adapter'));
	}
	const current = api;
	loading ??= Promise.all([current.manifest(), current.entries(), current.tokens(), loadFonts()]).then(
		([manifest, entries, tokens, fonts]) => ({ manifest, entries, tokens, fonts }),
		(error: unknown) => {
			// not kept: opening the styleguide again tries again (e.g. once the frontend runs)
			loading = null;
			throw error;
		}
	);
	return loading;
}

/**
 * The data of the screens (context.ts) in the Neos UI. Saved overrides: the property of the site node in the editor's
 * workspace. A change is a draft first (the previews show it at once); after a pause the adapter checks it and, when
 * every value is valid, it is saved into the workspace like an inline edit (neos.ts). Publishing is Neos'.
 */
export function EmbeddedData({ children }: { children: React.ReactNode }) {
	const view = useViewState();
	const node = useSiteNode();
	const [loaded, setLoaded] = useState<Loaded | null>(null);
	const [failure, setFailure] = useState<string | null>(null);

	useEffect(() => {
		load()
			.then(setLoaded)
			.catch((error: unknown) => setFailure(error instanceof Error ? error.message : String(error)));
	}, []);

	const persisted = node?.designTokens ?? null;
	const overrides = useMemo(() => parseOverrides(persisted), [persisted]);

	// the draft is done once the workspace has it
	useEffect(() => {
		const { draft } = getViewState();
		if (draft && serializeOverrides(draft) === serializeOverrides(overrides)) {
			setViewState({ draft: null, save: { status: 'saved' } });
		}
	}, [overrides]);

	const timer = useRef<number>();
	const save = useCallback(
		async (next: Record<string, string>) => {
			if (!api || !node) {
				return;
			}
			setViewState({ save: { status: 'saving' } });
			try {
				const result = await api.validate(next);
				if (getViewState().draft !== next) {
					// changed again meanwhile: that change saves itself
					return;
				}
				if (result.invalid.length > 0) {
					setViewState({
						save: { status: 'invalid', message: result.invalid.map((item) => `${item.name}: ${item.reason}`).join(', ') }
					});
					return;
				}
				persistTokens(node.contextPath, serializeOverrides(next));
			} catch (error) {
				setViewState({ save: { status: 'error', message: error instanceof Error ? error.message : String(error) } });
			}
		},
		[node]
	);

	const setDraft = useCallback(
		(next: Record<string, string> | null) => {
			window.clearTimeout(timer.current);
			const draft = next && serializeOverrides(next) !== serializeOverrides(overrides) ? next : null;
			setViewState({ draft, save: { status: draft ? 'saving' : 'idle' } });
			if (draft) {
				timer.current = window.setTimeout(() => save(draft), SAVE_DELAY);
			}
		},
		[overrides, save]
	);

	const tokenDraft = useTokenDraft(api as Api, loaded?.tokens.tokens, overrides, view.draft, setDraft);

	const fontCss = loaded?.fonts.css ?? '';
	const previewDraft = useMemo(
		() => ({ tokens: tokenDraft.previewTokens, fontCss }),
		[tokenDraft.previewTokens, fontCss]
	);

	// the fonts in the page of the interface too: the samples of the tokens show them
	useEffect(() => applyFontCss(document, fontCss), [fontCss]);

	const data = useMemo((): Data | null => {
		if (!loaded || !api || !node) {
			return null;
		}
		return {
			api,
			...loaded,
			tokensByName: new Map(loaded.tokens.tokens.map((token) => [token.name, token])),
			site: { key: node.key, title: node.title, designTokens: persisted },
			overrides,
			...tokenDraft,
			previewDraft,
			selectedToken: view.selectedToken,
			selectToken: (name) => setViewState({ selectedToken: name })
		};
	}, [loaded, node, persisted, overrides, tokenDraft, previewDraft, view.selectedToken]);

	if (failure) {
		return <div className="sg-message">Der Styleguide konnte nicht geladen werden: {failure}</div>;
	}
	if (!data) {
		return <div className="sg-message">Styleguide wird geladen …</div>;
	}
	return <DataContext.Provider value={data}>{children}</DataContext.Provider>;
}
