import * as React from 'react';
import { isChanged } from '../components/Rail';
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
	const token = data.selectedToken ? data.tokensByName.get(data.selectedToken) : undefined;
	const changed = data.tokens.tokens.filter((candidate) => isChanged(data, candidate.name)).length;

	return (
		<aside className="sg-panel" aria-label="Design">
			<div className="sg-panel__head">
				<h2>Design</h2>
				<span className="sg-muted">
					{changed === 0 ? 'Alle Tokens im Standard' : `${changed} ${changed === 1 ? 'Token geändert' : 'Tokens geändert'}`}
				</span>
			</div>
			<div className="sg-panel__body">
				{token ? <TokenEditor token={token} onBack={() => data.selectToken(null)} /> : <TokenBrowser />}
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
