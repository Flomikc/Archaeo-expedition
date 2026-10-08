import { NO_EXITS, RoomBlueprint } from "../RoomBlueprint";
import {
  buildAllWalls,
  buildCeiling,
  buildFloorWithHole,
  buildTorch,
} from "../room-kit";

export const PIT_CORRIDOR_NS: RoomBlueprint = {
  id: "pit_corridor_ns",
  category: "trap",
  label: "Коридор с дырой N↔S",
  exits: { ...NO_EXITS, n: true, s: true },
  weight: 2,
  footprint: { w: 1, h: 1 },

  build(ctx) {
    const out = [];
    // Дыра 4×6 по центру; обход по 5 м с каждой стороны по X.
    out.push(...buildFloorWithHole(ctx, {
      dx: 0, dz: 0,
      halfW: 2, halfD: 3,
    }));
    out.push(...buildAllWalls(ctx));
    out.push(...buildCeiling(ctx));
    out.push(...buildTorch(ctx, "w", 0));
    out.push(...buildTorch(ctx, "e", 0));
    return out;
  },
};

export const PIT_CORRIDOR_WE: RoomBlueprint = {
  id: "pit_corridor_we",
  category: "trap",
  label: "Коридор с дырой W↔E",
  exits: { ...NO_EXITS, w: true, e: true },
  weight: 2,
  footprint: { w: 1, h: 1 },

  build(ctx) {
    const out = [];
    out.push(...buildFloorWithHole(ctx, {
      dx: 0, dz: 0,
      halfW: 3, halfD: 2,
    }));
    out.push(...buildAllWalls(ctx));
    out.push(...buildCeiling(ctx));
    out.push(...buildTorch(ctx, "n", 0));
    out.push(...buildTorch(ctx, "s", 0));
    return out;
  },
};