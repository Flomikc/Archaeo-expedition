import {
  Color3,
  Mesh,
  MeshBuilder,
  PointLight,
  Scene,
  StandardMaterial,
  Texture,
  Vector3,
} from "@babylonjs/core";

import type { RoomContext } from "./RoomBlueprint";
import { buildTemplatedWall } from "./wall-template";

// ============================================================
//  ГЛАВНЫЙ ПРИНЦИП: все dx/dz — ОТ ЦЕНТРА КОМНАТЫ
//  +dx → восток,  -dx → запад
//  +dz → юг,      -dz → север
//  dy  → от пола (0 = пол, wallHeight = потолок)
// ============================================================

export type WallSide = "n" | "s" | "w" | "e";

// ------------------------------------------------------------
//  ДЕФОЛТНЫЕ tex-ПАРАМЕТРЫ ПОЛА/ПОТОЛКА
// ------------------------------------------------------------
//  Взяты из JSON corner_ne.

const FLOOR_TEX = { uScale: 1.5, vScale: 1.5 };
const CEILING_TEX = { uScale: 2, vScale: 2 };

// ------------------------------------------------------------
//  ХЕЛПЕР: клонирует материал и применяет tex-параметры
// ------------------------------------------------------------

function applyTex(
  mesh: Mesh,
  baseMat: StandardMaterial,
  uScale: number,
  vScale: number
): StandardMaterial {
  const cloned = baseMat.clone(`${baseMat.name}_${mesh.name}`);
  if (baseMat.diffuseTexture) {
    cloned.diffuseTexture = baseMat.diffuseTexture.clone();
  }
  const tex = cloned.diffuseTexture as Texture | null;
  if (tex) {
    tex.uScale = uScale;
    tex.vScale = vScale;
  }
  mesh.material = cloned;
  return cloned;
}

/**
 * Записывает в metadata всё, что нужно редактору:
 * тип, материал, размер, tex-параметры.
 */
function setMeshMeta(
  mesh: Mesh,
  type: string,
  material: string,
  w: number,
  h: number,
  d: number,
  tex: { uScale: number; vScale: number }
): void {
  mesh.metadata = {
    type,
    material,
    w,
    h,
    d,
    tex: {
      uScale: tex.uScale,
      vScale: tex.vScale,
      uOffset: 0,
      vOffset: 0,
      wAng: 0,
    },
  };
}

// ------------------------------------------------------------
//  ВСПОМОГАТЕЛЬНОЕ
// ------------------------------------------------------------

export function boxAt(
  ctx: RoomContext,
  name: string,
  dx: number,
  dz: number,
  baseY: number,
  w: number,
  h: number,
  d: number,
  material: StandardMaterial,
  collide = true
): Mesh {
  const box = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, ctx.scene);
  box.position.set(
    ctx.centerX + dx,
    ctx.floorY + baseY + h / 2,
    ctx.centerZ + dz
  );
  box.material = material;
  box.checkCollisions = collide;
  box.isPickable = true;
  return box;
}

export function cylAt(
  ctx: RoomContext,
  name: string,
  dx: number,
  dz: number,
  baseY: number,
  height: number,
  diameter: number,
  material: StandardMaterial,
  collide = true
): Mesh {
  const cyl = MeshBuilder.CreateCylinder(
    name,
    { height, diameter, tessellation: 16 },
    ctx.scene
  );
  cyl.position.set(
    ctx.centerX + dx,
    ctx.floorY + baseY + height / 2,
    ctx.centerZ + dz
  );
  cyl.material = material;
  cyl.checkCollisions = collide;
  cyl.isPickable = true;
  return cyl;
}

// ------------------------------------------------------------
//  ПОЛ
// ------------------------------------------------------------

const CEILING_Y_OFFSET = 5.15;

/** Сплошной пол 18.9×18.9 с tex-параметрами из JSON. */
export function buildFloor(ctx: RoomContext): Mesh[] {
  const W = ctx.sizeX;
  const D = ctx.sizeZ;
  const H = 0.2;

  const floor = MeshBuilder.CreateBox("floor",
    { width: W, height: H, depth: D }, ctx.scene);
  floor.position.set(ctx.centerX, ctx.floorY - 0.1, ctx.centerZ);

  applyTex(floor, ctx.materials.sand, FLOOR_TEX.uScale, FLOOR_TEX.vScale);

  floor.checkCollisions = true;
  floor.isPickable = false;

  setMeshMeta(floor, "floor", "sand", W, H, D, FLOOR_TEX);

  return [floor];
}

/** Пол с прямоугольной дырой. */
export function buildFloorWithHole(
  ctx: RoomContext,
  hole: { dx: number; dz: number; halfW: number; halfD: number }
): Mesh[] {
  const out: Mesh[] = [];

  const hx = ctx.centerX + hole.dx;
  const hz = ctx.centerZ + hole.dz;
  const n = hz - hole.halfD;
  const s = hz + hole.halfD;
  const w = hx - hole.halfW;
  const e = hx + hole.halfW;

  const minX = ctx.centerX - ctx.sizeX / 2;
  const maxX = ctx.centerX + ctx.sizeX / 2;
  const minZ = ctx.centerZ - ctx.sizeZ / 2;
  const maxZ = ctx.centerZ + ctx.sizeZ / 2;

  const strip = (w2: number, d2: number, cx: number, cz: number) => {
    if (w2 < 0.1 || d2 < 0.1) return;
    const m = MeshBuilder.CreateBox("floorStrip",
      { width: w2, height: 0.2, depth: d2 }, ctx.scene);
    m.position.set(cx, ctx.floorY - 0.1, cz);

    applyTex(m, ctx.materials.sand, FLOOR_TEX.uScale, FLOOR_TEX.vScale);

    m.checkCollisions = true;
    m.isPickable = false;

    setMeshMeta(m, "floor", "sand", w2, 0.2, d2, FLOOR_TEX);

    out.push(m);
  };

  if (n > minZ + 0.1) strip(maxX - minX, n - minZ, (minX + maxX) / 2, (minZ + n) / 2);
  if (maxZ > s + 0.1) strip(maxX - minX, maxZ - s, (minX + maxX) / 2, (s + maxZ) / 2);
  if (w > minX + 0.1) strip(w - minX, s - n, (minX + w) / 2, hz);
  if (maxX > e + 0.1) strip(maxX - e, s - n, (e + maxX) / 2, hz);

  return out;
}

// ------------------------------------------------------------
//  ПОТОЛОК
// ------------------------------------------------------------

/** Сплошной потолок 18.9×18.9 с tex-параметрами из JSON. */
export function buildCeiling(ctx: RoomContext): Mesh[] {
  const W = ctx.sizeX;
  const D = ctx.sizeZ;
  const H = 0.2;

  const ceil = MeshBuilder.CreateBox("ceiling",
    { width: W, height: H, depth: D }, ctx.scene);
  ceil.position.set(ctx.centerX, ctx.floorY + CEILING_Y_OFFSET, ctx.centerZ);

  applyTex(ceil, ctx.materials.darkStone, CEILING_TEX.uScale, CEILING_TEX.vScale);

  ceil.checkCollisions = true;
  ceil.isPickable = false;

  setMeshMeta(ceil, "ceiling", "darkStone", W, H, D, CEILING_TEX);

  return [ceil];
}

export function buildCeilingWithHole(
  ctx: RoomContext,
  hole: { dx: number; dz: number; halfW: number; halfD: number }
): Mesh[] {
  const tempCtx = { ...ctx, floorY: ctx.floorY + CEILING_Y_OFFSET - 0.1 } as RoomContext;
  const strips = buildFloorWithHole(tempCtx, hole);

  // Перебиваем материал и metadata — это потолок, не пол.
  for (const m of strips) {
    applyTex(m, ctx.materials.darkStone, CEILING_TEX.uScale, CEILING_TEX.vScale);

    const meta = m.metadata as { w: number; d: number };
    setMeshMeta(m, "ceiling", "darkStone", meta.w, 0.2, meta.d, CEILING_TEX);
  }

  return strips;
}

// ------------------------------------------------------------
//  СТЕНЫ
// ------------------------------------------------------------

export function buildWall(
  ctx: RoomContext,
  side: WallSide,
  hasDoor: boolean,
  _opts: { doorWidth?: number; doorHeight?: number; material?: StandardMaterial } = {}
): Mesh[] {
  return buildTemplatedWall(ctx, side, hasDoor);
}

export function buildAllWalls(
  ctx: RoomContext,
  _opts: { openTop?: boolean } = {}
): Mesh[] {
  const out: Mesh[] = [];
  out.push(...buildWall(ctx, "n", ctx.doors.n));
  out.push(...buildWall(ctx, "s", ctx.doors.s));
  out.push(...buildWall(ctx, "w", ctx.doors.w));
  out.push(...buildWall(ctx, "e", ctx.doors.e));
  return out;
}

// ------------------------------------------------------------
//  КОЛОННЫ
// ------------------------------------------------------------

export function buildColumn(
  ctx: RoomContext,
  dx: number,
  dz: number,
  height = 4.0,
  diameter = 0.8,
  material?: StandardMaterial
): Mesh {
  return cylAt(
    ctx,
    "column",
    dx, dz,
    0,
    height,
    diameter,
    material ?? ctx.materials.stone
  );
}

// ------------------------------------------------------------
//  РАМПА
// ------------------------------------------------------------

export function buildRamp(
  ctx: RoomContext,
  dir: "n" | "s" | "w" | "e",
  run: number,
  rise: number,
  width: number,
  material?: StandardMaterial
): Mesh {
  const len = Math.sqrt(run * run + rise * rise);
  const angle = Math.atan2(rise, run);

  let dx = 0, dz = 0;
  if (dir === "n") dz = -1;
  else if (dir === "s") dz = 1;
  else if (dir === "w") dx = -1;
  else dx = 1;

  const ramp = MeshBuilder.CreateBox("ramp", {
    width: Math.abs(dx) > 0 ? len : width,
    height: 0.4,
    depth: Math.abs(dz) > 0 ? len : width,
  }, ctx.scene);

  ramp.position.set(
    ctx.centerX + dx * run / 2,
    ctx.floorY + rise / 2,
    ctx.centerZ + dz * run / 2
  );

  if (dir === "n" || dir === "s") ramp.rotation.x = (dir === "n" ? 1 : -1) * angle;
  else ramp.rotation.z = (dir === "w" ? -1 : 1) * angle;

  ramp.material = material ?? ctx.materials.darkStone;
  ramp.checkCollisions = true;
  ramp.isPickable = false;
  return ramp;
}

// ------------------------------------------------------------
//  ПЛАТФОРМЫ, ШИПЫ, ФАКЕЛЫ
// ------------------------------------------------------------

export function buildPlatform(
  ctx: RoomContext,
  dx: number,
  dz: number,
  baseY: number,
  w: number,
  d: number,
  material?: StandardMaterial
): Mesh {
  return boxAt(
    ctx,
    "platform",
    dx, dz,
    baseY,
    w, 0.3, d,
    material ?? ctx.materials.darkStone
  );
}

export function buildSpikes(
  ctx: RoomContext,
  dx: number,
  dz: number,
  countX: number,
  countZ: number,
  spacing: number,
  material?: StandardMaterial
): Mesh[] {
  const out: Mesh[] = [];
  const mat = material ?? ctx.materials.metal;
  for (let i = 0; i < countX; i++) {
    for (let j = 0; j < countZ; j++) {
      const ox = dx + (i - (countX - 1) / 2) * spacing;
      const oz = dz + (j - (countZ - 1) / 2) * spacing;
      const spike = MeshBuilder.CreateCylinder("spike", {
        height: 0.5,
        diameterTop: 0.02,
        diameterBottom: 0.12,
        tessellation: 8,
      }, ctx.scene);
      spike.position.set(ctx.centerX + ox, ctx.floorY + 0.25, ctx.centerZ + oz);
      spike.material = mat;
      spike.checkCollisions = false;
      spike.isPickable = false;
      out.push(spike);
    }
  }
  return out;
}

export function buildTorch(
  ctx: RoomContext,
  side: WallSide,
  t: number,
  material?: StandardMaterial
): Mesh[] {
  const out: Mesh[] = [];
  const mat = material ?? ctx.materials.wood;

  let dx = 0, dz = 0;
  const inset = 0.4;
  if (side === "n") { dz = -ctx.sizeZ / 2 + inset; dx = t * (ctx.sizeX / 2 - 1); }
  else if (side === "s") { dz = ctx.sizeZ / 2 - inset; dx = t * (ctx.sizeX / 2 - 1); }
  else if (side === "w") { dx = -ctx.sizeX / 2 + inset; dz = t * (ctx.sizeZ / 2 - 1); }
  else { dx = ctx.sizeX / 2 - inset; dz = t * (ctx.sizeZ / 2 - 1); }

  // Палка
  const stick = MeshBuilder.CreateCylinder("torchStick",
    { height: 0.5, diameter: 0.1, tessellation: 6 }, ctx.scene);
  stick.position.set(ctx.centerX + dx, ctx.floorY + 2.5, ctx.centerZ + dz);
  stick.rotation.z = side === "w" ? -0.3 : side === "e" ? 0.3 : 0;
  stick.rotation.x = side === "n" ? 0.3 : side === "s" ? -0.3 : 0;
  stick.material = mat;
  out.push(stick);

  // Пламя — emissive, светится сам, но НЕ создаёт PointLight.
  const flame = MeshBuilder.CreateSphere("torchFlame", { diameter: 0.25 }, ctx.scene);
  flame.position.set(ctx.centerX + dx, ctx.floorY + 2.85, ctx.centerZ + dz);
  const flameMat = new StandardMaterial("torchFlameMat", ctx.scene);
  flameMat.diffuseColor = new Color3(1, 0.6, 0.1);
  flameMat.emissiveColor = new Color3(0.9, 0.4, 0.05);
  flame.material = flameMat;
  out.push(flame);

  // PointLight УБРАН — он вешал шейдер и мешал фонарику.
  return out;
}