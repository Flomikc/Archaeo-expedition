import { AbstractMesh } from "@babylonjs/core";

import { NO_EXITS, RoomBlueprint, RoomContext } from "../RoomBlueprint";
import {
  boxAt,
  buildAllWalls,
  buildCeiling,
  buildCeilingWithHole,
  buildFloor,
  buildFloorWithHole,
  buildRamp,
  buildTorch,
} from "../room-kit";

type Dir = "n" | "s" | "w" | "e";

function opposite(d: Dir): Dir {
  return d === "n" ? "s" : d === "s" ? "n" : d === "w" ? "e" : "w";
}

/**
 * Находит единственный горизонтальный выход в ctx.doors.
 * У stair_up и stair_landing он всегда ровно один — этого достаточно,
 * чтобы вычислить направление рампы и дыры.
 */
function findHorizontalExit(ctx: RoomContext): Dir | null {
  const found: Dir[] = [];
  if (ctx.doors.n) found.push("n");
  if (ctx.doors.s) found.push("s");
  if (ctx.doors.w) found.push("w");
  if (ctx.doors.e) found.push("e");
  if (found.length !== 1) return null;
  return found[0];
}

/**
 * Дыра в потолке stair_up / в полу landing.
 * Центр — 3 м в сторону T (travel), вытянута вдоль T.
 * Габарит: 4 м в перпендикуляре, 6 м по T.
 */
function holeOffset(T: Dir): { dx: number; dz: number; halfW: number; halfD: number } {
  switch (T) {
    case "n": return { dx: 0,  dz: -3, halfW: 2, halfD: 3 };
    case "s": return { dx: 0,  dz: +3, halfW: 2, halfD: 3 };
    case "e": return { dx: +3, dz: 0,  halfW: 3, halfD: 2 };
    case "w": return { dx: -3, dz: 0,  halfW: 3, halfD: 2 };
  }
}

/**
 * Позиции перил вокруг дыры в landing.
 * Три стороны: не та, через которую игрок выходит (T-сторона открыта).
 */
function railPositions(T: Dir): Array<{ dx: number; dz: number; w: number; d: number }> {
  switch (T) {
    case "n": return [
      { dx: 0,    dz: 0,    w: 4.4, d: 0.2 },
      { dx: -2.2, dz: -3,   w: 0.2, d: 6.4 },
      { dx: +2.2, dz: -3,   w: 0.2, d: 6.4 },
    ];
    case "s": return [
      { dx: 0,    dz: 0,    w: 4.4, d: 0.2 },
      { dx: -2.2, dz: +3,   w: 0.2, d: 6.4 },
      { dx: +2.2, dz: +3,   w: 0.2, d: 6.4 },
    ];
    case "e": return [
      { dx: 0,    dz: 0,    w: 0.2, d: 4.4 },
      { dx: +3,   dz: -2.2, w: 6.4, d: 0.2 },
      { dx: +3,   dz: +2.2, w: 6.4, d: 0.2 },
    ];
    case "w": return [
      { dx: 0,    dz: 0,    w: 0.2, d: 4.4 },
      { dx: -3,   dz: -2.2, w: 6.4, d: 0.2 },
      { dx: -3,   dz: +2.2, w: 6.4, d: 0.2 },
    ];
  }
}

/**
 * Боковые стены (для факелов) — перпендикуляр к направлению T.
 */
function sideWalls(T: Dir): [Dir, Dir] {
  switch (T) {
    case "n": return ["w", "e"];
    case "s": return ["w", "e"];
    case "e": return ["n", "s"];
    case "w": return ["n", "s"];
  }
}

// ═══════════════════════════════════════════════════════════════
//  STAIR_UP
// ═══════════════════════════════════════════════════════════════
//
//  exits и ctx.doors подставляются генератором через exitsOverride.
//  Здесь важно только то, что у blueprint есть РОВНО ОДНА
//  горизонтальная дверь — противоположная направлению рампы.

export const STAIR_UP: RoomBlueprint = {
  id: "stair_up",
  category: "stair",
  label: "Лестница вверх",
  // Статические exits — заглушка, генератор всегда переопределяет.
  exits: { ...NO_EXITS, s: true, up: true },
  weight: 0,
  footprint: { w: 1, h: 1 },

  build(ctx) {
    const out: AbstractMesh[] = [];
    const entry = findHorizontalExit(ctx);
    if (!entry) {
      console.warn("[stair_up] нет горизонтального выхода в ctx.doors");
      return out;
    }
    // Игрок входит с entry, движется в направлении opposite(entry).
    const T = opposite(entry);

    out.push(...buildFloor(ctx));

    out.push(...buildCeilingWithHole(ctx, holeOffset(T)));

    out.push(buildRamp(ctx, T, 6, 6, 4.0, ctx.materials.darkStone));

    out.push(...buildAllWalls(ctx));

    const [s1, s2] = sideWalls(T);
    out.push(...buildTorch(ctx, s1, 0));
    out.push(...buildTorch(ctx, s2, 0));

    return out;
  },
};

// ═══════════════════════════════════════════════════════════════
//  STAIR_LANDING
// ═══════════════════════════════════════════════════════════════

export const STAIR_LANDING: RoomBlueprint = {
  id: "stair_landing",
  category: "stair",
  label: "Лестничная площадка (верх)",
  exits: { ...NO_EXITS, n: true, down: true },
  weight: 0,
  footprint: { w: 1, h: 1 },

  build(ctx) {
    const out: AbstractMesh[] = [];
    const exit = findHorizontalExit(ctx);
    if (!exit) {
      console.warn("[stair_landing] нет горизонтального выхода в ctx.doors");
      return out;
    }
    // На landing горизонтальный выход совпадает с направлением T:
    // игрок выходит из дыры и продолжает двигаться в ту же сторону.
    const T = exit;

    out.push(...buildFloorWithHole(ctx, holeOffset(T)));
    out.push(...buildCeiling(ctx));
    out.push(...buildAllWalls(ctx));

    // Перила вокруг дыры (3 стороны, T-сторона открыта)
    for (const r of railPositions(T)) {
      out.push(boxAt(ctx, "rail", r.dx, r.dz, 0, r.w, 0.8, r.d, ctx.materials.wood));
    }

    const [s1, s2] = sideWalls(T);
    out.push(...buildTorch(ctx, s1, 0.5));
    out.push(...buildTorch(ctx, s2, 0.5));

    return out;
  },
};