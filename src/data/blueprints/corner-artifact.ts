import { Color3, MeshBuilder, StandardMaterial } from "@babylonjs/core";

import { NO_EXITS, RoomBlueprint } from "../RoomBlueprint";
import {
  buildAllWalls,
  buildCeiling,
  buildFloor,
  buildTorch,
  boxAt,
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
 * Ищет «мёртвый угол» — точку, где сходятся две глухие стены.
 * Возвращает относительные (dx, dz).
 */
function findDeadCorner(a: Side, b: Side): { dx: number; dz: number } {
  const solid1 = OPPOSITE[a];
  const solid2 = OPPOSITE[b];
  const dx =
    solid1 === "w" || solid2 === "w" ? -1 : solid1 === "e" || solid2 === "e" ? +1 : 0;
  const dz =
    solid1 === "n" || solid2 === "n" ? -1 : solid1 === "s" || solid2 === "s" ? +1 : 0;
  return { dx, dz };
}

function makeCornerArtifact(id: string, label: string, a: Side, b: Side): RoomBlueprint {
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

      // Пьедестал в мёртвом углу, на 2.5 м от каждой стены
      const { dx, dz } = findDeadCorner(a, b);
      const inset = 2.5;
      const px = dx * (ctx.sizeX / 2 - inset);
      const pz = dz * (ctx.sizeZ / 2 - inset);

      // Основание (цилиндр)
      out.push(boxAt(
        ctx,
        "pedestal",
        px, pz,
        0,               // на полу
        1.4, 1.0, 1.4,   // размеры 1.4×1.0×1.4
        ctx.materials.stone
      ));

      // Сам «артефакт» — светящийся шар
      const orb = MeshBuilder.CreateSphere("artifactOrb", { diameter: 0.6 }, ctx.scene);
      orb.position.set(ctx.centerX + px, ctx.floorY + 1.3, ctx.centerZ + pz);
      const orbMat = new StandardMaterial("orbMat", ctx.scene);
      orbMat.diffuseColor = new Color3(0.9, 0.7, 0.2);
      orbMat.emissiveColor = new Color3(0.8, 0.5, 0.1);
      orb.material = orbMat;
      orb.isPickable = true;
      orb.checkCollisions = false;
      out.push(orb);

      // Факелы у входа, чтобы подсветить угол
      out.push(...buildTorch(ctx, a, -0.6));
      out.push(...buildTorch(ctx, b, -0.6));

      return out;
    },
  };
}

export const CORNER_ARTIFACT_NE = makeCornerArtifact("corner_artifact_ne", "Поворот + артефакт N↔E", "n", "e");
export const CORNER_ARTIFACT_NW = makeCornerArtifact("corner_artifact_nw", "Поворот + артефакт N↔W", "n", "w");
export const CORNER_ARTIFACT_SE = makeCornerArtifact("corner_artifact_se", "Поворот + артефакт S↔E", "s", "e");
export const CORNER_ARTIFACT_SW = makeCornerArtifact("corner_artifact_sw", "Поворот + артефакт S↔W", "s", "w");