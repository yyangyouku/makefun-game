// Emberfall Depths — the numbers everything else is built from: the canvas
// and grid geometry, the five depths, and the balance of the delve (how hard
// things hit, how much heals, what things are worth). Rendering and rules
// both read from here so the game stays tunable in one place.

// The canvas is 960x720. A 48px HUD bar sits on top, a 72px message log at
// the bottom, and between them a 32x20 grid of 30px tiles.
export const VIEW_WIDTH = 960;
export const VIEW_HEIGHT = 720;
export const TILE = 30;
export const COLS = 32;
export const ROWS = 20;
export const HUD_HEIGHT = 48;
export const LOG_HEIGHT = 72;
export const PLAY_Y = HUD_HEIGHT;
export const LOG_Y = HUD_HEIGHT + ROWS * TILE;

// The delve: five depths down, the Ember Heart waits on the fifth.
export const MAX_DEPTH = 5;

// The delver.
export const PLAYER_MAX_HP = 24;
export const PLAYER_BASE_ATK = 3;
export const PLAYER_SIGHT = 9; // monsters further than this mostly mind their own business

// Pickups.
export const POTION_HEAL = 7;
export const WEAPON_BONUS = 2; // attack gained per emberbrand blade taken
export const GOLD_MIN = 5;
export const GOLD_MAX = 20;

// Score.
export const SCORE_KILL = 15;
export const SCORE_DESCEND = 50;
export const SCORE_WIN = 500;
export const SCORE_HP_BONUS = 5; // per HP left when the Heart is seized

/** How many monsters a depth holds: more, the deeper you go. */
export function monsterCount(depth) {
  return 5 + depth * 2;
}

/** How many gold piles a depth scatters. */
export function goldCount(depth) {
  return 4 + depth;
}

/** Potions hidden on a depth: two early, one in the deep places. */
export function potionCount(depth) {
  return depth >= 4 ? 1 : 2;
}

/** An emberbrand blade rests on depths 2 and 4 — one upgrade each. */
export function hasWeapon(depth) {
  return depth === 2 || depth === 4;
}

// Screen names the boot module and renderer share.
export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_WON = 'won';
export const SCREEN_LOST = 'lost';
