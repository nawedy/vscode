/**
 * Creates a debounced version of a function.
 * The debounced function will postpone its execution until after the specified wait time
 * has elapsed since the last time it was invoked.
 *
 * @param func The function to debounce
 * @param wait The number of milliseconds to wait
 * @param immediate If true, the function will be called on the leading edge instead of the trailing edge
 * @returns A debounced version of the function
 */
export function debounce<T extends (...args: any[]) => any>(
	func: T,
	wait: number,
	immediate: boolean = false
): (...args: Parameters<T>) => void {
	let timeout: NodeJS.Timeout | null = null;

	return function (this: any, ...args: Parameters<T>): void {
		const callNow = immediate && !timeout;
		const later = () => {
			timeout = null;
			if (!immediate) {
				func.apply(this, args);
			}
		};

		if (timeout) {
			clearTimeout(timeout);
		}
		timeout = setTimeout(later, wait);

		if (callNow) {
			func.apply(this, args);
		}
	};
}
