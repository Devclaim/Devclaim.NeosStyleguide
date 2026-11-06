import './preview.css';
import { pageBackground, settled } from './frames';
import { hidePlaceholders, INSET, placeholderElement, SHEET } from './preview';

/** the bundle for pages without the plugin (esbuild.mjs): Resources/Public/Preview/Preview.js and Preview.css */
Object.assign(window, {
	DevclaimPreview: { inset: INSET, sheet: SHEET, placeholderElement, hidePlaceholders, pageBackground, settled }
});
