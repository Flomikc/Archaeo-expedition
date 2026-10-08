import {
  Color3,
  DirectionalLight,
  HemisphericLight,
  MeshBuilder,
  Vector3,
} from "@babylonjs/core";

import { NO_EXITS, RoomBlueprint } from "../RoomBlueprint";
import {
  buildAllWalls,
  buildColumn,
  buildTorch,
} from "../room-kit";

/**
 * Финальная комната с буром. 2×2 = 28×28 м.
 *
 * Игрок входит с юга (единственный выход), идёт к центру,
 * где огромная воронка с буром. Верх открыт — «лунный свет».
 */
export const DRILL_ROOM: RoomBlueprint = {
  id: "drill",
  category: "drill",
  label: "Комната с буром (финал)",
  exits: { ...NO_EXITS, w: true },
  weight: 0,
  footprint: { w: 2, h: 2 },
  // Размер задаётся явно: 26×26 вместо footprint × 18.9.
  ...({ sizeOverride: { x: 26, z: 26 } } as object),
  // Размер задаётся явно: 26×26 при footprint 2×2 (иначе было бы 36×36).
  // Поле читается GridLevelGenerator.
  ...({ sizeOverride: { x: 26, z: 26 } } as object),

  build(ctx) {
    const out = [];

    const minSize = Math.min(ctx.sizeX, ctx.sizeZ);   // 28
    const pitTopSize = minSize * 0.55;                // 15.4 — верхний диаметр воронки
    const pitBottomSize = minSize * 0.30;             // 8.4 — нижний
    const pitDepth = 3.5;
    const rimWidth = (minSize - pitTopSize) / 2;      // 6.3 — обод пола

    // ─── ОБОД ПОЛА вокруг воронки ───────────────────────────────
    const rim = (w: number, d: number, x: number, z: number) => {
      const m = MeshBuilder.CreateBox("drillRim",
        { width: w, height: 0.2, depth: d }, ctx.scene);
      m.position.set(ctx.centerX + x, ctx.floorY - 0.1, ctx.centerZ + z);
      m.material = ctx.materials.sand;
      m.checkCollisions = true;
      m.isPickable = false;
      out.push(m);
    };
    rim(ctx.sizeX, rimWidth, 0, -pitTopSize / 2 - rimWidth / 2);   // север
    rim(ctx.sizeX, rimWidth, 0, +pitTopSize / 2 + rimWidth / 2);   // юг
    rim(rimWidth, pitTopSize, -pitTopSize / 2 - rimWidth / 2, 0);  // запад
    rim(rimWidth, pitTopSize, +pitTopSize / 2 + rimWidth / 2, 0);  // восток

    // ─── СТЕНКИ ВОРОНКИ (усечённый конус, 4 грани) ──────────────
    const pit = MeshBuilder.CreateCylinder("drillPit", {
      height: pitDepth,
      diameterTop: pitTopSize,
      diameterBottom: pitBottomSize,
      tessellation: 4,
    }, ctx.scene);
    pit.position.set(ctx.centerX, ctx.floorY - pitDepth / 2, ctx.centerZ);
    pit.rotation.y = Math.PI / 4;
    const pitMat = ctx.materials.stone.clone("drillPitMat");
    pitMat.backFaceCulling = false;
    pit.material = pitMat;
    pit.checkCollisions = true;
    pit.isPickable = false;
    out.push(pit);

    // ─── ДНО ВОРОНКИ ────────────────────────────────────────────
    const pitFloor = MeshBuilder.CreateBox("drillPitFloor",
      { width: pitBottomSize, height: 0.3, depth: pitBottomSize }, ctx.scene);
    pitFloor.position.set(ctx.centerX, ctx.floorY - pitDepth - 0.15, ctx.centerZ);
    pitFloor.material = ctx.materials.darkStone;
    pitFloor.checkCollisions = true;
    pitFloor.isPickable = false;
    out.push(pitFloor);

    // ─── РАМПА (спуск в воронку) ────────────────────────────────
    const ramp = MeshBuilder.CreateBox("drillRamp",
      { width: 7, height: 0.4, depth: pitDepth + 0.5 }, ctx.scene);
    ramp.position.set(
      ctx.centerX,
      ctx.floorY - pitDepth / 2,
      ctx.centerZ + pitTopSize / 2 - 1
    );
    ramp.rotation.x = -Math.atan2(pitDepth, pitTopSize / 2 - 1);
    ramp.material = ctx.materials.darkStone;
    ramp.checkCollisions = true;
    ramp.isPickable = false;
    out.push(ramp);

    // ─── СТЕНЫ (только юг имеет дверь) ──────────────────────────
    // Важно: в 2×2 комнате стены ставятся по внешнему периметру,
    // а не по границам клеток. Хелперы делают это автоматически,
    // потому что используют ctx.sizeX = 28.
    out.push(...buildAllWalls(ctx));

    // ─── Потолка НЕТ — открытый верх, «лунный свет» ─────────────
    // (специально не вызываем buildCeiling)

    // ─── ОСВЕЩЕНИЕ ──────────────────────────────────────────────
    // Сверху: холодный голубой свет (как лунный)
    const moon = new DirectionalLight(
      "drillMoon",
      new Vector3(0.2, -1, 0.15),
      ctx.scene
    );
    moon.position.set(ctx.centerX + 5, ctx.floorY + 25, ctx.centerZ + 5);
    moon.intensity = 1.2;
    moon.diffuse = new Color3(0.55, 0.7, 1.0);
    moon.specular = new Color3(0.3, 0.4, 0.6);

    // Дополнительная заливка
    const fill = new HemisphericLight("drillFill", new Vector3(0, 1, 0), ctx.scene);
    fill.intensity = 0.35;
    fill.diffuse = new Color3(0.5, 0.6, 0.85);
    fill.groundColor = new Color3(0.05, 0.07, 0.12);

    // ─── КОЛОННЫ ПО УГЛАМ (для помпезности) ─────────────────────
    out.push(buildColumn(ctx, -12, -12, 8, 1.2));
    out.push(buildColumn(ctx, +12, -12, 8, 1.2));
    out.push(buildColumn(ctx, -12, +12, 8, 1.2));
    out.push(buildColumn(ctx, +12, +12, 8, 1.2));

    // ─── ФАКЕЛЫ на входе ────────────────────────────────────────
    out.push(...buildTorch(ctx, "s", -0.3));
    out.push(...buildTorch(ctx, "s", +0.3));

    return out;
  },
};