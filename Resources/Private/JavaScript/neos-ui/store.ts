import { useEffect, useState } from 'react';

/** saving the draft into the workspace (data.tsx): its state, shown in the design panel */
export type SaveState = { status: 'idle' | 'saving' | 'saved' | 'invalid' | 'error'; message?: string };

/**
 * The state of the styleguide in the Neos UI, outside of React: the top bar button, the view and the design panel
 * share it, and it survives closing the view (the draft too)
 */
export type ViewState = {
	open: boolean;
	selectedToken: string | null;
	/** the token overrides as the editor is changing them, not saved yet; null: the saved ones */
	draft: Record<string, string> | null;
	save: SaveState;
};

let state: ViewState = { open: false, selectedToken: null, draft: null, save: { status: 'idle' } };
const listeners = new Set<() => void>();

export function setViewState(next: Partial<ViewState>) {
	state = { ...state, ...next };
	listeners.forEach((listener) => listener());
}

export const getViewState = () => state;

/** outside of React: called after every change of the state */
export function subscribeViewState(listener: () => void): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

export function useViewState(): ViewState {
	const [, rerender] = useState(0);
	useEffect(() => {
		const listener = () => rerender((count) => count + 1);
		listeners.add(listener);
		return () => {
			listeners.delete(listener);
		};
	}, []);
	return state;
}
