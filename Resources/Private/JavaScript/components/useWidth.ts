import { type RefObject, useLayoutEffect, useState } from 'react';

/** the size of an element, observed */
export function useSize(element: RefObject<HTMLElement>) {
	const [size, setSize] = useState({ width: 0, height: 0 });
	useLayoutEffect(() => {
		if (!element.current) {
			return;
		}
		const observer = new ResizeObserver(([entry]) =>
			setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
		);
		observer.observe(element.current);
		return () => observer.disconnect();
	}, [element]);
	return size;
}

/** the width of an element, observed */
export const useWidth = (element: RefObject<HTMLElement>) => useSize(element).width;
