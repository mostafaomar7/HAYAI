/**
 * Trailing-edge debounce. Used to keep search inputs from firing one HTTP
 * request per keystroke — the call runs `wait` ms after the last invocation.
 */
export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  wait = 350
): (...args: A) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: A) => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}
