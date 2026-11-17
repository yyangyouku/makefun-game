// Boot and the one loop. Emberfall Depths is turn-based — the world only
// moves when the delver does — so the loop's job is to paint: it redraws
// every animation frame (lantern light, drifting embers, floating damage
// numbers) while input events drive the turns. The game moves between
// four screens: title, play, won and lost.
//
// ?seed=N fixes the delve. ?shot=start|play|depth|end (with &seed=N)
// stages that scene instead of running the loop, paints it twice at a
// fixed clock and sets window.__shotReady for a screenshot.

import { SCREEN_TITLE, SCREEN_PLAY, SCREEN_WON, SCREEN_LOST } from './config.js';
import {
  createGame, newRun, playerMove, drinkPotion,
  EV_MOVED, EV_HIT, EV_KILL, EV_HURT, EV_PICKUP, EV_DESCEND, EV_WIN, EV_LOSE, EV_POTION,
} from './game.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer } from './render.js';
import { stageShot } from './shots.js';

const BEST_KEY = 'emberfall-depths-best';
const SHOT_NOW = 1200; // the fixed clock screenshot scenes are painted at

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const state = createGame(seed);
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score lasts the visit.
  }
}

function runShot(name) {
  const scene = stageShot(name, state);
  let painted = 0;
  function paint() {
    renderer.draw(state, scene.screen, scene.best, SHOT_NOW, false);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  let screen = SCREEN_TITLE;
  let best = readBest();
  newRun(state, seed);

  // Screen readers hear the screen changes and the blows that land.
  function announce(message) {
    status.textContent = message;
  }

  function startRun() {
    newRun(state, Math.floor(Math.random() * 4294967296));
    screen = SCREEN_PLAY;
    announce('Delving. Depth 1 of 5.');
  }

  function finishRun() {
    screen = state.over === 'won' ? SCREEN_WON : SCREEN_LOST;
    if (state.score > best) {
      best = state.score;
      saveBest(best);
    }
    announce(
      state.over === 'won'
        ? `Victory. Score ${state.score}.`
        : `You died on depth ${state.depth}. Score ${state.score}.`,
    );
  }

  function react(events) {
    if (events & EV_WIN) audio.win();
    else if (events & EV_LOSE) audio.lose();
    if (events & EV_DESCEND) audio.descend();
    if (events & EV_KILL) audio.kill();
    else if (events & EV_HIT) audio.hit();
    if (events & EV_HURT) {
      audio.hurt();
      announce(`Hit. ${state.player.hp} health left.`);
    }
    if (events & EV_PICKUP) audio.pickup();
    if (events & EV_POTION) audio.potion();
    if (events === EV_MOVED) audio.move();
  }

  createInput(canvas, (input) => {
    audio.unlock();
    if (input.type === 'action' && input.action === 'mute') {
      audio.toggleMute();
      return;
    }
    if (screen === SCREEN_TITLE) {
      if (input.type === 'action' && input.action === 'confirm') {
        screen = SCREEN_PLAY;
        announce('Delving. Depth 1 of 5.');
      }
      return;
    }
    if (screen === SCREEN_WON || screen === SCREEN_LOST) {
      if (input.type === 'action' && (input.action === 'confirm' || input.action === 'restart')) startRun();
      return;
    }
    // Playing.
    if (input.type === 'action' && input.action === 'restart') {
      startRun();
      return;
    }
    const now = performance.now();
    let events = 0;
    if (input.type === 'move') events = playerMove(state, input.dx, input.dy, now);
    else if (input.type === 'action' && input.action === 'potion') events = drinkPotion(state, now);
    else return;
    react(events);
    if (state.over) finishRun();
  });

  function frame(now) {
    requestAnimationFrame(frame);
    state.fx = state.fx.filter((fx) => now - fx.born < 1000);
    renderer.draw(state, screen, best, now, audio.isMuted());
  }

  announce('Emberfall Depths. Press Enter or click to descend.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
