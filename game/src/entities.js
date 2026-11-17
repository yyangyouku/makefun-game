// The things that live in the depths. Four monster kinds, each with its own
// temper, plus the rules by which they hunt. This module only *plans*: it
// looks at the world and says what a monster wants to do (move, attack, or
// stay); game.js carries the plan out and settles the damage, which keeps
// the fighting rules in one place and the tempers in another.

import { idx, isFloor } from './world.js';

// kind: name and base numbers. `growth` is the HP a kind gains per depth
// below the first; attack creeps up every other depth for all of them.
export const MONSTER_TYPES = {
  imp: { kind: 'imp', name: 'Ember Imp', hp: 5, atk: 2, growth: 1, minDepth: 1, weight: 5 },
  bat: { kind: 'bat', name: 'Ash Bat', hp: 3, atk: 1, growth: 1, minDepth: 1, weight: 4 },
  brute: { kind: 'brute', name: 'Stone Brute', hp: 14, atk: 4, growth: 3, minDepth: 2, weight: 3 },
  wraith: { kind: 'wraith', name: 'Cinder Wraith', hp: 8, atk: 3, growth: 2, minDepth: 3, weight: 2 },
};

export const DIRS = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

/** Attack bonus every kind shares as the delve deepens. */
function depthAtkBonus(depth) {
  return Math.floor((depth - 1) / 2);
}

/** Make one monster of a kind, scaled for the depth it haunts. */
export function spawnMonster(kind, x, y, depth, rng) {
  const base = MONSTER_TYPES[kind];
  const hp = base.hp + base.growth * (depth - 1);
  return {
    kind,
    name: base.name,
    x,
    y,
    hp,
    maxHp: hp,
    atk: base.atk + depthAtkBonus(depth),
    phase: rng.int(0, 1), // brutes move on alternate turns; this staggers them
    flashUntil: 0,
  };
}

/** Choose which kinds haunt a depth, by weight, honouring each kind's first depth. */
export function chooseKinds(rng, depth, count) {
  const pool = [];
  for (const base of Object.values(MONSTER_TYPES)) {
    if (depth < base.minDepth) continue;
    for (let i = 0; i < base.weight; i += 1) pool.push(base.kind);
  }
  const kinds = [];
  for (let i = 0; i < count; i += 1) kinds.push(rng.pick(pool));
  return kinds;
}

export function monsterAt(state, x, y) {
  return state.monsters.find((m) => m.hp > 0 && m.x === x && m.y === y) ?? null;
}

function passable(state, x, y, self) {
  if (!isFloor(state.tiles, x, y)) return false;
  const other = monsterAt(state, x, y);
  return other === null || other === self;
}

function isPlayer(state, x, y) {
  return state.player.x === x && state.player.y === y;
}

/** A step toward the player down the BFS gradient; null when no step helps. */
function stepToward(state, monster) {
  const field = state.distField;
  if (!field) return null;
  const here = field[idx(monster.x, monster.y)];
  if (here <= 0) return null; // unreachable, or already on the player's tile
  let best = null;
  let bestValue = here;
  for (const dir of DIRS) {
    const nx = monster.x + dir.x;
    const ny = monster.y + dir.y;
    if (isPlayer(state, nx, ny)) return { x: nx, y: ny, attack: true };
    if (!passable(state, nx, ny, monster)) continue;
    const value = field[idx(nx, ny)];
    if (value >= 0 && value < bestValue) {
      bestValue = value;
      best = { x: nx, y: ny, attack: false };
    }
  }
  return best;
}

/** A random step to a neighbouring floor tile (never onto the player unless attacking). */
function stepWander(state, monster, rng, allowAttack) {
  const options = [];
  for (const dir of DIRS) {
    const nx = monster.x + dir.x;
    const ny = monster.y + dir.y;
    if (isPlayer(state, nx, ny)) {
      if (allowAttack) options.push({ x: nx, y: ny, attack: true });
      continue;
    }
    if (passable(state, nx, ny, monster)) options.push({ x: nx, y: ny, attack: false });
  }
  if (options.length === 0) return null;
  return rng.pick(options);
}

function chaseOrWander(state, monster, rng, sight) {
  const field = state.distField;
  const distance = field ? field[idx(monster.x, monster.y)] : -1;
  if (distance >= 0 && distance <= sight) {
    return stepToward(state, monster) ?? stepWander(state, monster, rng, true);
  }
  return stepWander(state, monster, rng, true);
}

/**
 * What a monster does on its turn. Returns {x, y, attack} for a step (attack
 * when the step lands on the delver), or null to stay put. Tempers:
 *  - imp:    hunts by the gradient when it can smell the delver, else wanders.
 *  - bat:    flits at random, sometimes twice; bites whatever it lands beside.
 *  - brute:  slow — it only stirs every other turn, but hits like a landslide.
 *  - wraith: glides two steps a turn down the gradient; hard to outrun.
 */
export function planMonsterTurn(state, monster, rng) {
  switch (monster.kind) {
    case 'bat': {
      const first = stepWander(state, monster, rng, true);
      if (!first || first.attack) return first;
      if (rng.chance(0.4)) {
        const ghost = { ...monster, x: first.x, y: first.y };
        const second = stepWander(state, ghost, rng, true);
        if (second) return second;
      }
      return first;
    }
    case 'brute': {
      if ((state.turn + monster.phase) % 2 === 1) return null;
      return chaseOrWander(state, monster, rng, 7);
    }
    case 'wraith': {
      const field = state.distField;
      const distance = field ? field[idx(monster.x, monster.y)] : -1;
      if (distance < 0 || distance > 11) return stepWander(state, monster, rng, true);
      const first = stepToward(state, monster);
      if (!first || first.attack) return first ?? stepWander(state, monster, rng, true);
      const ghost = { ...monster, x: first.x, y: first.y };
      const second = stepToward(state, ghost);
      return second ?? first;
    }
    case 'imp':
    default:
      return chaseOrWander(state, monster, rng, 9);
  }
}
