import * as React from 'react';
import manifest from '@neos-project/neos-ui-extensibility';
import { configure } from './data';
import { connectStore } from './neos';
import { useViewState } from './store';
import { StyleguideView } from './StyleguideView';
import { ToolbarButton } from './ToolbarButton';
import '../App.css';

/** the view below the top bar: a container of the Neos UI, shown while "Styleguide" in the top bar is pressed */
function ViewContainer() {
	const view = useViewState();
	return view.open ? <StyleguideView /> : null;
}

/**
 * The plugin of the Neos UI: "Styleguide" in the top bar opens the styleguide over the content module. It edits the
 * design tokens of the site (property "designTokens" of the site node, NodeTypes/Mixin/DesignTokensMixin).
 */
manifest('@devclaim/neos-styleguide', {}, (globalRegistry, { store, frontendConfiguration }) => {
	const settings = frontendConfiguration['Devclaim.NeosStyleguide'];
	configure(settings?.adapter ?? '/neos/styleguide/api/v1', settings?.fonts ?? null, settings?.sites ?? null);
	connectStore(store);
	const containers = globalRegistry.get('containers');
	containers.set('PrimaryToolbar/Right/DevclaimNeosStyleguide', ToolbarButton, 'before PrimaryToolbar/Right/DimensionSwitcher');
	containers.set('Modals/Devclaim.NeosStyleguide/View', ViewContainer);
});
