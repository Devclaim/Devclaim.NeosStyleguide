import * as React from 'react';
import { useEffect, useState } from 'react';

/** the color scheme of the previews (manifest features.colorScheme): light or dark, the same in every screen */
export type ColorScheme = 'light' | 'dark';

// outside of React: the choice stays while the view is open, and is the same for the elements and one element
let current: ColorScheme = 'light';
const listeners = new Set<(scheme: ColorScheme) => void>();

export function useColorScheme(): [ColorScheme, (scheme: ColorScheme) => void] {
	const [scheme, setScheme] = useState(current);
	useEffect(() => {
		listeners.add(setScheme);
		setScheme(current);
		return () => {
			listeners.delete(setScheme);
		};
	}, []);
	const change = (next: ColorScheme) => {
		current = next;
		listeners.forEach((listener) => listener(next));
	};
	return [scheme, change];
}

const ICONS: Record<ColorScheme, React.ReactNode> = {
	light: (
		<>
			<circle cx="12" cy="12" r="4" />
			<path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
		</>
	),
	dark: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
};

const LABELS: Record<ColorScheme, string> = { light: 'Hell', dark: 'Dunkel' };

/** light and dark as icons, like the widths (Viewports) */
export function ColorSchemes({ value, onChange }: { value: ColorScheme; onChange: (scheme: ColorScheme) => void }) {
	return (
		<div className="sg-segmented" role="group" aria-label="Farbschema">
			{(['light', 'dark'] as const).map((scheme) => (
				<button
					key={scheme}
					type="button"
					aria-pressed={value === scheme}
					aria-label={LABELS[scheme]}
					title={LABELS[scheme]}
					onClick={() => onChange(scheme)}
				>
					<svg
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="1.8"
						strokeLinecap="round"
						strokeLinejoin="round"
						aria-hidden="true"
					>
						{ICONS[scheme]}
					</svg>
				</button>
			))}
		</div>
	);
}
