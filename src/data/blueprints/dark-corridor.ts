import { NO_EXITS, RoomBlueprint } from "../RoomBlueprint";
import {
  buildAllWalls,
  buildCeiling,
  buildFloor,
  buildTorch,
} from "../room-kit";

/** Прямой коридор N↔S. */
export const DARK_CORRIDOR_NS: RoomBlueprint = {
  id: "dark_corridor_ns",
  category: "corridor",
  label: "Тёмный коридор N↔S",
  exits: { ...NO_EXITS, n: true, s: true },
  weight: 5,
  footprint: { w: 1, h: 1 },

  build(ctx) {
    const out = [];
    out.push(...buildFloor(ctx));
    out.push(...buildAllWalls(ctx));
    out.push(...buildCeiling(ctx));

    // Факелы через каждые ~4 м вдоль обеих стен
    out.push(...buildTorch(ctx, "w", -0.5));
    out.push(...buildTorch(ctx, "w", +0.5));
    out.push(...buildTorch(ctx, "e", -0.5));
    out.push(...buildTorch(ctx, "e", +0.5));

    return out;
  },
};

/** Прямой коридор W↔E (то же самое, повёрнутое). */
export const DARK_CORRIDOR_WE: RoomBlueprint = {
  id: "dark_corridor_we",
  category: "corridor",
  label: "Тёмный коридор W↔E",
  exits: { ...NO_EXITS, w: true, e: true },
  weight: 5,
  footprint: { w: 1, h: 1 },

  build(ctx) {
    const out = [];
    out.push(...buildFloor(ctx));
    out.push(...buildAllWalls(ctx));
    out.push(...buildCeiling(ctx));

    out.push(...buildTorch(ctx, "n", -0.5));
    out.push(...buildTorch(ctx, "n", +0.5));
    out.push(...buildTorch(ctx, "s", -0.5));
    out.push(...buildTorch(ctx, "s", +0.5));

    return out;
  },
};