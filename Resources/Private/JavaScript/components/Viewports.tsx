import * as React from 'react';
import type { Viewport } from '../protocol';

export type Size = 'mobile' | 'tablet' | 'desktop';

/** the widths to choose from: the smallest viewport of the manifest, one around 768 px, the widest up to 1440 px */
export function viewportSizes(viewports: Viewport[]): Partial<Record<Size, Viewport>> {
	const sorted = [...viewports].sort((a, b) => a.width - b.width);
	const mobile = sorted[0];
	const desktop = [...sorted].reverse().find((viewport) => viewport.width <= 1440) ?? sorted[sorted.length - 1];
	const tablet = sorted.find((viewport) => viewport.width >= 700 && viewport.width < (desktop?.width ?? 0));
	return { mobile, tablet, desktop };
}

const ICONS: Record<Size, React.ReactNode> = {
	mobile: (
		<>
			<rect x="7" y="2.5" width="10" height="19" rx="2" />
			<path d="M11 18.5h2" />
		</>
	),
	tablet: <rect x="5" y="3" width="14" height="18" rx="2" />,
	desktop: (
		<>
			<rect x="3" y="4" width="18" height="12" rx="1.5" />
			<path d="M8 20h8M12 16v4" />
		</>
	)
};

const LABELS: Record<Size, string> = { mobile: 'Mobile', tablet: 'Tablet', desktop: 'Desktop' };

/** the width of a preview as icons */
export function Viewports(props: {
	viewports: Viewport[];
	sizes: Size[];
	value: Size;
	onChange: (size: Size) => void;
}) {
	const all = viewportSizes(props.viewports);
	return (
		<div className="sg-segmented" role="group" aria-label="Breite">
			{props.sizes.map((size) => {
				const viewport = all[size];
				return viewport ? (
					<button
						key={size}
						type="button"
						aria-pressed={props.value === size}
						aria-label={`${LABELS[size]}, ${viewport.width} px`}
						title={`${LABELS[size]} (${viewport.width})`}
						onClick={() => props.onChange(size)}
					>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
							{ICONS[size]}
						</svg>
					</button>
				) : null;
			})}
		</div>
	);
}
