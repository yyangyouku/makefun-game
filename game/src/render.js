// Everything the player sees, drawn in code on one canvas: the dungeon's
// warm rock and ember light, the creatures as little painted figures, the
// HUD and message log, and the title and results screens. No images, no
// fonts, no network — just paths and gradients. Depths shift the palette
// as you descend: browns sour into ember reds, and cracks of light appear
// in the floor of the deep places.

import {
  VIEW_WIDTH, VIEW_HEIGHT, TILE, COLS, ROWS, PLAY_Y, LOG_Y, MAX_DEPTH,
  SCREEN_TITLE, SCREEN_WON, SCREEN_LOST,
} from './config.js';
import { TILE_FLOOR, idx } from './world.js';
import { tileHash } from './rng.js';

const FONT_BODY = '13px ui-monospace, Menlo, Consolas, monospace';
const FONT_BODY_BOLD = 'bold 13px ui-monospace, Menlo, Consolas, monospace';
const FONT_SERIF = 'Georgia, "Times New Roman", serif';

function hexRgb(hex) {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

function lerpColor(a, b, t) {
  const ca = hexRgb(a);
  const cb = hexRgb(b);
  const mix = ca.map((v, i) => Math.round(v + (cb[i] - v) * t));
  return `rgb(${mix[0]},${mix[1]},${mix[2]})`;
}

/** The deeper the depth, the darker and redder the rock. */
function depthPalette(depth) {
  const t = (depth - 1) / (MAX_DEPTH - 1);
  return {
    floorA: lerpColor('#2d1e12', '#251016', t),
    floorB: lerpColor('#211608', '#170a0e', t),
    wallFace: lerpColor('#57351e', '#4a2130', t),
    wallTop: lerpColor('#74482a', '#63303c', t),
    wallDark: lerpColor('#150e09', '#100608', t),
  };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function tileCenter(x, y) {
  return { cx: x * TILE + TILE / 2, cy: PLAY_Y + y * TILE + TILE / 2 };
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function fitCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.floor(canvas.clientWidth * dpr);
    const h = Math.floor(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    return { w, h, dpr };
  }

  function drawTiles(state, pal, now) {
    const { tiles, depth } = state;
    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        const px = x * TILE;
        const py = PLAY_Y + y * TILE;
        if (tiles[idx(x, y)] === TILE_FLOOR) {
          ctx.fillStyle = lerpColor(pal.floorB, pal.floorA, tileHash(x, y, depth * 13));
          ctx.fillRect(px, py, TILE, TILE);
          if (tileHash(x, y, 91) > 0.86) {
            ctx.fillStyle = 'rgba(0,0,0,0.22)';
            ctx.fillRect(px + 6 + tileHash(x, y, 7) * 16, py + 6 + tileHash(x, y, 9) * 16, 3, 3);
          }
          // In the deep places the floor itself smoulders.
          if (depth >= 4 && tileHash(x, y, 55) > 0.9) {
            const glow = 0.35 + 0.25 * Math.sin(now / 340 + x * 1.7 + y);
            ctx.strokeStyle = `rgba(255,122,40,${glow.toFixed(3)})`;
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(px + 5, py + 20);
            ctx.lineTo(px + 13, py + 13);
            ctx.lineTo(px + 17, py + 18);
            ctx.lineTo(px + 25, py + 11);
            ctx.stroke();
          }
        } else {
          const floorBelow = y + 1 < ROWS && tiles[idx(x, y + 1)] === TILE_FLOOR;
          const floorNear = floorBelow ||
            (y > 0 && tiles[idx(x, y - 1)] === TILE_FLOOR) ||
            (x > 0 && tiles[idx(x - 1, y)] === TILE_FLOOR) ||
            (x + 1 < COLS && tiles[idx(x + 1, y)] === TILE_FLOOR);
          if (!floorNear) {
            ctx.fillStyle = pal.wallDark;
            ctx.fillRect(px, py, TILE, TILE);
            continue;
          }
          ctx.fillStyle = pal.wallFace;
          ctx.fillRect(px, py, TILE, TILE);
          ctx.fillStyle = pal.wallTop;
          ctx.fillRect(px, py, TILE, 6);
          ctx.fillStyle = 'rgba(0,0,0,0.28)';
          ctx.fillRect(px, py + 15, TILE, 2);
          const seam = 6 + Math.floor(tileHash(x, y, 31) * 16);
          ctx.fillRect(px + seam, py + (y % 2 === 0 ? 6 : 15), 2, 9);
          if (floorBelow) {
            ctx.fillStyle = 'rgba(255,170,80,0.13)';
            ctx.fillRect(px, py + TILE - 4, TILE, 4);
          }
        }
      }
    }
  }

  function drawStairs(state) {
    if (!state.stairs) return;
    const px = state.stairs.x * TILE;
    const py = PLAY_Y + state.stairs.y * TILE;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
    const shades = ['#9a7c52', '#7d6240', '#5f4930'];
    for (let i = 0; i < 3; i += 1) {
      ctx.fillStyle = shades[i];
      ctx.fillRect(px + 5 + i * 3, py + 8 + i * 6, TILE - 10 - i * 4, 5);
    }
    ctx.fillStyle = '#ffd9a0';
    ctx.beginPath();
    ctx.moveTo(px + 13, py + 21);
    ctx.lineTo(px + 17, py + 21);
    ctx.lineTo(px + 15, py + 25);
    ctx.closePath();
    ctx.fill();
  }

  function drawItems(state, now) {
    for (const item of state.items) {
      const { cx, cy } = tileCenter(item.x, item.y);
      if (item.kind === 'gold') {
        ctx.fillStyle = '#f7c948';
        ctx.strokeStyle = '#a86e14';
        ctx.lineWidth = 1;
        for (const [ox, oy] of [[-5, 4], [5, 4], [0, -3]]) {
          ctx.beginPath();
          ctx.arc(cx + ox, cy + oy, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.fillRect(cx - 1.5, cy - 5.5, 2, 2);
      } else if (item.kind === 'potion') {
        ctx.fillStyle = '#d64541';
        ctx.beginPath();
        ctx.arc(cx, cy + 4, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#8e2f28';
        ctx.fillRect(cx - 2.5, cy - 8, 5, 6);
        ctx.fillStyle = '#c9a06a';
        ctx.fillRect(cx - 2, cy - 11, 4, 3);
        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        ctx.fillRect(cx - 3.5, cy + 1, 2.5, 4);
      } else if (item.kind === 'weapon') {
        ctx.strokeStyle = '#e8eef2';
        ctx.lineWidth = 3.4;
        ctx.beginPath();
        ctx.moveTo(cx - 7, cy + 8);
        ctx.lineTo(cx + 8, cy - 9);
        ctx.stroke();
        ctx.strokeStyle = '#ff9a3c';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(cx - 5, cy + 6);
        ctx.lineTo(cx + 8, cy - 9);
        ctx.stroke();
        ctx.strokeStyle = '#d9a441';
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(cx - 10, cy + 3);
        ctx.lineTo(cx - 3, cy + 10);
        ctx.stroke();
        ctx.strokeStyle = '#7a4a21';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx - 7, cy + 8);
        ctx.lineTo(cx - 11, cy + 12);
        ctx.stroke();
      } else if (item.kind === 'heart') {
        const pulse = 1 + 0.08 * Math.sin(now / 260);
        const glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, 30);
        glow.addColorStop(0, 'rgba(255,120,50,0.5)');
        glow.addColorStop(1, 'rgba(255,120,50,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(cx - 30, cy - 30, 60, 60);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(pulse, pulse);
        const grad = ctx.createLinearGradient(0, -13, 0, 13);
        grad.addColorStop(0, '#ffab5e');
        grad.addColorStop(0.55, '#ff5a2a');
        grad.addColorStop(1, '#c22418');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(0, 11);
        ctx.bezierCurveTo(-17, -1, -11, -14, 0, -6);
        ctx.bezierCurveTo(11, -14, 17, -1, 0, 11);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.beginPath();
        ctx.ellipse(-5.5, -5, 3.4, 2.2, -0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  function drawShadow(cx, cy, rx) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawMonster(monster, now) {
    const px = monster.x * TILE;
    const py = PLAY_Y + monster.y * TILE;
    const { cx, cy } = tileCenter(monster.x, monster.y);
    drawShadow(cx, py + TILE - 4, monster.kind === 'brute' ? 12 : 9);
    if (monster.kind === 'imp') {
      ctx.fillStyle = '#8a2a16';
      ctx.beginPath();
      ctx.moveTo(cx - 8, cy - 3);
      ctx.lineTo(cx - 12, cy - 13);
      ctx.lineTo(cx - 2, cy - 9);
      ctx.closePath();
      ctx.moveTo(cx + 8, cy - 3);
      ctx.lineTo(cx + 12, cy - 13);
      ctx.lineTo(cx + 2, cy - 9);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#c33d1e';
      ctx.beginPath();
      ctx.arc(cx, cy + 3, 9.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e86a3a';
      ctx.beginPath();
      ctx.arc(cx, cy + 6, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd23c';
      ctx.fillRect(cx - 5.5, cy - 1, 3, 3);
      ctx.fillRect(cx + 2.5, cy - 1, 3, 3);
    } else if (monster.kind === 'bat') {
      const flap = Math.sin(now / 130 + monster.phase * 3.1) * 3;
      ctx.fillStyle = '#4c4257';
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx + side * 2, cy);
        ctx.quadraticCurveTo(cx + side * 12, cy - 8 + flap, cx + side * 14, cy + 2 + flap);
        ctx.quadraticCurveTo(cx + side * 8, cy + 3, cx + side * 3, cy + 6);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = '#7a6c8f';
      ctx.beginPath();
      ctx.ellipse(cx, cy + 1, 6, 7.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff5a4c';
      ctx.fillRect(cx - 4, cy - 2, 2.4, 2.4);
      ctx.fillRect(cx + 1.6, cy - 2, 2.4, 2.4);
      ctx.fillStyle = '#f2ead8';
      ctx.beginPath();
      ctx.moveTo(cx - 2.5, cy + 4);
      ctx.lineTo(cx - 1, cy + 4);
      ctx.lineTo(cx - 1.8, cy + 6.5);
      ctx.closePath();
      ctx.moveTo(cx + 1, cy + 4);
      ctx.lineTo(cx + 2.5, cy + 4);
      ctx.lineTo(cx + 1.8, cy + 6.5);
      ctx.closePath();
      ctx.fill();
    } else if (monster.kind === 'brute') {
      ctx.fillStyle = '#5d5148';
      roundRect(ctx, px + 2, py + 9, 26, 19, 6);
      ctx.fill();
      ctx.fillStyle = '#6f6156';
      roundRect(ctx, px + 4, py + 3, 22, 17, 6);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,140,58,0.85)';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(px + 10, py + 5);
      ctx.lineTo(px + 13, py + 11);
      ctx.lineTo(px + 11, py + 16);
      ctx.moveTo(px + 21, py + 4);
      ctx.lineTo(px + 19, py + 9);
      ctx.stroke();
      ctx.fillStyle = '#241a12';
      ctx.fillRect(px + 7, py + 11, 16, 3);
      ctx.fillStyle = '#ffb347';
      ctx.fillRect(px + 9, py + 12, 3, 2.6);
      ctx.fillRect(px + 18, py + 12, 3, 2.6);
    } else if (monster.kind === 'wraith') {
      ctx.save();
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = '#4fb3a5';
      ctx.beginPath();
      ctx.moveTo(cx - 9, cy + 12);
      ctx.lineTo(cx - 9, cy - 2);
      ctx.arc(cx, cy - 2, 9, Math.PI, 0);
      ctx.lineTo(cx + 9, cy + 12);
      const wave = Math.sin(now / 300 + monster.phase * 2.4) * 1.6;
      ctx.quadraticCurveTo(cx + 4.5, cy + 8 + wave, cx, cy + 12);
      ctx.quadraticCurveTo(cx - 4.5, cy + 8 - wave, cx - 9, cy + 12);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#0d2f2a';
      ctx.beginPath();
      ctx.ellipse(cx - 3.6, cy - 1, 1.9, 2.8, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + 3.6, cy - 1, 1.9, 2.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx, cy + 4.5, 1.8, 2.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    if (now < monster.flashUntil) {
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy + 2, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    if (monster.hp < monster.maxHp) {
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(px + 3, py - 5, TILE - 6, 4);
      ctx.fillStyle = '#e2483a';
      ctx.fillRect(px + 4, py - 4, (TILE - 8) * (monster.hp / monster.maxHp), 2);
    }
  }

  function drawPlayer(state, now) {
    const player = state.player;
    const px = player.x * TILE;
    const py = PLAY_Y + player.y * TILE;
    const { cx } = tileCenter(player.x, player.y);
    const bob = Math.sin(now / 330) * 1.1;
    const cy = py + TILE / 2 + bob;
    drawShadow(cx, py + TILE - 4, 9);
    // The lantern, held low on the left: a warm point in the dark.
    const glow = ctx.createRadialGradient(cx - 12, cy + 8, 1, cx - 12, cy + 8, 17);
    glow.addColorStop(0, 'rgba(255,190,90,0.55)');
    glow.addColorStop(1, 'rgba(255,190,90,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - 29, cy - 9, 34, 34);
    ctx.fillStyle = '#8a6f4d';
    ctx.fillRect(cx - 14.5, cy + 4, 5, 7);
    ctx.fillStyle = '#ffca6a';
    ctx.fillRect(cx - 13.5, cy + 5.5, 3, 4);
    // Amber robe and hood.
    ctx.fillStyle = '#d98a2b';
    roundRect(ctx, px + 7, py + 9 + bob, 16, 17, 6);
    ctx.fill();
    ctx.fillStyle = '#a8641c';
    ctx.fillRect(px + 7, py + 19 + bob, 16, 2.4);
    ctx.fillStyle = '#ffd9a8';
    ctx.beginPath();
    ctx.arc(cx, cy - 3, 6.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#b8641e';
    ctx.beginPath();
    ctx.arc(cx, cy - 4.5, 7, Math.PI, Math.PI * 2);
    ctx.fill();
    // A short blade at the right hand.
    ctx.strokeStyle = '#e8eef2';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(cx + 8, cy + 5);
    ctx.lineTo(cx + 13, cy + 12);
    ctx.stroke();
    if (now < player.flashUntil) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#ff5a3c';
      ctx.beginPath();
      ctx.arc(cx, cy + 2, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawFloaters(state, now) {
    ctx.font = FONT_BODY_BOLD;
    ctx.textAlign = 'center';
    for (const fx of state.fx) {
      const age = now - fx.born;
      if (age < 0 || age > 950) continue;
      const t = age / 950;
      const { cx } = tileCenter(fx.x, fx.y);
      const cy = PLAY_Y + fx.y * TILE - 4 - t * 20;
      ctx.save();
      ctx.globalAlpha = 1 - t;
      ctx.fillStyle = fx.color;
      ctx.fillText(fx.text, cx, cy);
      ctx.restore();
    }
    ctx.textAlign = 'left';
  }

  function drawAtmosphere(state) {
    const { cx, cy } = tileCenter(state.player.x, state.player.y);
    const light = ctx.createRadialGradient(cx, cy, 30, cx, cy, 330);
    light.addColorStop(0, 'rgba(255,165,70,0.13)');
    light.addColorStop(1, 'rgba(255,165,70,0)');
    ctx.fillStyle = light;
    ctx.fillRect(0, PLAY_Y, VIEW_WIDTH, ROWS * TILE);
    const vignette = ctx.createRadialGradient(480, PLAY_Y + 300, 240, 480, PLAY_Y + 300, 640);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.4)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, PLAY_Y, VIEW_WIDTH, ROWS * TILE);
  }

  function drawHud(state, muted) {
    const player = state.player;
    ctx.fillStyle = '#1a0f08';
    ctx.fillRect(0, 0, VIEW_WIDTH, 48);
    ctx.fillStyle = '#5a3418';
    ctx.fillRect(0, 46, VIEW_WIDTH, 2);
    ctx.font = FONT_BODY_BOLD;
    ctx.textBaseline = 'alphabetic';
    // Health.
    ctx.fillStyle = '#e8b07d';
    ctx.fillText('HP', 16, 30);
    ctx.fillStyle = '#33160f';
    ctx.fillRect(44, 17, 170, 13);
    const hpGrad = ctx.createLinearGradient(44, 0, 214, 0);
    hpGrad.addColorStop(0, '#c22e22');
    hpGrad.addColorStop(1, '#ff7a3c');
    ctx.fillStyle = hpGrad;
    ctx.fillRect(44, 17, 170 * Math.max(0, player.hp / player.maxHp), 13);
    ctx.strokeStyle = 'rgba(255,180,100,0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(44, 17, 170, 13);
    ctx.fillStyle = '#f7e3c2';
    ctx.font = FONT_BODY;
    ctx.fillText(`${player.hp}/${player.maxHp}`, 222, 30);
    // Attack, depth, gold, potions.
    ctx.font = FONT_BODY_BOLD;
    ctx.fillStyle = '#e8b07d';
    ctx.fillText(`ATK ${player.atk}`, 292, 30);
    ctx.fillText(`DEPTH ${state.depth}/${MAX_DEPTH}`, 392, 30);
    ctx.fillStyle = '#f7c948';
    ctx.beginPath();
    ctx.arc(512, 24, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f7e3c2';
    ctx.fillText(`${state.gold}`, 524, 30);
    ctx.fillStyle = '#d64541';
    ctx.beginPath();
    ctx.arc(592, 26, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f7e3c2';
    ctx.fillText(`x${player.potions}`, 602, 30);
    ctx.fillStyle = '#a97d50';
    ctx.font = FONT_BODY;
    ctx.fillText('(Q)', 634, 30);
    // Score and the mute speaker.
    ctx.font = FONT_BODY_BOLD;
    ctx.fillStyle = '#ffe9a8';
    ctx.textAlign = 'right';
    ctx.fillText(`SCORE ${state.score}`, 896, 30);
    ctx.textAlign = 'left';
    ctx.fillStyle = muted ? '#7a5a3a' : '#e8b07d';
    ctx.fillRect(916, 21, 4, 6);
    ctx.beginPath();
    ctx.moveTo(920, 21);
    ctx.lineTo(926, 17);
    ctx.lineTo(926, 31);
    ctx.lineTo(920, 27);
    ctx.closePath();
    ctx.fill();
    if (muted) {
      ctx.strokeStyle = '#e2483a';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(914, 32);
      ctx.lineTo(928, 16);
      ctx.stroke();
    }
  }

  function drawLog(state) {
    ctx.fillStyle = '#120b06';
    ctx.fillRect(0, LOG_Y, VIEW_WIDTH, VIEW_HEIGHT - LOG_Y);
    ctx.fillStyle = '#3a2412';
    ctx.fillRect(0, LOG_Y, VIEW_WIDTH, 2);
    ctx.font = FONT_BODY;
    const lines = state.messages.slice(-3);
    const alphas = [0.38, 0.62, 1];
    lines.forEach((line, i) => {
      const slot = i + (3 - lines.length);
      ctx.fillStyle = `rgba(243,217,174,${alphas[slot]})`;
      ctx.fillText(line, 16, LOG_Y + 24 + slot * 21);
    });
  }

  function drawEmbers(now) {
    for (let i = 0; i < 42; i += 1) {
      const speed = 0.014 + tileHash(i, 3, 9) * 0.03;
      const ex = tileHash(i, 7, 3) * VIEW_WIDTH;
      const ey = VIEW_HEIGHT - ((tileHash(i, 11, 5) * VIEW_HEIGHT + now * speed) % (VIEW_HEIGHT + 30));
      const flicker = 0.35 + 0.4 * Math.abs(Math.sin(now / 500 + i * 1.3));
      ctx.fillStyle = `rgba(255,162,69,${flicker.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(ex, ey, 1 + tileHash(i, 5, 1) * 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawTitle(state, best, now) {
    ctx.fillStyle = 'rgba(8,5,2,0.68)';
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    drawEmbers(now);
    ctx.textAlign = 'center';
    const grad = ctx.createLinearGradient(0, 130, 0, 230);
    grad.addColorStop(0, '#ffe6a3');
    grad.addColorStop(0.6, '#ff8a3c');
    grad.addColorStop(1, '#c33d1e');
    ctx.fillStyle = grad;
    ctx.font = `bold 74px ${FONT_SERIF}`;
    ctx.fillText('EMBERFALL', 480, 208);
    ctx.fillStyle = '#e8c9a0';
    ctx.font = `bold 34px ${FONT_SERIF}`;
    ctx.fillText('D E P T H S', 480, 258);
    ctx.font = `16px ${FONT_SERIF}`;
    ctx.fillStyle = '#d9b98c';
    ctx.fillText('A turn-based delve — five depths down, one Ember Heart', 480, 296);
    ctx.font = `italic 15px ${FONT_SERIF}`;
    ctx.fillStyle = '#a9825e';
    ctx.fillText('The dark took the valley\'s fire. Go down and take it back.', 480, 324);
    // Controls card.
    ctx.fillStyle = 'rgba(20,12,6,0.88)';
    roundRect(ctx, 200, 356, 560, 128, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,150,60,0.4)';
    ctx.lineWidth = 1;
    roundRect(ctx, 200, 356, 560, 128, 10);
    ctx.stroke();
    ctx.font = FONT_BODY;
    ctx.fillStyle = '#f0d7ae';
    const controls = [
      'Move ............ Arrow keys or WASD',
      'Attack .......... walk into a monster',
      'Drink potion .... Q        Restart .... R',
      'Mute ............ M',
    ];
    controls.forEach((line, i) => ctx.fillText(line, 480, 388 + i * 25));
    ctx.font = 'bold 18px ui-monospace, Menlo, Consolas, monospace';
    ctx.fillStyle = `rgba(255,233,168,${(0.65 + 0.35 * Math.sin(now / 380)).toFixed(3)})`;
    ctx.fillText('Press ENTER or click to descend', 480, 548);
    if (best > 0) {
      ctx.font = FONT_BODY;
      ctx.fillStyle = '#a97d50';
      ctx.fillText(`Best delve so far: ${best}`, 480, 584);
    }
    ctx.textAlign = 'left';
  }

  function drawEnd(state, screen, best, now) {
    const won = screen === SCREEN_WON;
    ctx.fillStyle = 'rgba(6,4,2,0.55)';
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    ctx.fillStyle = 'rgba(18,11,6,0.95)';
    roundRect(ctx, 220, 168, 520, 330, 14);
    ctx.fill();
    ctx.strokeStyle = won ? 'rgba(255,170,70,0.65)' : 'rgba(226,72,58,0.55)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, 220, 168, 520, 330, 14);
    ctx.stroke();
    ctx.textAlign = 'center';
    if (won) {
      const grad = ctx.createLinearGradient(0, 210, 0, 260);
      grad.addColorStop(0, '#ffe6a3');
      grad.addColorStop(1, '#ff8a3c');
      ctx.fillStyle = grad;
      ctx.font = `bold 31px ${FONT_SERIF}`;
      ctx.fillText('THE EMBER HEART IS YOURS', 480, 232);
      ctx.fillStyle = '#d9b98c';
      ctx.font = `italic 15px ${FONT_SERIF}`;
      ctx.fillText('You climb back into the light, the Heart warm in your hands.', 480, 262);
    } else {
      ctx.fillStyle = '#ff7a5c';
      ctx.font = `bold 34px ${FONT_SERIF}`;
      ctx.fillText('THE DARK TAKES YOU', 480, 232);
      ctx.fillStyle = '#d9b98c';
      ctx.font = `italic 15px ${FONT_SERIF}`;
      ctx.fillText(`You fell on depth ${state.depth}. The Heart still waits below.`, 480, 262);
    }
    ctx.font = FONT_BODY;
    const rows = [
      ['Score', `${state.score}`],
      ['Gold gathered', `${state.gold}`],
      ['Monsters felled', `${state.kills}`],
      ['Depth reached', `${state.depth} of ${MAX_DEPTH}`],
      ['Turns taken', `${state.turn}`],
      ['Best score', `${Math.max(best, state.score)}`],
    ];
    rows.forEach(([label, value], i) => {
      const y = 306 + i * 27;
      ctx.fillStyle = '#a97d50';
      ctx.textAlign = 'right';
      ctx.fillText(label, 452, y);
      ctx.fillStyle = '#f7e3c2';
      ctx.textAlign = 'left';
      ctx.font = FONT_BODY_BOLD;
      ctx.fillText(value, 472, y);
      ctx.font = FONT_BODY;
    });
    ctx.textAlign = 'center';
    ctx.font = 'bold 16px ui-monospace, Menlo, Consolas, monospace';
    ctx.fillStyle = `rgba(255,233,168,${(0.65 + 0.35 * Math.sin(now / 380)).toFixed(3)})`;
    ctx.fillText('Press R or ENTER to delve again', 480, 474);
    ctx.textAlign = 'left';
  }

  /**
   * Paint one frame. `screen` is one of the config SCREEN_* names; `now` is
   * a millisecond clock (performance.now in play, a fixed value in
   * screenshot mode, which is what makes the shots deterministic).
   */
  function draw(state, screen, best, now, muted) {
    const { w, h, dpr } = fitCanvas();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0d0906';
    ctx.fillRect(0, 0, w, h);
    const scale = Math.min(w / VIEW_WIDTH, h / VIEW_HEIGHT);
    const ox = (w - VIEW_WIDTH * scale) / 2;
    const oy = (h - VIEW_HEIGHT * scale) / 2;
    ctx.setTransform(scale, 0, 0, scale, ox, oy);
    void dpr;

    const pal = depthPalette(state.depth);
    ctx.save();
    if (state.shakeUntil && now < state.shakeUntil) {
      const mag = 3.5 * ((state.shakeUntil - now) / 200);
      ctx.translate(Math.sin(now * 0.11) * mag, Math.cos(now * 0.13) * mag);
    }
    drawTiles(state, pal, now);
    drawStairs(state);
    drawItems(state, now);
    for (const monster of state.monsters) drawMonster(monster, now);
    drawPlayer(state, now);
    drawAtmosphere(state);
    drawFloaters(state, now);
    ctx.restore();

    drawHud(state, muted);
    drawLog(state);
    if (screen === SCREEN_TITLE) drawTitle(state, best, now);
    else if (screen === SCREEN_WON || screen === SCREEN_LOST) drawEnd(state, screen, best, now);
  }

  return { draw };
}
