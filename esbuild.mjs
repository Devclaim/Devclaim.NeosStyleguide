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

if (isWatch) {
	await (await esbuild.context(options)).watch();
} else {
	await esbuild.build(options);
}
