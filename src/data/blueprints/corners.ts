import { NO_EXITS, RoomBlueprint } from "../RoomBlueprint";
import {
  buildAllWalls,
  buildCeiling,
  buildFloor,
} from "../room-kit";

type Side = "n" | "s" | "w" | "e";

/** Собирает exits из двух сторон. Например, a="n", b="e" → { n: true, e: true }. */
function exitsOf(a: Side, b: Side) {
  return {
    ...NO_EXITS,
    n: a === "n" || b === "n",
    s: a === "s" || b === "s",
    w: a === "w" || b === "w",
    e: a === "e" || b === "e",
  };
}

/**
 * Фабрика «угловой» комнаты. Всё, что делает — пол, стены, потолок.
 * Wall'ы сами разрежутся на проёмы в нужных местах по exits.
 *
 * Хочешь добавить декор для ВСЕХ углов сразу — правь эту функцию.
 * Хочешь только для одного — переопредели build в отдельном blueprint.
 */
function makeCorner(id: string, label: string, a: Side, b: Side): RoomBlueprint {
  return {
    id,
    category: "corner",
    label,
    exits: exitsOf(a, b),
    weight: 4,
    footprint: { w: 1, h: 1 },

    build(ctx) {
      const out = [];
      out.push(...buildFloor(ctx));
      out.push(...buildAllWalls(ctx));
      out.push(...buildCeiling(ctx));
      return out;
    },
  };
}

// ─── 4 варианта ─────────────────────────────────────────────────────
export const CORNER_NE = makeCorner("corner_ne", "Поворот N↔E", "n", "e");
export const CORNER_NW = makeCorner("corner_nw", "Поворот N↔W", "n", "w");
export const CORNER_SE = makeCorner("corner_se", "Поворот S↔E", "s", "e");
export const CORNER_SW = makeCorner("corner_sw", "Поворот S↔W", "s", "w");