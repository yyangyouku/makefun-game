// The delve itself: the run's state and the rules that change it. A run is
// five depths of turn-based crawling — the delver acts (move, bump to
// attack, drink), then every monster acts, then the depth judges the
// result. All randomness flows from the run's seeded generator, and every
// change worth hearing about is reported back as an event bitmask so the
// boot module can answer with sound and announcements.

import {
  MAX_DEPTH, PLAYER_MAX_HP, PLAYER_BASE_ATK, POTION_HEAL, WEAPON_BONUS,
  GOLD_MIN, GOLD_MAX, SCORE_KILL, SCORE_DESCEND, SCORE_WIN, SCORE_HP_BONUS,
  monsterCount, goldCount, potionCount, hasWeapon,
} from './config.js';
import { createRng } from './rng.js';
import { generateLevel, distanceField, isFloor } from './world.js';
import { spawnMonster, chooseKinds, monsterAt, planMonsterTurn } from './entities.js';

export const EV_MOVED = 1;
export const EV_HIT = 2;
export const EV_KILL = 4;
export const EV_HURT = 8;
export const EV_PICKUP = 16;
export const EV_DESCEND = 32;
export const EV_WIN = 64;
export const EV_LOSE = 128;
export const EV_POTION = 256;

export function createGame(seed) {
  return {
    seed,
    rng: createRng(seed),
    depth: 1,
    tiles: null,
    stairs: null,
    heartPos: null,
    distField: null,
    player: null,
    monsters: [],
    items: [],
    messages: [],
    fx: [],
    turn: 0,
    kills: 0,
    gold: 0,
    score: 0,
    over: null, // null while delving; 'won' or 'lost' when the run ends
  };
}

function log(state, text) {
  state.messages.push(text);
  if (state.messages.length > 40) state.messages.shift();
}

function floater(state, x, y, text, color, now) {
  state.fx.push({ x, y, text, color, born: now });
  if (state.fx.length > 24) state.fx.shift();
}

function itemAt(state, x, y) {
  return state.items.find((item) => item.x === x && item.y === y) ?? null;
}

/** Pick `count` distinct floor tiles that satisfy `okay`, in random order. */
function scatter(state, floors, count, okay) {
  const shuffled = state.rng.shuffle([...floors]);
  const chosen = [];
  for (const tile of shuffled) {
    if (chosen.length >= count) break;
    if (okay(tile)) chosen.push(tile);
  }
  return chosen;
}

/** Generate a depth and place the delver, the monsters and the loot. */
export function loadDepth(state, depth) {
  const rng = state.rng;
  const level = generateLevel(rng, depth);
  state.depth = depth;
  state.tiles = level.tiles;
  state.stairs = level.stairs;
  state.heartPos = level.heart;
  state.player.x = level.start.x;
  state.player.y = level.start.y;
  state.monsters = [];
  state.items = [];
  state.fx = [];

  const taken = new Set([`${level.start.x},${level.start.y}`]);
  // The goal tile is claimed before anything scatters, so no monster or
  // lesser loot can sit on the stairs or the Ember Heart and block the
  // step that ends the depth.
  if (level.stairs) taken.add(`${level.stairs.x},${level.stairs.y}`);
  if (level.heart) taken.add(`${level.heart.x},${level.heart.y}`);
  const free = (tile) => !taken.has(`${tile.x},${tile.y}`);
  const claim = (tile) => {
    taken.add(`${tile.x},${tile.y}`);
    return tile;
  };
  const inStartRoom = (tile) =>
    tile.x >= level.startRoom.x && tile.x < level.startRoom.x + level.startRoom.w &&
    tile.y >= level.startRoom.y && tile.y < level.startRoom.y + level.startRoom.h;

  // Monsters never spawn in the room the delver enters by.
  const kinds = chooseKinds(rng, depth, monsterCount(depth));
  const lairs = scatter(state, level.floors, kinds.length, (tile) => free(tile) && !inStartRoom(tile));
  lairs.forEach((tile, i) => {
    claim(tile);
    state.monsters.push(spawnMonster(kinds[i], tile.x, tile.y, depth, rng));
  });

  for (const tile of scatter(state, level.floors, goldCount(depth), free)) {
    claim(tile);
    state.items.push({ kind: 'gold', x: tile.x, y: tile.y, amount: rng.int(GOLD_MIN, GOLD_MAX) });
  }
  for (const tile of scatter(state, level.floors, potionCount(depth), free)) {
    claim(tile);
    state.items.push({ kind: 'potion', x: tile.x, y: tile.y });
  }
  if (hasWeapon(depth)) {
    const [tile] = scatter(state, level.floors, 1, free);
    if (tile) {
      claim(tile);
      state.items.push({ kind: 'weapon', x: tile.x, y: tile.y });
    }
  }
  if (level.heart) {
    state.items.push({ kind: 'heart', x: level.heart.x, y: level.heart.y });
    log(state, 'The Ember Heart pulses somewhere on this depth. Seize it!');
  }
  state.distField = distanceField(state.tiles, state.player.x, state.player.y);
}

/** Start (or restart) a run: fresh delver, fresh depths, from `seed`. */
export function newRun(state, seed) {
  state.seed = seed;
  state.rng = createRng(seed);
  state.player = {
    x: 0,
    y: 0,
    hp: PLAYER_MAX_HP,
    maxHp: PLAYER_MAX_HP,
    atk: PLAYER_BASE_ATK,
    potions: 1,
    flashUntil: 0,
  };
  state.turn = 0;
  state.kills = 0;
  state.gold = 0;
  state.score = 0;
  state.over = null;
  state.messages = [];
  state.shakeUntil = 0;
  loadDepth(state, 1);
  log(state, 'You light your lantern and step into Emberfall.');
  log(state, 'Depth 1 — find the stairs down. The Heart waits on depth 5.');
}

function attackMonster(state, monster, now) {
  const player = state.player;
  const damage = player.atk + state.rng.int(0, 2);
  monster.hp -= damage;
  monster.flashUntil = now + 160;
  floater(state, monster.x, monster.y, `-${damage}`, '#ffd9a0', now);
  let events = EV_HIT;
  if (monster.hp <= 0) {
    state.kills += 1;
    state.score += SCORE_KILL;
    events |= EV_KILL;
    log(state, `The ${monster.name} bursts into sparks.`);
    if (state.rng.chance(0.3)) {
      state.items.push({ kind: 'gold', x: monster.x, y: monster.y, amount: state.rng.int(GOLD_MIN, GOLD_MAX) });
    }
  } else {
    log(state, `You strike the ${monster.name} for ${damage}.`);
  }
  return events;
}

function hurtPlayer(state, monster, now) {
  const player = state.player;
  const damage = Math.max(1, monster.atk + state.rng.int(-1, 1));
  player.hp -= damage;
  player.flashUntil = now + 220;
  state.shakeUntil = now + 200;
  floater(state, player.x, player.y, `-${damage}`, '#ff7a5c', now);
  log(state, `The ${monster.name} hits you for ${damage}.`);
  if (player.hp <= 0) {
    player.hp = 0;
    state.over = 'lost';
    log(state, 'The dark takes you.');
    return EV_HURT | EV_LOSE;
  }
  return EV_HURT;
}

/** After the delver acts, every living monster takes its turn. */
function monstersTurn(state, now) {
  state.distField = distanceField(state.tiles, state.player.x, state.player.y);
  let events = 0;
  for (const monster of state.monsters) {
    if (state.over) break;
    if (monster.hp <= 0) continue;
    const plan = planMonsterTurn(state, monster, state.rng);
    if (!plan) continue;
    if (plan.attack) {
      events |= hurtPlayer(state, monster, now);
    } else if (!monsterAt(state, plan.x, plan.y)) {
      monster.x = plan.x;
      monster.y = plan.y;
    }
  }
  state.monsters = state.monsters.filter((m) => m.hp > 0);
  return events;
}

function endTurn(state, now, events) {
  state.turn += 1;
  return events | monstersTurn(state, now);
}

function pickUp(state, item, now) {
  const player = state.player;
  let events = EV_PICKUP;
  if (item.kind === 'gold') {
    state.gold += item.amount;
    state.score += item.amount;
    log(state, `You scoop up ${item.amount} gold.`);
  } else if (item.kind === 'potion') {
    player.potions += 1;
    log(state, 'You pocket an emberwine potion. Press Q to drink.');
  } else if (item.kind === 'weapon') {
    player.atk += WEAPON_BONUS;
    floater(state, player.x, player.y, 'ATK UP!', '#ffe9a8', now);
    log(state, `You take up an emberbrand blade. Attack is now ${player.atk}.`);
  } else if (item.kind === 'heart') {
    state.score += SCORE_WIN + player.hp * SCORE_HP_BONUS;
    state.over = 'won';
    events |= EV_WIN;
    log(state, 'You seize the Ember Heart. Its warmth floods the dark.');
  }
  state.items = state.items.filter((other) => other !== item);
  return events;
}

/**
 * The delver's step: bump a monster to attack it, step onto loot to take
 * it, step on the stairs to descend. Walls refuse the step and cost no
 * turn. Returns the events that happened, the delver's and the monsters'.
 */
export function playerMove(state, dx, dy, now) {
  if (state.over) return 0;
  const player = state.player;
  const nx = player.x + dx;
  const ny = player.y + dy;
  const target = monsterAt(state, nx, ny);
  if (target) return endTurn(state, now, attackMonster(state, target, now));
  if (!isFloor(state.tiles, nx, ny)) return 0;

  player.x = nx;
  player.y = ny;
  let events = EV_MOVED;

  const item = itemAt(state, nx, ny);
  if (item) {
    events |= pickUp(state, item, now);
    if (state.over) return events; // the Heart ends the run on the spot
  }
  if (state.stairs && state.stairs.x === nx && state.stairs.y === ny) {
    state.score += SCORE_DESCEND;
    const next = state.depth + 1;
    loadDepth(state, next);
    log(state, `You descend to depth ${next}. The dark thickens.`);
    return events | EV_DESCEND;
  }
  return endTurn(state, now, events);
}

/** Drink a potion: heals, and costs a turn — the dark does not wait. */
export function drinkPotion(state, now) {
  if (state.over) return 0;
  const player = state.player;
  if (player.potions <= 0) {
    log(state, 'You have no potions left.');
    return 0;
  }
  if (player.hp >= player.maxHp) {
    log(state, 'You are unhurt — save it for the dark.');
    return 0;
  }
  player.potions -= 1;
  const healed = Math.min(POTION_HEAL, player.maxHp - player.hp);
  player.hp += healed;
  floater(state, player.x, player.y, `+${healed}`, '#9fe870', now);
  log(state, `You drink deep. ${healed} health returns.`);
  return endTurn(state, now, EV_POTION);
}
