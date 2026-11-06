/**
 * The window of a preview of the website (preview.css), for everything that shows one: the stages of the styleguide and,
 * through window.DevclaimPreview (preview.global.ts), the compare of the backend modules.
 */

/**
 * The room of the sheet around a preview, in px of the interface: an element without padding of its own does not touch
 * the edge. Around the iframe, not in it: the page keeps the width of its viewport and the page grid its place.
 */
export const INSET = 12;

/** the color of the window around a page that has none of its own */
export const SHEET = '#fbfaf7';

/** how long the placeholder fades out (preview.css dc-preview-fade-out) */
export const FADE_MS = 180;

export const PLACEHOLDER = 'dc-preview-placeholder';
export const PLACEHOLDER_LEAVING = `${PLACEHOLDER} ${PLACEHOLDER}--leaving`;

/** the placeholder of a window without React */
export function placeholderElement(): HTMLElement {
	const element = document.createElement('div');
	element.className = PLACEHOLDER;
	element.setAttribute('aria-hidden', 'true');
	return element;
}

/** the placeholders in an element fade out over the page */
export function hidePlaceholders(scope: ParentNode) {
	scope.querySelectorAll<HTMLElement>(`.${PLACEHOLDER}`).forEach((element) => {
		element.className = PLACEHOLDER_LEAVING;
		window.setTimeout(() => element.remove(), FADE_MS);
	});
}
