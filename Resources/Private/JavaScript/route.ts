import { useEffect, useState } from 'react';

/** the screens of the styleguide */
export type Route =
	| { screen: 'tokens'; kind: string | null }
	| { screen: 'elements'; level: string | null }
	| { screen: 'element'; id: string };

// outside of React: the view starts where it was when it opens again; not in the URL, which belongs to the Neos UI
let current: Route = { screen: 'tokens', kind: null };
const listeners = new Set<(route: Route) => void>();

export function navigate(route: Route) {
	current = route;
	listeners.forEach((listener) => listener(route));
}

export function useRoute(): Route {
	const [route, setRoute] = useState(current);
	useEffect(() => {
		listeners.add(setRoute);
		setRoute(current);
		return () => {
			listeners.delete(setRoute);
		};
	}, []);
	return route;
}
