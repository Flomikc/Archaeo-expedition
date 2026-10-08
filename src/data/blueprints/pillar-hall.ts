import { NO_EXITS, RoomBlueprint } from "../RoomBlueprint";
import {
  buildAllWalls,
  buildCeiling,
  buildColumn,
  buildFloor,
  buildTorch,
} from "../room-kit";

export const PILLAR_HALL_NS: RoomBlueprint = {
  id: "pillar_hall_ns",
  category: "hall",
  label: "Колонный зал N↔S",
  exits: { ...NO_EXITS, n: true, s: true },
  weight: 3,
  footprint: { w: 1, h: 1 },

  build(ctx) {
    const out = [];
    out.push(...buildFloor(ctx));
    out.push(...buildAllWalls(ctx));
    out.push(...buildCeiling(ctx));

    // Колонны: две по бокам на севере, две на юге.
    // Отступ от центра: 3.5 м вбок, 4 м вдоль.
    out.push(buildColumn(ctx, -3.5, -4, 4.0, 0.9));
    out.push(buildColumn(ctx, +3.5, -4, 4.0, 0.9));
    out.push(buildColumn(ctx, -3.5, +4, 4.0, 0.9));
    out.push(buildColumn(ctx, +3.5, +4, 4.0, 0.9));

    // Факелы на глухих (западной и восточной) стенах
    out.push(...buildTorch(ctx, "w", 0));
    out.push(...buildTorch(ctx, "e", 0));

    return out;
  },
};

export const PILLAR_HALL_WE: RoomBlueprint = {
  id: "pillar_hall_we",
  category: "hall",
  label: "Колонный зал W↔E",
  exits: { ...NO_EXITS, w: true, e: true },
  weight: 3,
  footprint: { w: 1, h: 1 },

  build(ctx) {
    const out = [];
    out.push(...buildFloor(ctx));
    out.push(...buildAllWalls(ctx));
    out.push(...buildCeiling(ctx));

    out.push(buildColumn(ctx, -4, -3.5, 4.0, 0.9));
    out.push(buildColumn(ctx, -4, +3.5, 4.0, 0.9));
    out.push(buildColumn(ctx, +4, -3.5, 4.0, 0.9));
    out.push(buildColumn(ctx, +4, +3.5, 4.0, 0.9));

    out.push(...buildTorch(ctx, "n", 0));
    out.push(...buildTorch(ctx, "s", 0));

    return out;
  },
};