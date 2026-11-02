import * as React from 'react';
import { setViewState, useViewState } from './store';

/**
 * "Styleguide" in the top bar of the Neos UI: opens and closes the view, on every page. An icon (the top bar shows
 * icons for actions, its title names it); a cross while the view is open, so it is clear the button closes it.
 */
export function ToolbarButton() {
	const view = useViewState();
	const label = view.open ? 'Styleguide schließen' : 'Styleguide';
	return (
		<div id="neos-styleguide-toggle">
			<button type="button" aria-pressed={view.open} aria-label={label} title={label} onClick={() => setViewState({ open: !view.open })}>
				{view.open ? (
					<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
						<path d="M6 6l12 12M18 6L6 18" />
					</svg>
				) : (
					<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
						<circle cx="13.5" cy="6.5" r="1.5" />
						<circle cx="17.5" cy="10.5" r="1.5" />
						<circle cx="8.5" cy="7.5" r="1.5" />
						<circle cx="6.5" cy="12.5" r="1.5" />
						<path d="M12 2a10 10 0 1 0 0 20c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.4A5.6 5.6 0 0 0 22 9.8C22 5.5 17.5 2 12 2z" />
					</svg>
				)}
			</button>
		</div>
	);
}
