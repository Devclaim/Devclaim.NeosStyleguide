import * as React from 'react';
import { useState } from 'react';
import { ColorSchemes, useColorScheme } from '../components/ColorSchemes';
import { Gallery } from '../components/Gallery';
import { type Size, viewportSizes, Viewports } from '../components/Viewports';
import { useData } from '../context';
import { navigate } from '../route';

// outside of React: the choice stays while the view is open
let lastSize: Size = 'desktop';

/** the elements of a level (or all) in one gallery; whole pages as cards */
export function Elements({ level }: { level: string | null }) {
	const { manifest, entries } = useData();
	const [size, setSize] = useState<Size>(lastSize);
	const [scheme, setScheme] = useColorScheme();
	const width = viewportSizes(manifest.viewports)[size]?.width ?? 1280;
	const shown = entries.filter((entry) => !level || entry.level === level);
	const inGallery = manifest.gallery ? shown.filter((entry) => entry.gallery !== false) : [];
	const alone = shown.filter((entry) => !inGallery.includes(entry));
	const title = level ? (manifest.levels.find((candidate) => candidate.id === level)?.label ?? level) : 'Alle Elemente';

	return (
		<>
			<header className="sg-header">
				<h1>{title}</h1>
				<span className="sg-header__meta">
					{shown.length} {shown.length === 1 ? 'Element' : 'Elemente'}
				</span>
				<span className="sg-header__spacer" />
				{manifest.features.colorScheme && <ColorSchemes value={scheme} onChange={setScheme} />}
				<Viewports
					viewports={manifest.viewports}
					sizes={['mobile', 'desktop']}
					value={size}
					onChange={(next) => {
						lastSize = next;
						setSize(next);
					}}
				/>
			</header>
			<div className="sg-content">
				{inGallery.length > 0 && (
					<Gallery entries={inGallery} width={width} scheme={manifest.features.colorScheme ? scheme : null} />
				)}
				{alone.length > 0 && (
					<section className="sg-section">
						{inGallery.length > 0 && (
							<div className="sg-section__head">
								<h2>Ganze Seiten</h2>
							</div>
						)}
						<div className="sg-cards">
							{alone.map((entry) => (
								<button
									key={entry.id}
									type="button"
									className="sg-card"
									onClick={() => navigate({ screen: 'element', id: entry.id })}
								>
									<span className="sg-card__title">{entry.title}</span>
								</button>
							))}
						</div>
					</section>
				)}
			</div>
		</>
	);
}
