import type { EntrySummary, Token, TokenGroup } from './protocol';
import { shortName } from './tokens';

/** how well a text matches the term: 0 is it, 1 starts with it, 2 a word starts with it, 3 contains it, null not at all */
function rank(text: string, term: string): number | null {
	const lower = text.toLowerCase();
	if (lower === term) {
		return 0;
	}
	if (lower.startsWith(term)) {
		return 1;
	}
	if (new RegExp(`[^a-z0-9]${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(lower)) {
		return 2;
	}
	return lower.includes(term) ? 3 : null;
}

/** the best rank of the texts; the first text (the name) before the others */
function best(texts: string[], term: string): number | null {
	let result: number | null = null;
	texts.forEach((text, index) => {
		const value = rank(text, term);
		if (value !== null) {
			const weighted = index === 0 ? value : value + 4;
			result = result === null ? weighted : Math.min(result, weighted);
		}
	});
	return result;
}

function sorted<T>(items: T[], score: (item: T) => number | null): T[] {
	return items
		.map((item, index) => ({ item, index, score: score(item) }))
		.filter((match): match is { item: T; index: number; score: number } => match.score !== null)
		.sort((a, b) => a.score - b.score || a.index - b.index)
		.map((match) => match.item);
}

export const searchTerm = (search: string) => search.trim().toLowerCase();

/** the entries for a term: title, id, use cases and prop sets (only what the interface shows); best matches first */
export function searchEntries(entries: EntrySummary[], term: string): EntrySummary[] {
	return sorted(entries, (entry) =>
		best(
			[
				entry.title,
				entry.id,
				...entry.useCases.map((variant) => variant.title),
				...entry.propSets.map((variant) => variant.title)
			],
			term
		)
	);
}

/** the tokens for a term: name (with and without its prefix), group; best matches first */
export function searchTokens(tokens: Token[], groups: TokenGroup[], term: string): Token[] {
	const labels = new Map(groups.map((group) => [group.id, group.label]));
	return sorted(tokens, (token) =>
		best([shortName(token.name), token.name, labels.get(token.group) ?? ''], term)
	);
}
