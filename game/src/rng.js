// Seeded randomness. Every run of Emberfall Depths is driven by one of these
// generators (mulberry32), never by Math.random, so a seed always produces
// the same dungeon, the same monsters and the same fight outcomes — which is
// what makes the ?seed= screenshots reproducible.

/** Turn any integer into a well-mixed 32-bit starting state. */
function mix(seed) {
  let h = (seed >>> 0) || 0x9e3779b9;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * A small deterministic generator. Methods:
 *   next()      float in [0, 1)
 *   int(lo, hi) integer in [lo, hi], inclusive
 *   chance(p)   true with probability p
 *   pick(list)  one element of a non-empty list
 *   shuffle(list) the same list, shuffled in place
 */
export function createRng(seed) {
  let state = mix(seed);
  function next() {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    int(lo, hi) {
      return lo + Math.floor(next() * (hi - lo + 1));
    },
    chance(p) {
      return next() < p;
    },
    pick(list) {
      return list[Math.floor(next() * list.length)];
    },
    shuffle(list) {
      for (let i = list.length - 1; i > 0; i -= 1) {
        const j = Math.floor(next() * (i + 1));
        const tmp = list[i];
        list[i] = list[j];
        list[j] = tmp;
      }
      return list;
    },
  };
}

/**
 * A stable hash of a tile coordinate, in [0, 1). The renderer uses it to give
 * every floor and wall tile its own shade without storing anything, and the
 * world builder uses it to scatter decoration — same tile, same value, every
 * frame and every visit.
 */
export function tileHash(x, y, salt) {
  let h = Math.imul(x + 1, 0x8da6b343) ^ Math.imul(y + 1, 0xd8163841) ^ Math.imul(salt + 1, 0xcb1ab31f);
  h = Math.imul(h ^ (h >>> 13), 0x165667b1);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
