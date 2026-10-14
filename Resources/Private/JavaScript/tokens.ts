import type { Token, TokenGroup, Tokens } from './protocol';

/**
 * The value a token has for a site: its override, else its default; references to other tokens (var(--…)) resolved,
 * so the interface can show a color without the stylesheet of the website
 */
export function resolveToken(name: string, tokens: Map<string, Token>, overrides: Record<string, string>, depth = 0): string {
	const value = overrides[name] ?? tokens.get(name)?.value ?? '';
	if (depth > 8) {
		return value;
	}
	return value.replace(/var\((--[\w-]+)\)/g, (match, reference: string) =>
		tokens.has(reference) ? resolveToken(reference, tokens, overrides, depth + 1) : match
	);
}

/** the name without "--" and the prefix of its type: "--color-brand" → "brand", "--spacing-16" → "spacing-16" */
export const shortName = (name: string) => name.replace(/^--color-/, '').replace(/^--/, '');

/** a value as it is read best: "var(--color-sd-50)" → "sd-50" */
export const shortValue = (value: string) => value.replace(/^var\((--[\w-]+)\)$/, (_, name: string) => shortName(name));

/** a group of numbered steps of one color ("--color-sd-10" … "--color-sd-100") */
export const isScaleGroup = (tokens: Token[]) =>
	tokens.length > 0 && tokens.every((token) => token.type === 'color' && /-\d+$/.test(token.name));

export type Kind = { id: string; label: string; groups: TokenGroup[] };

/**
 * The navigation of the tokens: the kinds of the adapter with their groups (references first, scales last); without
 * kinds every group is a kind of its own
 */
export function kindsOf(tokens: Tokens): Kind[] {
	const inGroup = (group: TokenGroup) => tokens.tokens.filter((token) => token.group === group.id);
	// what components use first: groups that refer to other tokens (semantic colors), then values, then scales
	const rank = (group: TokenGroup) => {
		const tokens = inGroup(group);
		if (isScaleGroup(tokens)) {
			return 2;
		}
		return tokens.filter((token) => token.value.startsWith('var(')).length > tokens.length / 2 ? 0 : 1;
	};
	const scalesLast = (groups: TokenGroup[]) => [...groups].sort((a, b) => rank(a) - rank(b));
	if (!tokens.kinds?.length) {
		return tokens.groups.map((group) => ({ id: group.id, label: group.label, groups: [group] }));
	}
	return tokens.kinds
		.map((kind) => ({ ...kind, groups: scalesLast(tokens.groups.filter((group) => group.kind === kind.id)) }))
		.filter((kind) => kind.groups.length > 0);
}

/** the scales of a group: "sd" → its steps, in order */
export function scalesOf(tokens: Token[]): [string, Token[]][] {
	const scales = new Map<string, Token[]>();
	for (const token of tokens) {
		const scale = shortName(token.name).replace(/-\d+$/, '');
		scales.set(scale, [...(scales.get(scale) ?? []), token]);
	}
	return [...scales];
}

/** the first family of a font-family value, without quotes: "'Inter', sans-serif" → "Inter" */
export const firstFamily = (value: string) => (value.split(',')[0] ?? '').trim().replace(/^['"]|['"]$/g, '').trim();
