import {
  MeshBuilder,
  StandardMaterial,
  Color3,
} from "@babylonjs/core";

import { NO_EXITS, RoomBlueprint } from "../RoomBlueprint";
import {
  boxAt,
  buildAllWalls,
  buildCeiling,
  buildFloor,
  buildRamp,
  buildTorch,
} from "../room-kit";

/**
 * Стартовая комната. Игрок появляется на верхней платформе,
 * спускается по рампе и выходит через южную дверь.
 *
 * Один выход: юг (s).
 */
export const START_ROOM: RoomBlueprint = {
  id: "start",
  category: "start",
  label: "Стартовая (спуск в гробницу)",
  exits: { ...NO_EXITS, s: true },
  weight: 0,                    // не выбирается случайно — ставится вручную
  footprint: { w: 1, h: 1 },

  build(ctx) {
    const out = [];

    // ─── ПОЛ ─────────────────────────────────────────────────────
    out.push(...buildFloor(ctx));

    // ─── ВЕРХНЯЯ ПЛАТФОРМА (север комнаты, где спавнится игрок) ──
    // Размер: 10×6, центр на 4 м севернее центра комнаты, высота 2 м.
    // Игрок появится на ней в точке (−2, 2, −4).
    out.push(boxAt(
      ctx,
      "startPlatform",
      0,                       // dx = 0 (по центру X)
      -ctx.sizeZ / 2 + 3,      // dz: 3 м южнее северной стены
      0,                       // baseY = 0 (стоит на полу)
      10,                      // width
      2.0,                     // height
      6,                       // depth
      ctx.materials.darkStone
    ));

    // ─── РАМПА ОТ ПЛАТФОРМЫ ВНИЗ К ПОЛУ ──────────────────────────
    // Идёт на юг (к выходу), 4 м по горизонтали, 2 м вниз.
    out.push(buildRamp(ctx, "s", 4, 2, 4.0, ctx.materials.stone));

    // ─── АРКА ВХОДА (визуальная, на северной стене) ─────────────
    // Декоративная ниша — игрок как будто пришёл отсюда.
    // На самом деле двери там нет (exits.n = false).
    const archMat = new StandardMaterial("startArchMat", ctx.scene);
    archMat.diffuseColor = new Color3(0.05, 0.04, 0.03);
    archMat.emissiveColor = new Color3(0.02, 0.02, 0.03);

    // Три бокса имитируют арку: две стойки и перекладина.
    out.push(boxAt(ctx, "archL", -2, -ctx.sizeZ / 2 + 0.3, 0, 0.6, 3.0, 0.6, archMat, false));
    out.push(boxAt(ctx, "archR", +2, -ctx.sizeZ / 2 + 0.3, 0, 0.6, 3.0, 0.6, archMat, false));
    out.push(boxAt(ctx, "archTop", 0, -ctx.sizeZ / 2 + 0.3, 2.6, 4.6, 0.6, 0.6, archMat, false));

    // ─── СТЕНЫ И ПОТОЛОК ────────────────────────────────────────
    // Стены ставятся автоматически по exits: проём только на юге,
    // остальные — глухие. Потолок сплошной.
    out.push(...buildAllWalls(ctx));
    out.push(...buildCeiling(ctx));

    // ─── ФАКЕЛЫ по обе стороны от арки ──────────────────────────
    out.push(...buildTorch(ctx, "n", -0.4));
    out.push(...buildTorch(ctx, "n", +0.4));

    return out;
  },
};