import { NO_EXITS, RoomBlueprint } from "../RoomBlueprint";
import {
  buildAllWalls,
  buildCeiling,
  buildFloorWithHole,
  buildPlatform,
  buildSpikes,
  buildTorch,
} from "../room-kit";

type Side = "n" | "s" | "w" | "e";

function exitsOf(a: Side, b: Side) {
  return {
    ...NO_EXITS,
    n: a === "n" || b === "n",
    s: a === "s" || b === "s",
    w: a === "w" || b === "w",
    e: a === "e" || b === "e",
  };
}

function makeCornerPit(id: string, label: string, a: Side, b: Side): RoomBlueprint {
  return {
    id,
    category: "trap",
    label,
    exits: exitsOf(a, b),
    weight: 2,
    footprint: { w: 1, h: 1 },

    build(ctx) {
      const out = [];

      // Пол с дырой 8×8 по центру (полуразмер 4)
      out.push(...buildFloorWithHole(ctx, {
        dx: 0, dz: 0,
        halfW: 4, halfD: 4,
      }));

      // Шипы «на дне» ямы (визуально ниже пола — на уровне −1.5)
      // Мы обманываем: физически это меши на Y ≈ floorY − 1.5,
      // игрок туда падает и получает урон (обрабатывается в сцене).
      const spikeMeshes = buildSpikes(ctx, 0, 0, 3, 3, 1.0, ctx.materials.metal);
      for (const s of spikeMeshes) s.position.y -= 1.5;
      out.push(...spikeMeshes);

      // Платформы для паркура — три штуки через центр
      // Высоты разные, чтобы был вызов при прыжке
      out.push(buildPlatform(ctx, -2.5, 0, 0.6, 1.8, 1.8));
      out.push(buildPlatform(ctx, +0.0, 0, 1.2, 1.8, 1.8));
      out.push(buildPlatform(ctx, +2.5, 0, 0.6, 1.8, 1.8));

      // Стены (у них опоры — пол, который мы снесли; но это ок,
      // потому что у стен есть свои боксы от пола до потолка)
      out.push(...buildAllWalls(ctx));
      out.push(...buildCeiling(ctx));

      // Факелы — по одному на каждой двери, чтобы игрок видел край ямы
      out.push(...buildTorch(ctx, a, 0.7));
      out.push(...buildTorch(ctx, b, 0.7));

      return out;
    },
  };
}

export const CORNER_PIT_NE = makeCornerPit("corner_pit_ne", "Поворот + яма N↔E", "n", "e");
export const CORNER_PIT_NW = makeCornerPit("corner_pit_nw", "Поворот + яма N↔W", "n", "w");
export const CORNER_PIT_SE = makeCornerPit("corner_pit_se", "Поворот + яма S↔E", "s", "e");
export const CORNER_PIT_SW = makeCornerPit("corner_pit_sw", "Поворот + яма S↔W", "s", "w");