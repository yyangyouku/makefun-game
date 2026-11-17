// The screenshot scenes behind ?shot=start|play|depth|end. Each one is
// staged with the game's own rules from the given seed — the play and
// depth scenes are real delves driven by a simple greedy autopilot (walk
// at the nearest gold, blade or monster; drink when hurt), the end scene
// walks the last step onto the Ember Heart and wins by the real pickup
// rule — so the frame is what a game really looks like, and the same seed
// always stages the same frame.

import { SCREEN_TITLE, SCREEN_PLAY, SCREEN_WON } from './config.js';
import { newRun, loadDepth, playerMove, drinkPotion } from './game.js';
import { distanceField, idx, isFloor } from './world.js';
import { monsterAt, DIRS } from './entities.js';

// The fixed clock the staged turns are stamped with; the boot module
// renders shots at a moment just after it, so damage numbers hang in the
// air and flashes have settled.
const STAGE_NOW = 1000;

/** One autopilot step toward (tx, ty), attacking whatever is in the way. */
function stepToward(state, tx, ty) {
  const field = distanceField(state.tiles, tx, ty);
  const here = field[idx(state.player.x, state.player.y)];
  if (here <= 0) return false;
  for (const dir of DIRS) {
    const nx = state.player.x + dir.x;
    const ny = state.player.y + dir.y;
    if (field[idx(nx, ny)] === here - 1) {
      playerMove(state, dir.x, dir.y, STAGE_NOW);
      return true;
    }
  }
  return false;
}

/** What the autopilot wants next: loot first, then a fight, then the stairs. */
function chooseTarget(state) {
  const fromPlayer = distanceField(state.tiles, state.player.x, state.player.y);
  const dist = (x, y) => fromPlayer[idx(x, y)];
  let best = null;
  let bestScore = Infinity;
  const consider = (x, y, bias) => {
    const d = dist(x, y);
    if (d < 0) return;
    if (d + bias < bestScore) {
      bestScore = d + bias;
      best = { x, y };
    }
  };
  for (const item of state.items) {
    if (item.kind === 'gold') consider(item.x, item.y, -2);
    else if (item.kind === 'weapon') consider(item.x, item.y, -4);
    else if (item.kind === 'potion' && (state.player.potions < 2 || state.player.hp < state.player.maxHp)) {
      consider(item.x, item.y, 0);
    } else if (item.kind === 'heart') consider(item.x, item.y, -6);
  }
  for (const monster of state.monsters) consider(monster.x, monster.y, 0);
  if (state.stairs) consider(state.stairs.x, state.stairs.y, 8);
  return best;
}

/** Play the real game greedily for up to `turns` turns. */
function autopilot(state, turns) {
  for (let i = 0; i < turns && !state.over; i += 1) {
    if (state.player.hp <= 9 && state.player.potions > 0) {
      drinkPotion(state, STAGE_NOW);
      continue;
    }
    const target = chooseTarget(state);
    if (!target || !stepToward(state, target.x, target.y)) break;
  }
}

/** Give the staged delver the spoils of the depths above the one shown. */
function seasonDelver(state, { atk, gold, score, kills, hp, potions, turn }) {
  state.player.atk = atk;
  state.player.hp = hp;
  state.player.potions = potions;
  state.gold = gold;
  state.score = score;
  state.kills = kills;
  state.turn = turn;
}

/**
 * Set `state` to the named scene and return the screen to draw over it and
 * the best score to show. Unknown names stage the title, like the starter.
 */
export function stageShot(name, state) {
  if (name === 'play') {
    newRun(state, state.seed);
    autopilot(state, 44);
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'depth') {
    newRun(state, state.seed);
    seasonDelver(state, { atk: 5, gold: 63, score: 240, kills: 9, hp: 21, potions: 1, turn: 148 });
    state.messages.length = 0;
    loadDepth(state, 4);
    state.messages.push('You descend to depth 4. The dark thickens.');
    autopilot(state, 10);
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'end') {
    newRun(state, state.seed);
    seasonDelver(state, { atk: 7, gold: 148, score: 655, kills: 17, hp: 17, potions: 0, turn: 231 });
    state.messages.length = 0;
    loadDepth(state, 5);
    state.messages.push('You descend to depth 5. The dark thickens.');
    const heart = state.items.find((item) => item.kind === 'heart');
    // Stand beside the Heart, then take the one real step onto it.
    const beside = DIRS
      .map((dir) => ({ x: heart.x + dir.x, y: heart.y + dir.y }))
      .find((tile) => isFloor(state.tiles, tile.x, tile.y) && !monsterAt(state, tile.x, tile.y));
    state.player.x = beside.x;
    state.player.y = beside.y;
    playerMove(state, heart.x - beside.x, heart.y - beside.y, STAGE_NOW);
    return { screen: SCREEN_WON, best: state.score };
  }
  newRun(state, state.seed);
  return { screen: SCREEN_TITLE, best: 0 };
}
