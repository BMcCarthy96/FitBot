type Listener = () => void;
const weightListeners = new Set<Listener>();
const themeListeners = new Set<Listener>();

export function onWeightChange(fn: Listener): () => void {
  weightListeners.add(fn);
  return () => weightListeners.delete(fn);
}

export function emitWeightChange(): void {
  weightListeners.forEach((fn) => fn());
}

export function onThemeChange(fn: Listener): () => void {
  themeListeners.add(fn);
  return () => themeListeners.delete(fn);
}

export function emitThemeChange(): void {
  themeListeners.forEach((fn) => fn());
}
