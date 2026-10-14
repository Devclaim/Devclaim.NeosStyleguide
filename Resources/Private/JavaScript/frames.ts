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
	const rules: CSSStyleRule[] = [];
	const view = document.defaultView;
	const collect = (list: CSSRuleList) => {
		for (const rule of Array.from(list)) {
			if (view && rule instanceof view.CSSStyleRule) {
				rules.push(rule);
			}
			if ('cssRules' in rule && (rule as CSSGroupingRule).cssRules) {
				collect((rule as CSSGroupingRule).cssRules);
			}
		}
	};
	for (const sheet of Array.from(document.styleSheets)) {
		try {
			collect(sheet.cssRules);
		} catch {
			// a stylesheet of another origin
		}
	}
	const elements = [root, ...Array.from(root.querySelectorAll('*'))];
	const names = new Set<string>();
	for (const rule of rules) {
		const vars = rule.style.cssText.match(/var\(--[\w-]+/g);
		if (vars && elements.some((element) => matches(element, rule.selectorText))) {
			vars.forEach((name) => names.add(name.slice(4)));
		}
	}
	return [...names].sort();
}

function matches(element: Element, selector: string) {
	try {
		return element.matches(selector);
	} catch {
		return false;
	}
}
