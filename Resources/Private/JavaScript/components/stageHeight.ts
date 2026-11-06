import { type CSSProperties, useEffect, useRef } from 'react';

/** how fast a stage follows its preview, in px per ms: the same speed for every distance */
const SPEED = 2.5;
const MIN_MS = 200;
/** a very tall page (a long gallery) still arrives within 1.2 seconds */
const MAX_MS = 1200;

/**
 * The size of a stage (in px of the interface) and how long it moves there. The duration follows the distance (SPEED),
 * so a small change is quick and a big one not hasty. Until the room is measured (measured) the size is a guess: the
 * stage takes its first real size at once, it does not move there.
 */
export function useStageStyle(height: number, width: number, measured: boolean): CSSProperties {
	// the size of the last render: what the stage moves from
	const previous = useRef<{ width: number; height: number } | null>(null);
	const distance = previous.current
		? Math.max(Math.abs(height - previous.current.height), Math.abs(width - previous.current.width))
		: 0;
	const duration = previous.current ? Math.min(MAX_MS, Math.max(MIN_MS, Math.round(distance / SPEED))) : 0;
	useEffect(() => {
		if (measured) {
			previous.current = { width, height };
		}
	}, [width, height, measured]);

	return { width, height, transitionDuration: `${duration}ms` };
}
