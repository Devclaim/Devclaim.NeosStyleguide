import { useEffect, useState } from 'react';
import { galleryUrl } from './api';
import { frameDocument, usedTokens } from './frames';
import type { EntrySummary, Manifest, Token } from './protocol';
import { editedToken } from './tokens';

/**
 * Where the tokens are used: the entries of the gallery whose elements apply them (usedTokens of each
 * data-styleguide-entry), read once from the gallery page in a hidden iframe and kept while the view lives. A token
 * counts as the one the editor changes: a variant as its semantic token, the line height or paragraph spacing of a
 * text style as its size, a helper of the color scheme ("--shadow-raised-scheme") as its token. Whole pages are not in
 * the gallery, so not here either.
 */
export type TokenUsage = Map<string, string[]>;

let cached: { key: string; usage: Promise<TokenUsage> } | null = null;

const TEXT_DETAIL = /^--(leading-line-height|paragraph-spacing)-/;

/** the token the editor shows for a name the page uses */
export function shownToken(name: string, tokens: Map<string, Token>): string | null {
	const known = tokens.has(name) ? name : tokens.has(name.replace(/-scheme$/, '')) ? name.replace(/-scheme$/, '') : null;
	if (!known) {
		return null;
	}
	const token = editedToken(known, tokens);
	const size = token.replace(TEXT_DETAIL, '--text-size-');
	return size !== token && tokens.has(size) ? size : token;
}

function readUsage(src: string, entries: string[], tokens: Map<string, Token>): Promise<TokenUsage> {
	return new Promise((resolve) => {
		const frame = document.createElement('iframe');
		frame.setAttribute('aria-hidden', 'true');
		frame.tabIndex = -1;
		frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:1280px;height:900px;border:0;visibility:hidden';
		const done = (usage: TokenUsage) => {
			frame.remove();
			resolve(usage);
		};
		const timeout = window.setTimeout(() => done(new Map()), 30000);
		frame.addEventListener('load', () => {
			// a moment for the styles of the page
			window.setTimeout(() => {
				window.clearTimeout(timeout);
				const page = frameDocument(frame);
				const usage: TokenUsage = new Map();
				for (const id of page ? entries : []) {
					const element = page?.querySelector(`[data-styleguide-entry="${CSS.escape(id)}"]`);
					if (!page || !element) {
						continue;
					}
					for (const name of usedTokens(page, element)) {
						const token = shownToken(name, tokens);
						if (token && !(usage.get(token) ?? []).includes(id)) {
							usage.set(token, [...(usage.get(token) ?? []), id]);
						}
					}
				}
				done(usage);
			}, 300);
		});
		frame.src = src;
		document.body.append(frame);
	});
}

/** the usage of the tokens of a site; null while it is read */
export function useTokenUsage(
	manifest: Manifest,
	entries: EntrySummary[],
	site: string,
	tokens: Map<string, Token>
): TokenUsage | null {
	const [usage, setUsage] = useState<TokenUsage | null>(null);
	useEffect(() => {
		const inGallery = entries.filter((entry) => entry.gallery !== false).map((entry) => entry.id);
		const src = galleryUrl(manifest, inGallery, site);
		if (!src) {
			setUsage(new Map());
			return;
		}
		if (cached?.key !== src) {
			cached = { key: src, usage: readUsage(src, inGallery, tokens) };
		}
		let current = true;
		cached.usage.then((result) => current && setUsage(result));
		return () => {
			current = false;
		};
	}, [manifest, entries, site, tokens]);
	return usage;
}
