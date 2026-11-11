/** FLIP translations scoped to registered sidebar rows; never scale the tree. */
interface Bounds { left: number; top: number; width: number; height: number }
export interface MotionElement {
  ownerDocument?: { defaultView?: MotionEnvironment | null };
  getBoundingClientRect(): Bounds;
  animate?(frames: Array<{ transform: string; opacity?: number }>, options: { duration: number; easing: string }): { cancel(): void };
}
interface MotionEnvironment {
  requestAnimationFrame?(callback: () => void): number;
  cancelAnimationFrame?(id: number): void;
  matchMedia?(query: string): { matches: boolean };
}
export function createLayoutMotion(environment: MotionEnvironment = globalThis as unknown as MotionEnvironment) {
  const rows = new Map<string, MotionElement>();
  const animations = new Map<string, { cancel(): void }>();
  let frame: number | undefined;
  let generation = 0;
  const reduced = () => environment.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? true;
  const cancel = () => {
    generation++;
    if (frame !== undefined) environment.cancelAnimationFrame?.(frame);
    frame = undefined;
    for (const animation of animations.values()) animation.cancel();
    animations.clear();
  };
  return {
    register(key: string, element: MotionElement) {
      // The plugin sandbox may omit browser scheduling globals; use the row's own window.
      if (element.ownerDocument?.defaultView) environment = element.ownerDocument.defaultView;
      rows.set(key, element);
      return () => { if (rows.get(key) === element) rows.delete(key); };
    },
    capture() {
      cancel();
      const before = new Map<string, Bounds>();
      if (!reduced()) for (const [key, element] of rows) {
        const rect = element.getBoundingClientRect();
        if (rect.width && rect.height) before.set(key, rect);
      }
      return before;
    },
    finish(before: ReadonlyMap<string, Bounds>, movedKey: string) {
      if (!before.size || reduced() || !environment.requestAnimationFrame) return;
      const version = generation;
      // Let the saved collection and any newly mounted folder rows commit first.
      frame = environment.requestAnimationFrame(() => {
        frame = environment.requestAnimationFrame?.(() => {
          frame = undefined;
          if (version !== generation || reduced()) return;
          for (const [key, element] of rows) {
            const previous = before.get(key), next = element.getBoundingClientRect();
            if (!previous || !next.width || !next.height || !element.animate) continue;
            const dx = previous.left - next.left, dy = previous.top - next.top;
            if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
            // A reparented row settles locally rather than flying through unrelated folders.
            const limit = key === movedKey ? 32 : 64;
            const x = Math.max(-limit, Math.min(limit, dx)), y = Math.max(-limit, Math.min(limit, dy));
            const animation = element.animate([
              { transform: `translate(${x}px, ${y}px)`, ...(key === movedKey ? { opacity: 0.65 } : {}) },
              { transform: 'translate(0px, 0px)', ...(key === movedKey ? { opacity: 1 } : {}) },
            ], { duration: 180, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' });
            animations.set(key, animation);
          }
        });
      });
    },
    cancel,
  };
}
export const conversationMotionKey = (hostId: string, agentId: string) => `conversation:${JSON.stringify([hostId, agentId])}`;
