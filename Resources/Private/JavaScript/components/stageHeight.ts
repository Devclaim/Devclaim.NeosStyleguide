import { type CSSProperties, useEffect, useRef } from 'react';

/** how fast a stage follows its preview, in px per ms: the same speed for every distance */
const SPEED = 2.5;
const MIN_MS = 200;
/** a very tall page (a long gallery) still arrives within 1.2 seconds */
const MAX_MS = 1200;

// outside of React: the height of the last shown stage, across screens
let lastHeight: number | null = null;

/**
 * The size of a stage (in px of the interface) and how long it moves there. Its height: the scaled height of its page
 * once there is one; until then the height of the stage shown before, on whatever screen (else the fallback), so a new
 * screen starts where the last one ended and animates once to its page. The duration follows the distance (SPEED), so
 * a small change is quick and a big one not hasty.
 */
export function useStageStyle(hasPage: boolean, pageHeight: number, fallback: number, width: number): CSSProperties {
	const height = hasPage ? pageHeight : (lastHeight ?? fallback);
	// the size of the last render: what the stage moves from
	const previous = useRef<{ width: number; height: number } | null>(null);
	const distance = previous.current
		? Math.max(Math.abs(height - previous.current.height), Math.abs(width - previous.current.width))
		: 0;
	const duration = Math.min(MAX_MS, Math.max(MIN_MS, Math.round(distance / SPEED)));
	useEffect(() => {
		previous.current = { width, height };
		if (hasPage) {
			lastHeight = pageHeight;
		}
	}, [width, height, hasPage, pageHeight]);

	return { width, height, transitionDuration: `${duration}ms` };
}
