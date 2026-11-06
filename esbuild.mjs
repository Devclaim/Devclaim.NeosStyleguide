import * as esbuild from 'esbuild';
import { createRequire } from 'node:module';

const isWatch = process.argv.includes('--watch');
const extensibilityMap = createRequire(import.meta.url)('@neos-project/neos-ui-extensibility/extensibilityMap.json');

/**
 * The plugin of the Neos UI (Resources/Private/JavaScript/neos-ui/index.tsx) → Resources/Public/NeosUi/Plugin.js and
 * Plugin.css (Configuration/Settings.yaml), with React and the Neos UI components of the host (extensibilityMap)
 */
/** @type {import("esbuild").BuildOptions} */
const options = {
	entryPoints: { Plugin: './Resources/Private/JavaScript/neos-ui/index.tsx' },
	outdir: './Resources/Public/NeosUi',
	alias: extensibilityMap,
	sourcemap: false,
	minify: true,
	logLevel: 'info',
	target: 'es2020',
	bundle: true,
	legalComments: 'external'
};

/**
 * The window of a preview for the pages of the backend modules, which have neither React nor the plugin
 * (Resources/Private/JavaScript/preview.global.ts) → Resources/Public/Preview/Preview.js and Preview.css
 */
/** @type {import("esbuild").BuildOptions} */
const previewOptions = {
	entryPoints: { Preview: './Resources/Private/JavaScript/preview.global.ts' },
	outdir: './Resources/Public/Preview',
	minify: true,
	logLevel: 'info',
	target: 'es2020',
	bundle: true,
	format: 'iife'
};

for (const buildOptions of [options, previewOptions]) {
	if (isWatch) {
		await (await esbuild.context(buildOptions)).watch();
	} else {
		await esbuild.build(buildOptions);
	}
}
