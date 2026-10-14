import { useEffect, useMemo, useState } from 'react';
import type { Api } from './api';
import type { Token } from './protocol';

/**
 * The token overrides as the editor is changing them, on top of the saved ones: checked by the adapter, what the
 * previews get, what differs. The draft lives in the interface until it is saved (neos-ui/data.tsx).
 *
 * @param draft null: no change, the saved overrides
 * @param setDraft null: back to the saved overrides
 */
export function useTokenDraft(
	api: Api,
	tokens: Token[] | undefined,
	overrides: Record<string, string>,
	draft: Record<string, string> | null,
	setDraft: (next: Record<string, string> | null) => void
) {
	const [invalid, setInvalid] = useState<Record<string, string>>({});
	const current = draft ?? overrides;

	// the adapter checks the draft with the rules the website applies; the previews only get valid values
	useEffect(() => {
		if (Object.keys(current).length === 0) {
			setInvalid({});
			return;
		}
		const timer = window.setTimeout(() => {
			api.validate(current)
				.then((result) => setInvalid(Object.fromEntries(result.invalid.map((item) => [item.name, item.reason]))))
				.catch(() => {
					// keep the last result; a failed check does not block editing
				});
		}, 250);
		return () => window.clearTimeout(timer);
	}, [api, current]);

	return useMemo(() => {
		const names = new Set([...Object.keys(current), ...Object.keys(overrides)]);
		return {
			draft: current,
			// what the previews get: the value of every token as it is now (draft, else saved, else default), so a
			// preview loaded before a save stays right without loading again
			previewTokens: Object.fromEntries(
				(tokens ?? [])
					.filter((token) => token.editable)
					.map((token) => [
						token.name,
						(current[token.name] !== undefined && !invalid[token.name] ? current[token.name] : undefined) ??
							overrides[token.name] ??
							token.value
					])
			),
			invalid,
			unsaved: [...names].filter((name) => current[name] !== overrides[name]),
			setToken: (name: string, value: string | null) => {
				const next = { ...current };
				if (value === null || value.trim() === '') {
					delete next[name];
				} else {
					next[name] = value;
				}
				setDraft(next);
			},
			discard: (name?: string) => {
				if (!name) {
					setDraft(null);
					return;
				}
				const next = { ...current };
				if (overrides[name] === undefined) {
					delete next[name];
				} else {
					next[name] = overrides[name];
				}
				setDraft(next);
			}
		};
	}, [current, overrides, invalid, tokens, setDraft]);
}
