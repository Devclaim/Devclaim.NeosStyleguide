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

/** the namespaces of the tokens, longest first: a value is read best without its namespace */
const NAMESPACES = ['leading-line-height', 'paragraph-spacing', 'text-size', 'spacing', 'color', 'radius', 'shadow', 'font'];

/** the namespace of a token: "--text-size-display" → "text-size" */
export const namespaceOf = (name: string) =>
	NAMESPACES.find((candidate) => name.replace(/^--/, '').startsWith(`${candidate}-`)) ?? null;

/** the name of a token without "--" and its namespace: "--text-size-head-hl5" → "head-hl5", "--spacing-16" → "16" */
export const valueName = (name: string) => {
	const bare = name.replace(/^--/, '');
	const namespace = NAMESPACES.find((candidate) => bare.startsWith(`${candidate}-`));
	return namespace ? bare.slice(namespace.length + 1) : bare;
};

/** a value as it is read best: "var(--color-sd-50)" → "sd-50", "var(--text-size-head-hl5)" → "head-hl5" */
export const shortValue = (value: string) => value.replace(/^var\((--[\w-]+)\)$/, (_, name: string) => valueName(name));

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

/** the layers of the tokens (PROTOCOL.md, "Layers and variants"): only with an adapter that says them */
export const hasLayers = (tokens: Tokens) => tokens.tokens.some((token) => token.layer !== undefined);

export type Layer = 'semantic' | 'design';

/** what a variant is called in the interface */
export const VARIANT_LABELS: Record<string, string> = {
	light: 'Hell',
	dark: 'Dunkel',
	// from 0 (the variant "-base" of the stylesheets), then from each breakpoint
	base: 'sm',
	md: 'md',
	lg: 'lg',
	xl: 'xl'
};

export const variantLabel = (id: string) => VARIANT_LABELS[id] ?? id;

/** the token an editor works on: the semantic token of a variant, else the token itself */
export const editedToken = (name: string, tokens: Map<string, Token>) => tokens.get(name)?.variantOf ?? name;

/**
 * A text style is three tokens of the same name: size, line height, paragraph spacing. The interface shows and changes
 * them as one, by the size: "--text-size-display" → "--leading-line-height-display", "--paragraph-spacing-display"
 */
const TEXT_SIZE = '--text-size-';
const TEXT_DETAILS = ['--leading-line-height-', '--paragraph-spacing-'];

/** the line height and paragraph spacing that belong to a size token (also of a variant or a design token) */
export const textStyleDetails = (name: string, tokens: Map<string, Token>) =>
	name.startsWith(TEXT_SIZE)
		? TEXT_DETAILS.map((prefix) => prefix + name.slice(TEXT_SIZE.length)).filter((detail) => tokens.has(detail))
		: [];

/**
 * The details of a size token paired with those of another size (a design text style, or the smaller width): the
 * line height and paragraph spacing that change with the size
 */
export const textStyleCounterparts = (size: string, other: string, tokens: Map<string, Token>): [string, string][] =>
	textStyleDetails(size, tokens)
		.map((detail): [string, string] => {
			const prefix = TEXT_DETAILS.find((candidate) => detail.startsWith(candidate)) ?? '';
			return [detail, prefix + other.slice(TEXT_SIZE.length)];
		})
		.filter(([, counterpart]) => tokens.has(counterpart));

/** a line height or paragraph spacing shown with its size */
const isTextStyleDetail = (name: string, names: Set<string>) =>
	TEXT_DETAILS.some((prefix) => name.startsWith(prefix) && names.has(TEXT_SIZE + name.slice(prefix.length)));

/** the tokens of a layer the interface lists: no variants (columns of their token), no details of a text style (rows of their size) */
export function listedTokens(tokens: Tokens, layer: Layer): Token[] {
	const names = new Set(tokens.tokens.map((token) => token.name));
	return tokens.tokens.filter(
		(token) =>
			(token.layer ?? 'design') === layer &&
			!token.variantOf &&
			!isTextStyleDetail(token.name, names)
	);
}

/** the description of a semantic token: its own, else the one of its first variant (the comment is often there) */
export const describe = (token: Token, tokens: Map<string, Token>) =>
	token.description ||
	(token.variants ?? []).map((variant) => tokens.get(variant.token)?.description).find(Boolean) ||
	'';

/**
 * What a variant shows: its value, or, when it takes the one of a smaller width, that value and where it comes from
 */
export function variantValue(
	token: Token,
	variant: string,
	tokens: Map<string, Token>,
	draft: Record<string, string>
): { value: string; from: string | null } {
	let id = variant;
	let from: string | null = null;
	for (let depth = 0; depth < 6; depth++) {
		const name = token.variants?.find((candidate) => candidate.id === id)?.token;
		const value = name ? (draft[name] ?? tokens.get(name)?.value ?? '') : '';
		const inherited = inheritedVariant(token, id, value);
		if (!inherited) {
			return { value, from };
		}
		from = inherited;
		id = inherited;
	}
	return { value: '', from };
}

/** the kinds of a layer, with the groups that have tokens of it */
export function layerKinds(tokens: Tokens, layer: Layer): Kind[] {
	const listed = new Set(listedTokens(tokens, layer).map((token) => token.group));
	return kindsOf(tokens)
		.map((kind) => ({ ...kind, groups: kind.groups.filter((group) => listed.has(group.id)) }))
		.filter((kind) => kind.groups.length > 0);
}

/**
 * The value of a variant that only takes the one of the smaller width ("var(--spacing-loose-base)" for
 * "--spacing-loose-md"): the variant it inherits, else null
 */
export function inheritedVariant(token: Token, variant: string, value: string): string | null {
	const reference = value.match(/^var\((--[\w-]+)\)$/)?.[1];
	return token.variants?.find((other) => other.id !== variant && other.token === reference)?.id ?? null;
}

/** the design tokens a semantic token may point at (its pointsAt groups), in the order of the adapter */
export const designOptions = (token: Token, tokens: Tokens) =>
	tokens.tokens.filter((other) => other.layer === 'design' && (token.pointsAt ?? []).includes(other.group));

/** the design tokens a semantic color may point at as rows: a scale per row, the other colors of a group in one */
export function colorRows(options: Token[]): [string, Token[]][] {
	const rows: [string, Token[]][] = [];
	const groups = [...new Set(options.map((token) => token.group))];
	for (const group of groups) {
		const inGroup = options.filter((token) => token.group === group);
		const steps = inGroup.filter((token) => /-\d+$/.test(token.name));
		const others = inGroup.filter((token) => !/-\d+$/.test(token.name));
		if (others.length > 0) {
			rows.push([group, others]);
		}
		rows.push(...scalesOf(steps));
	}
	return rows;
}
