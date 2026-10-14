import { createContext, useContext } from 'react';
import type { Api, Site } from './api';
import type { EntrySummary, Manifest, Token, Tokens } from './protocol';

export type PreviewDraft = { tokens: Record<string, string>; fontCss: string };

/** the fonts editors uploaded (the Neos API of this package, not the adapter) */
export type Fonts = { families: string[]; css: string };

/** everything the screens need (neos-ui/data.tsx) */
export type Data = {
	api: Api;
	manifest: Manifest;
	entries: EntrySummary[];
	tokens: Tokens;
	tokensByName: Map<string, Token>;
	site: Site;
	/** the saved overrides of the site */
	overrides: Record<string, string>;
	/** the overrides as the editor is changing them (not saved yet); starts as the saved ones */
	draft: Record<string, string>;
	/** what the previews get: the current value of every editable token (draft, else saved, else default) */
	previewTokens: Record<string, string>;
	/** what the previews get in one object: the tokens and the @font-face rules of the uploaded fonts */
	previewDraft: PreviewDraft;
	fonts: Fonts;
	/** why the adapter rejects a value of the draft, by token name */
	invalid: Record<string, string>;
	/** tokens whose value in the draft differs from the saved one (not saved yet) */
	unsaved: string[];
	/** sets the value of a token in the draft; null: back to the default (no override) */
	setToken: (name: string, value: string | null) => void;
	/** back to the saved overrides; with a name: only that token */
	discard: (name?: string) => void;
	selectedToken: string | null;
	selectToken: (name: string | null) => void;
};

export const DataContext = createContext<Data | null>(null);

export function useData(): Data {
	const data = useContext(DataContext);
	if (!data) {
		throw new Error('useData outside of EmbeddedData');
	}
	return data;
}
