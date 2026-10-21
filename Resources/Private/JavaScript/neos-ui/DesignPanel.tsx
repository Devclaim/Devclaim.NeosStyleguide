import * as React from 'react';
import { StateDot, valueState } from '../components/Rail';
import { TokenBrowser } from '../components/TokenBrowser';
import { TokenEditor } from '../components/TokenEditor';
import { useData } from '../context';
import { useViewState } from './store';

/** only what needs attention: saving itself is silent */
const PROBLEMS: Record<string, string> = {
	invalid: 'Nicht gespeichert, ungültige Werte',
	error: 'Speichern fehlgeschlagen'
};

/**
 * The right column of the styleguide, where the inspector of Neos would be: the editor of the selected token, or every
 * token by kind; a problem with saving. Changes save themselves; publishing is the top bar's.
 */
export function DesignPanel() {
	const data = useData();
	const view = useViewState();
	// a variant opens its semantic token, with the variant chosen
	const selected = data.selectedToken ? data.tokensByName.get(data.selectedToken) : undefined;
	const token = selected?.variantOf ? data.tokensByName.get(selected.variantOf) : selected;
	// every value counts once: a variant, a line height
	const states = data.tokens.tokens.map((candidate) => valueState(data, candidate.name));
	const own = states.filter((state) => state === 'own').length;
	const unpublished = states.filter((state) => state === 'unpublished').length;

	return (
		<aside className="sg-panel" aria-label="Design">
			<div className="sg-panel__head">
				<h2>Design</h2>
				<span className="sg-muted">
					{own + unpublished === 0 ? (
						'Alle Tokens im Standard'
					) : (
						<span className="sg-panel__states">
							{own > 0 && (
								<span>
									<StateDot state="own" /> {own} eigene
								</span>
							)}
							{unpublished > 0 && (
								<span>
									<StateDot state="unpublished" /> {unpublished} unveröffentlicht
								</span>
							)}
						</span>
					)}
				</span>
			</div>
			<div className="sg-panel__body">
				{token ? (
					<TokenEditor
						key={selected?.name}
						token={token}
						variant={selected?.variant}
						onBack={() => data.selectToken(null)}
					/>
				) : (
					<TokenBrowser />
				)}
			</div>
			{PROBLEMS[view.save.status] && (
				<div className="sg-panel__foot" role="alert">
					<div className="sg-panel__status">
						{PROBLEMS[view.save.status]}
						{view.save.message && <span className="sg-panel__message">{view.save.message}</span>}
					</div>
				</div>
			)}
		</aside>
	);
}
