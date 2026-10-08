import { MeshBuilder } from "@babylonjs/core";

import { NO_EXITS, RoomBlueprint, RoomContext } from "../RoomBlueprint";
import {
  buildAllWalls,
  buildCeiling,
  buildFloor,
  buildTorch,
} from "../room-kit";

type Side = "n" | "s" | "w" | "e";

const OPPOSITE: Record<Side, Side> = { n: "s", s: "n", w: "e", e: "w" };

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
 * Ручей — плоский бокс вдоль указанной стены.
 * Уровень воды чуть выше пола (+0.15), глубина условная.
 *
 * @param side  "n" | "s" | "w" | "e" — вдоль какой стены течёт
 */
function buildStream(ctx: RoomContext, side: Side) {
  const T = 1.6;                 // ширина ручья
  const inset = 0.5;             // отступ от стены (там, где стена)
  const length = (side === "n" || side === "s") ? ctx.sizeX : ctx.sizeZ;
  const water = MeshBuilder.CreateBox(
    "stream",
    side === "n" || side === "s"
      ? { width: length - 1, height: 0.2, depth: T }
      : { width: T, height: 0.2, depth: length - 1 },
    ctx.scene
  );

  // Позиция вдоль стены
  let dx = 0, dz = 0;
  if (side === "n") dz = -ctx.sizeZ / 2 + inset + T / 2;
  if (side === "s") dz = +ctx.sizeZ / 2 - inset - T / 2;
  if (side === "w") dx = -ctx.sizeX / 2 + inset + T / 2;
  if (side === "e") dx = +ctx.sizeX / 2 - inset - T / 2;

  water.position.set(ctx.centerX + dx, ctx.floorY + 0.05, ctx.centerZ + dz);
  water.material = ctx.materials.water;
  water.checkCollisions = false;
  water.isPickable = false;
  return water;
}

function makeCornerStream(id: string, label: string, a: Side, b: Side): RoomBlueprint {
  return {
    id,
    category: "special",
    label,
    exits: exitsOf(a, b),
    weight: 2,
    footprint: { w: 1, h: 1 },

    build(ctx) {
      const out = [];
      out.push(...buildFloor(ctx));
      out.push(...buildAllWalls(ctx));
      out.push(...buildCeiling(ctx));

      // Ручей течёт вдоль стены напротив ПЕРВОГО выхода
      const streamSide = OPPOSITE[a];
      out.push(buildStream(ctx, streamSide));

      // Факел на глухой стене для настроения
      out.push(...buildTorch(ctx, streamSide, 0));

      return out;
    },
  };
}

export const CORNER_STREAM_NE = makeCornerStream("corner_stream_ne", "Поворот + ручей N↔E", "n", "e");
export const CORNER_STREAM_NW = makeCornerStream("corner_stream_nw", "Поворот + ручей N↔W", "n", "w");
export const CORNER_STREAM_SE = makeCornerStream("corner_stream_se", "Поворот + ручей S↔E", "s", "e");
export const CORNER_STREAM_SW = makeCornerStream("corner_stream_sw", "Поворот + ручей S↔W", "s", "w");