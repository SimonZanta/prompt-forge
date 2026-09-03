/** `document.querySelector` that throws when the element is missing, so wiring bugs surface immediately. */
export function queryElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element: ${selector}`);
  return element;
}
