/**
 * The pages of the adapter the interface shows in iframes: the previews of the entries and the page in the content
 * canvas of the Neos UI. They are on the same origin (PROTOCOL.md), so the interface works on their documents itself:
 * an adapter only renders HTML, it needs no script of its own.
 */

// only names and values that cannot leave the declaration: the draft is unsaved input of the editor
const SAFE_NAME = /^--[\w-]+$/;
const UNSAFE_VALUE = /[;{}<>\\]/;

/** the document of an iframe, null while it is loading or if it is not of this origin */
export function frameDocument(frame: HTMLIFrameElement | null | undefined): Document | null {
	try {
		const document = frame?.contentDocument;
		return document && document.readyState !== 'loading' ? document : null;
	} catch {
		return null;
	}
}

/**
 * The draft tokens on top of the page's own: a <style> at the end of its head, after every stylesheet and the saved
 * tokens of the site, so it wins. An empty object removes them.
 */
export function applyDraft(document: Document, overrides: Record<string, string>) {
	let style = document.head.querySelector<HTMLStyleElement>('style[data-styleguide-draft]');
	if (!style) {
		style = document.createElement('style');
		style.dataset.styleguideDraft = '';
	}
	if (document.head.lastElementChild !== style) {
		document.head.append(style);
	}
	const css = Object.entries(overrides)
		.filter(([name, value]) => SAFE_NAME.test(name) && !UNSAFE_VALUE.test(value))
		.map(([name, value]) => `${name}:${value}`)
		.join(';');
	style.textContent = css ? `:root{${css}}` : '';
}

/**
 * A preview stays where it is: links do not open (a click on one does nothing, in this page or another window) and
 * forms are not sent. Buttons, details and the like still work. Captured before the page's own handlers.
 */
export function keepInPlace(document: Document) {
	// not instanceof Element: the nodes of the preview belong to the window of its iframe. The path of the event, so a
	// link inside a web component (shadow DOM) counts too
	const isLink = (node: EventTarget) =>
		'tagName' in node &&
		(node.tagName === 'A' || node.tagName === 'AREA') &&
		(node as unknown as { hasAttribute(name: string): boolean }).hasAttribute('href');
	document.addEventListener(
		'click',
		(event) => {
			if (event.composedPath().some(isLink)) {
				event.preventDefault();
			}
		},
		true
	);
	document.addEventListener('submit', (event) => event.preventDefault(), true);
}

/**
 * The @font-face rules of the fonts editors uploaded (Neos, not the adapter): a <style> in the head, so a font token
 * (draft or saved) can name any of them. An empty string removes it
 */
export function applyFontCss(document: Document, css: string) {
	let style = document.head.querySelector<HTMLStyleElement>('style[data-styleguide-fonts]');
	if (!style) {
		style = document.createElement('style');
		style.dataset.styleguideFonts = '';
		document.head.prepend(style);
	}
	style.textContent = css;
}

/** the page grid of the website over the preview: the adapter draws it for this attribute (manifest features.grid) */
export function showGrid(document: Document, visible: boolean) {
	document.documentElement.toggleAttribute('data-styleguide-grid', visible);
}

/** the color scheme of the preview: the adapter shows it for this attribute (manifest features.colorScheme) */
export function showColorScheme(document: Document, scheme: 'light' | 'dark') {
	document.documentElement.setAttribute('data-color-scheme', scheme);
}

/** what a preview shows: the element with data-styleguide-root, else the body */
export const previewRoot = (document: Document): Element =>
	document.querySelector('[data-styleguide-root]') ?? document.body;

/** the height of what the preview shows: down to the bottom of its root */
export function contentHeight(document: Document): number {
	const root = previewRoot(document);
	return Math.max(1, Math.ceil(root.getBoundingClientRect().bottom + (document.defaultView?.scrollY ?? 0)));
}

/**
 * calls back with the height of what the preview shows (down to the bottom of its root, so the iframe also gets
 * smaller), now and whenever it changes; returns the stop function
 */
export function watchHeight(document: Document, callback: (height: number) => void): () => void {
	const view = document.defaultView;
	if (!view) {
		return () => undefined;
	}
	const measure = () => callback(contentHeight(document));
	const observer = new view.ResizeObserver(measure);
	observer.observe(previewRoot(document));
	observer.observe(document.documentElement);
	measure();
	return () => observer.disconnect();
}

/**
 * The custom properties the style rules of the page apply to the elements of the preview (var(--…) in rules that match
 * one of them): for "Verwendet" of an element
 */
export function usedTokens(document: Document, root: Element = previewRoot(document)): string[] {
	return [...tokenUses(document, root).keys()].sort();
}

/**
 * How the preview uses a token: always, or only in a state of an element (hover, focus …: the rule needs it); and
 * whether one of its elements is seen now (not in a closed accordion, not hidden)
 */
export type TokenUse = { always: boolean; states: string[]; visible: boolean };

/** the states a selector needs (not the parts of an element like ::before, which are always there) */
// not an escaped one in a class name (Tailwind: .hover\:bg-brand-hover:hover, .\[\&\:has\(…\:hover\)\]\:…)
const INTERACTION = /(?<!\\):(hover|focus-visible|focus-within|focus|active|visited|checked|disabled|placeholder-shown|user-invalid|invalid|open)(?![\w-])/g;

/**
 * Whether an element is seen: it has a box, and no ancestor clips it away, also through slots of web components (a
 * closed sl-details keeps its content, at a height of 0 in its shadow DOM)
 */
function isSeen(element: Element): boolean {
	const view = element.ownerDocument.defaultView;
	if (!view || element.getClientRects().length === 0) {
		return false;
	}
	if ('checkVisibility' in element && !element.checkVisibility({ visibilityProperty: true, opacityProperty: true })) {
		return false;
	}
	let current: Element | null = element;
	while (current) {
		const style = view.getComputedStyle(current);
		const box = current.getBoundingClientRect();
		if (style.overflow !== 'visible' && (box.height < 1 || box.width < 1)) {
			return false;
		}
		const root = current.getRootNode();
		current = current.assignedSlot ?? current.parentElement ?? (root instanceof view.ShadowRoot ? root.host : null);
	}
	return true;
}

/**
 * Shows the states of tokens without anyone hovering: the rules that use one of the names and need a state (hover,
 * focus …) once more without it, at the end of the head (no layer: they win). No names: none
 */
export function forceStates(document: Document, names: string[]) {
	let style = document.head.querySelector<HTMLStyleElement>('style[data-styleguide-states]');
	if (!style) {
		style = document.createElement('style');
		style.dataset.styleguideStates = '';
	}
	if (document.head.lastElementChild !== style) {
		document.head.append(style);
	}
	const wanted = new Set(names);
	const rules: string[] = [];
	for (const rule of names.length > 0 ? styleRules(document) : []) {
		const vars = rule.style.cssText.match(/var\(--[\w-]+/g) ?? [];
		if (!vars.some((name) => wanted.has(name.slice(4))) || !INTERACTION.test(rule.selector)) {
			continue;
		}
		INTERACTION.lastIndex = 0;
		const selector = rule.selector.replace(INTERACTION, '');
		try {
			document.querySelector(selector);
		} catch {
			// emptied by removing the state (":not()"): left out
			continue;
		}
		rules.push(`${selector}{${rule.style.cssText}}`);
	}
	INTERACTION.lastIndex = 0;
	style.textContent = rules.join('\n');
}

export function tokenUses(document: Document, root: Element = previewRoot(document)): Map<string, TokenUse> {
	const elements = [root, ...Array.from(root.querySelectorAll('*'))];
	const uses = new Map<string, TokenUse>();
	for (const rule of styleRules(document)) {
		const vars = rule.style.cssText.match(/var\(--[\w-]+/g);
		if (!vars) {
			continue;
		}
		const matched = elements.filter((element) => matches(element, rule.selector));
		if (matched.length === 0) {
			continue;
		}
		const states = [...new Set([...rule.selector.matchAll(INTERACTION)].map((match) => match[1]))];
		const visible = matched.some(isSeen);
		for (const variable of vars) {
			const name = variable.slice(4);
			const use = uses.get(name) ?? { always: false, states: [], visible: false };
			use.always ||= states.length === 0;
			use.states = [...new Set([...use.states, ...states])];
			use.visible ||= visible;
			uses.set(name, use);
		}
	}
	return uses;
}

/** the style rules of the stylesheets of the page, also those inside media queries and layers */
/** a style rule with its whole selector: a nested rule ("&:hover" in "& a" in ".prose") as one */
type StyleRule = { selector: string; style: CSSStyleDeclaration };

/** the selector of a nested rule within the one of its parent: "&" is the parent, without "&" a descendant of it */
function nestedSelector(selector: string, parent: string | null): string {
	if (parent === null) {
		return selector;
	}
	return selector.includes('&') ? selector.split('&').join(`:is(${parent})`) : `:is(${parent}) ${selector}`;
}

function styleRules(document: Document): StyleRule[] {
	const rules: StyleRule[] = [];
	const view = document.defaultView;
	const collect = (list: CSSRuleList, parent: string | null) => {
		for (const rule of Array.from(list)) {
			let inner = parent;
			if (view && rule instanceof view.CSSStyleRule) {
				inner = nestedSelector(rule.selectorText, parent);
				rules.push({ selector: inner, style: rule.style });
			}
			if ('cssRules' in rule && (rule as CSSGroupingRule).cssRules) {
				collect((rule as CSSGroupingRule).cssRules, inner);
			}
		}
	};
	for (const sheet of Array.from(document.styleSheets)) {
		try {
			collect(sheet.cssRules, null);
		} catch {
			// a stylesheet of another origin
		}
	}
	return rules;
}

/**
 * States an element only has while it is used (hover, focus …) and the parts of an element (::before …): a rule for
 * them applies to the element too, "Verwendet" should count it without anyone hovering
 */
const STATES =
	/(?<!\\)::?(?:hover|focus-visible|focus-within|focus|active|visited|checked|disabled|placeholder-shown|user-invalid|invalid|open|before|after|placeholder|file-selector-button|marker|selection)(?![\w-])/g;

function matches(element: Element, selector: string) {
	for (const candidate of [selector, selector.replace(STATES, '')]) {
		try {
			if (element.matches(candidate)) {
				return true;
			}
		} catch {
			// a selector the browser does not take (also one emptied by removing a state, ":not()")
		}
	}
	return false;
}
