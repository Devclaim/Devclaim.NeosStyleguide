import type { EntryDetails, EntrySummary, Manifest, Tokens, Validation } from './protocol';
import { PROTOCOL } from './protocol';

/** the site the styleguide shows: the site node in the Neos UI, its saved token overrides as "--name: value;" lines */
export type Site = { key: string; title: string; designTokens: string | null };

async function getJson<T>(url: string): Promise<T> {
	const response = await fetch(url, { headers: { accept: 'application/json' }, credentials: 'same-origin', redirect: 'manual' });
	if (response.status === 401 || response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400)) {
		throw new Error('Die Sitzung ist abgelaufen. Bitte in Neos neu anmelden.');
	}
	if (!response.ok) {
		throw new Error(`${url}: ${response.status}`);
	}
	return (await response.json()) as T;
}

/** the adapter (PROTOCOL.md), at its base URL (frontendConfiguration "Devclaim.NeosStyleguide", Configuration/Settings.yaml) */
export function createApi(base: string) {
	const adapter = <T>(path: string) => getJson<T & { protocol?: number }>(`${base}${path}`);
	const checked = async <T extends { protocol?: number }>(response: Promise<T>) => {
		const data = await response;
		if (data.protocol !== PROTOCOL) {
			throw new Error(`The adapter speaks protocol ${data.protocol}, the interface ${PROTOCOL}`);
		}
		return data;
	};

	return {
		manifest: () => checked(adapter<Manifest>('/manifest')),
		entries: () => checked(adapter<{ protocol: number; entries: EntrySummary[] }>('/entries')).then((data) => data.entries),
		entry: (id: string) =>
			checked(adapter<{ protocol: number; entry: EntryDetails }>(`/entries/${encodeURIComponent(id)}`)).then(
				(data) => data.entry
			),
		tokens: () => checked(adapter<Tokens>('/tokens')),
		validate: async (overrides: Record<string, string>): Promise<Validation> => {
			const response = await fetch(`${base}/tokens/validate`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', accept: 'application/json' },
				credentials: 'same-origin',
				body: JSON.stringify({ overrides })
			});
			if (response.status === 401) {
				throw new Error('Die Sitzung ist abgelaufen. Bitte in Neos neu anmelden.');
			}
			return checked(response.json() as Promise<Validation>);
		}
	};
}

export type Api = ReturnType<typeof createApi>;

/** the token overrides of a site ("--name: value;" lines) as an object */
export function parseOverrides(designTokens: string | null): Record<string, string> {
	const overrides: Record<string, string> = {};
	for (const line of (designTokens ?? '').split(/\r?\n/)) {
		const match = line.trim().replace(/;$/, '').match(/^(--[\w-]+)\s*:\s*(.+)$/);
		if (match) {
			overrides[match[1]] = match[2].trim();
		}
	}
	return overrides;
}

/** the URL of the preview of an entry (the manifest's template, PROTOCOL.md "Preview") */
export function previewUrl(manifest: Manifest, entry: string, site: string, extra: Record<string, string> = {}) {
	const url = new URL(
		manifest.preview.replace('{entry}', encodeURIComponent(entry)).replace('{site}', encodeURIComponent(site)),
		window.location.origin
	);
	for (const [name, value] of Object.entries(extra)) {
		url.searchParams.set(name, value);
	}
	return url.pathname + url.search;
}

/** overrides as the property stores them: one "--name: value;" per line, sorted by name */
export function serializeOverrides(overrides: Record<string, string>): string {
	return Object.keys(overrides)
		.sort()
		.map((name) => `${name}: ${overrides[name]};`)
		.join('\n');
}

/** the URL of the gallery of entries (the manifest's template, PROTOCOL.md "Gallery"), null if the adapter has none */
export function galleryUrl(manifest: Manifest, entries: string[], site: string): string | null {
	if (!manifest.gallery) {
		return null;
	}
	const url = new URL(
		manifest.gallery
			.replace('{entries}', entries.map(encodeURIComponent).join(','))
			.replace('{site}', encodeURIComponent(site)),
		window.location.origin
	);
	return url.pathname + url.search;
}
