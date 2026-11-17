// Dungeon generation: a depth of Emberfall is a scatter of rectangular
// rooms joined by L-shaped corridors, carved into solid rock. The delver
// starts in the first room; the way down (or, on the fifth depth, the Ember
// Heart) waits in the room farthest from the start, so every depth asks for
// a real trek across the dark. Everything is drawn from the run's seeded
// generator, so a seed always carves the same dungeon.

import { COLS, ROWS, MAX_DEPTH } from './config.js';

export const TILE_WALL = 0;
export const TILE_FLOOR = 1;

export function idx(x, y) {
  return y * COLS + x;
}

export function inBounds(x, y) {
  return x >= 0 && x < COLS && y >= 0 && y < ROWS;
}

export function isFloor(tiles, x, y) {
  return inBounds(x, y) && tiles[idx(x, y)] === TILE_FLOOR;
}

function carveRoom(tiles, room) {
  for (let y = room.y; y < room.y + room.h; y += 1) {
    for (let x = room.x; x < room.x + room.w; x += 1) tiles[idx(x, y)] = TILE_FLOOR;
  }
}

function carveH(tiles, x1, x2, y) {
  for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x += 1) tiles[idx(x, y)] = TILE_FLOOR;
}

function carveV(tiles, y1, y2, x) {
  for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y += 1) tiles[idx(x, y)] = TILE_FLOOR;
}

function carveCorridor(tiles, rng, ax, ay, bx, by) {
  if (rng.chance(0.5)) {
    carveH(tiles, ax, bx, ay);
    carveV(tiles, ay, by, bx);
  } else {
    carveV(tiles, ay, by, ax);
    carveH(tiles, ax, bx, by);
  }
}

function roomsOverlap(a, b) {
  return a.x - 1 < b.x + b.w && a.x + a.w + 1 > b.x && a.y - 1 < b.y + b.h && a.y + a.h + 1 > b.y;
}

/**
 * Carve one depth. Returns the tile grid, the rooms, every floor tile (for
 * placing things), where the delver enters, and where the depth's goal is:
 * `stairs` on depths 1-4, `heart` on depth 5.
 */
export function generateLevel(rng, depth) {
  let tiles;
  let rooms;
  // Try whole layouts until one has enough rooms to be interesting; the rng
  // keeps drawing, so the result is still a pure function of the seed.
  for (let attempt = 0; attempt < 60; attempt += 1) {
    tiles = new Uint8Array(COLS * ROWS);
    rooms = [];
    for (let tries = 0; tries < 120 && rooms.length < 10; tries += 1) {
      const room = {
        w: rng.int(4, 9),
        h: rng.int(3, 6),
        x: 0,
        y: 0,
      };
      room.x = rng.int(1, COLS - room.w - 1);
      room.y = rng.int(1, ROWS - room.h - 1);
      room.cx = room.x + Math.floor(room.w / 2);
      room.cy = room.y + Math.floor(room.h / 2);
      if (rooms.some((other) => roomsOverlap(room, other))) continue;
      rooms.push(room);
    }
    if (rooms.length >= 5) break;
  }
  for (const room of rooms) carveRoom(tiles, room);
  for (let i = 1; i < rooms.length; i += 1) {
    carveCorridor(tiles, rng, rooms[i - 1].cx, rooms[i - 1].cy, rooms[i].cx, rooms[i].cy);
  }
  // One extra loop corridor, so there is usually a second way around.
  if (rooms.length >= 4) {
    carveCorridor(tiles, rng, rooms[0].cx, rooms[0].cy, rooms[rooms.length - 1].cx, rooms[rooms.length - 1].cy);
  }

  const startRoom = rooms[0];
  let goalRoom = rooms[0];
  let bestDistance = -1;
  for (const room of rooms) {
    const d = (room.cx - startRoom.cx) ** 2 + (room.cy - startRoom.cy) ** 2;
    if (d > bestDistance) {
      bestDistance = d;
      goalRoom = room;
    }
  }

  const floors = [];
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      if (tiles[idx(x, y)] === TILE_FLOOR) floors.push({ x, y });
    }
  }

  const isDeepest = depth >= MAX_DEPTH;
  return {
    tiles,
    rooms,
    floors,
    startRoom,
    start: { x: startRoom.cx, y: startRoom.cy },
    stairs: isDeepest ? null : { x: goalRoom.cx, y: goalRoom.cy },
    heart: isDeepest ? { x: goalRoom.cx, y: goalRoom.cy } : null,
  };
}

/**
 * Breadth-first distances from (tx, ty) across floor tiles; -1 where the
 * delver's influence never reaches. Monster AI reads this field to walk
 * downhill toward the player through corridors instead of butting into
 * walls. One field per turn serves every monster.
 */
export function distanceField(tiles, tx, ty) {
  const field = new Int16Array(COLS * ROWS).fill(-1);
  if (!isFloor(tiles, tx, ty)) return field;
  const queue = [idx(tx, ty)];
  field[idx(tx, ty)] = 0;
  for (let head = 0; head < queue.length; head += 1) {
    const current = queue[head];
    const cx = current % COLS;
    const cy = Math.floor(current / COLS);
    const next = field[current] + 1;
    const neighbours = [
      [cx + 1, cy],
      [cx - 1, cy],
      [cx, cy + 1],
      [cx, cy - 1],
    ];
    for (const [nx, ny] of neighbours) {
      if (isFloor(tiles, nx, ny) && field[idx(nx, ny)] === -1) {
        field[idx(nx, ny)] = next;
        queue.push(idx(nx, ny));
      }
    }
  }
  return field;
}
