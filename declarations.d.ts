declare module '*.css' {
	const value: { [key: string]: string };
	export default value;
}

// the Neos UI plugin (Resources/Private/JavaScript/neos-ui): provided by the host, see esbuild.mjs
declare module '@neos-project/neos-ui-extensibility' {
	type Registry = { get: (key: string) => any };
	export default function manifest(
		name: string,
		options: Record<string, unknown>,
		bootstrap: (globalRegistry: Registry, context: { store: unknown; frontendConfiguration: any }) => void
	): void;
}

declare module '@neos-project/neos-ui-redux-store' {
	export const selectors: {
		CR: { Nodes: { siteNodeSelector: (state: unknown) => NeosNode | null } };
	};
	export const actions: {
		Changes: {
			persistChanges: (changes: { type: string; subject: string; payload: Record<string, unknown> }[]) => unknown;
		};
		/** reload(null): the page in the canvas again */
		UI: { ContentCanvas: { reload: (uri: string | null) => unknown } };
	};
	export type NeosNode = {
		contextPath?: string;
		name?: string;
		label?: string;
		properties?: Record<string, unknown>;
	};
}
