// Keyboard and pointer input, translated into the game's own vocabulary:
// a step in a direction, or one of the actions (confirm, potion, restart,
// mute). The boot module decides what an action means on the screen that
// is showing; this module only listens and names things.

const MOVES = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  w: { x: 0, y: -1 },
  s: { x: 0, y: 1 },
  a: { x: -1, y: 0 },
  d: { x: 1, y: 0 },
  W: { x: 0, y: -1 },
  S: { x: 0, y: 1 },
  A: { x: -1, y: 0 },
  D: { x: 1, y: 0 },
};

const ACTIONS = {
  Enter: 'confirm',
  ' ': 'confirm',
  q: 'potion',
  Q: 'potion',
  r: 'restart',
  R: 'restart',
  m: 'mute',
  M: 'mute',
};

/**
 * Listen on the window and the canvas. `handler` receives
 * {type: 'move', dx, dy} or {type: 'action', action}. Held movement keys
 * repeat on the browser's own key repeat, which is what makes holding an
 * arrow glide the delver step by step.
 */
export function createInput(canvas, handler) {
  window.addEventListener('keydown', (event) => {
    const move = MOVES[event.key];
    if (move) {
      event.preventDefault();
      handler({ type: 'move', dx: move.x, dy: move.y });
      return;
    }
    const action = ACTIONS[event.key];
    if (action) {
      event.preventDefault();
      handler({ type: 'action', action });
    }
  });
  canvas.addEventListener('pointerdown', () => {
    handler({ type: 'action', action: 'confirm' });
  });
}
