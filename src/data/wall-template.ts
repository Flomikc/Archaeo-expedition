import {
  Mesh,
  MeshBuilder,
  Quaternion,
  StandardMaterial,
  Texture,
  Vector3,
} from "@babylonjs/core";

import type { RoomContext } from "./RoomBlueprint";

// ═══════════════════════════════════════════════════════════════
//  ЕДИНЫЙ ШАБЛОН СТЕНЫ
//
//  Длина стены и её отступ от центра комнаты теперь ВЫЧИСЛЯЮТСЯ
//  из ctx.sizeX / ctx.sizeZ. Для стандартной комнаты 18.9 м:
//    offset = (18.9 − 0.9)/2 = 9
//    wallLen = 18.9 − 0.9 = 18
//  Для drill 26×26:
//    offset = (26 − 0.9)/2 = 12.55
//    wallLen = 26 − 0.9 = 25.1
//
//  STUB_GAP — стыковочный зазор между стенами соседей.
// ═══════════════════════════════════════════════════════════════

type WallSide = "n" | "s" | "w" | "e";
type MatKey = "stone" | "darkStone" | "sand" | "metal";
type PieceType = "wall" | "column";

interface Piece {
  type: PieceType;
  lx: number;
  ly: number;
  lz: number;
  w: number;
  h: number;
  d: number;
  mat: MatKey;
  rx?: number;
  ry?: number;
  rz?: number;
  texU?: number;
  texV?: number;
  texW?: number;
}

// ── Константы ─────────────────────────────────────────────────
const STUB_GAP = 0.9;
const WALL_H = 4.5;
const WALL_T = 0.5;
const DOOR_W = 3.6;
const DOOR_HALF_ZONE = 2;    // |x| ≤ 2 — проём двери
const BRICK_DX = 1;

// ── Декор двери (без верхней балки и плинтусов — они генерятся) ──
const DOOR_PIECES: Piece[] = [
  // Колонны по бокам
  { type: "column", lx: -2.06, ly: 0.21, lz: 0, w: 0.8, h: 4.5, d: 0.8,
    mat: "sand", texU: 1, texV: 1 },
  { type: "column", lx: +2.06, ly: 0.21, lz: 0, w: 0.8, h: 4.5, d: 0.8,
    mat: "sand", texU: 1, texV: 1 },

  // Кубики-основания
  { type: "wall", lx: -2, ly: -0.17, lz: 0, w: 0.9, h: 1.0, d: 0.9,
    mat: "darkStone", texU: 0.1, texV: 0.1 },
  { type: "wall", lx: +2, ly: -0.17, lz: 0, w: 0.9, h: 1.0, d: 0.9,
    mat: "darkStone", texU: 0.1, texV: 0.1 },
  { type: "wall", lx: -2, ly: 0.95, lz: 0, w: 0.9, h: 0.7, d: 0.9,
    mat: "darkStone", texU: 0.1, texV: 0.1, ry: -0.0252 },
  { type: "wall", lx: +2, ly: 0.95, lz: 0, w: 0.9, h: 0.7, d: 0.9,
    mat: "darkStone", texU: 0.1, texV: 0.1 },
  { type: "wall", lx: -2, ly: 3.26, lz: 0, w: 0.9, h: 0.9, d: 0.9,
    mat: "darkStone", texU: 0.1, texV: 0.1 },
  { type: "wall", lx: +2, ly: 3.26, lz: 0, w: 0.9, h: 0.9, d: 0.9,
    mat: "darkStone", texU: 0.1, texV: 0.1 },

  // Вертикальные стойки
  { type: "wall", lx: -2, ly: -0.08, lz: 0, w: 0.6, h: 5.0, d: 0.56,
    mat: "darkStone", texU: 6, texV: 2 },
  { type: "wall", lx: +2, ly: -0.08, lz: 0, w: 0.6, h: 5.0, d: 0.56,
    mat: "darkStone", texU: 6, texV: 2 },

  // Мелкие блоки на стойках
  { type: "wall", lx: -1.87, ly: 2.18, lz: 0, w: 0.5, h: 0.8, d: 0.6,
    mat: "darkStone", texU: 0.2, texV: 0.2 },
  { type: "wall", lx: +1.87, ly: 2.18, lz: 0, w: 0.5, h: 0.8, d: 0.6,
    mat: "darkStone", texU: 0.2, texV: 0.2 },

  // Арка
  { type: "wall", lx: -1.2, ly: 3.93, lz: 0, w: 0.9, h: 0.9, d: 0.9,
    mat: "darkStone", texU: 0.1, texV: 0.1, rz: 0.3604 },
  { type: "wall", lx:  0.0, ly: 4.16, lz: 0, w: 0.9, h: 0.9, d: 0.9,
    mat: "darkStone", texU: 0.1, texV: 0.1 },
  { type: "wall", lx: +1.2, ly: 3.93, lz: 0, w: 0.9, h: 0.9, d: 0.9,
    mat: "darkStone", texU: 0.1, texV: 0.1, rz: -0.3613 },

  // Каменные блоки арки
  { type: "wall", lx: -1.67, ly: 3.90, lz: 0, w: 0.9, h: 0.86, d: 0.6,
    mat: "stone", texU: 6, texV: 2, rx: 0.005, ry: 0.004, rz: 0.6661 },
  { type: "wall", lx: -0.58, ly: 4.23, lz: 0, w: 0.9, h: 0.80, d: 0.6,
    mat: "stone", texU: 6, texV: 2, rz: 0.1356 },
  { type: "wall", lx: +0.58, ly: 4.23, lz: 0, w: 0.9, h: 0.80, d: 0.6,
    mat: "stone", texU: 6, texV: 2, rz: -0.1361 },
  { type: "wall", lx: +1.67, ly: 3.90, lz: 0, w: 0.9, h: 0.86, d: 0.6,
    mat: "stone", texU: 6, texV: 2, rx: -0.0052, ry: -0.0035, rz: -0.6667 },

  // Внутренняя балка проёма
  { type: "wall", lx: 0, ly: 3.315, lz: 0, w: 4.0, h: 0.45, d: 0.4,
    mat: "darkStone", texU: 0.2, texV: 0.2 },

  // Тонкие стойки снаружи
  { type: "wall", lx: -2, ly: -0.1, lz: -0.25, w: 0.4, h: 5.0, d: 0.4,
    mat: "darkStone", texU: 6, texV: 2 },
  { type: "wall", lx: +2, ly: -0.1, lz: -0.25, w: 0.4, h: 5.0, d: 0.4,
    mat: "darkStone", texU: 6, texV: 2 },
];

// ── Кэш материалов ────────────────────────────────────────────
const MATERIAL_CACHE = new WeakMap<object, Map<string, StandardMaterial>>();

function matFrom(ctx: RoomContext, key: MatKey): StandardMaterial {
  switch (key) {
    case "stone":     return ctx.materials.stone;
    case "darkStone": return ctx.materials.darkStone;
    case "sand":      return ctx.materials.sand;
    case "metal":     return ctx.materials.metal;
  }
}

function getCachedMaterial(
  ctx: RoomContext,
  key: MatKey,
  texU: number | undefined,
  texV: number | undefined,
  texW: number | undefined
): StandardMaterial {
  if (texU === undefined && texV === undefined && texW === undefined) {
    return matFrom(ctx, key);
  }
  let cache = MATERIAL_CACHE.get(ctx.materials);
  if (!cache) {
    cache = new Map();
    MATERIAL_CACHE.set(ctx.materials, cache);
  }
  const cacheKey = `${key}|${texU ?? ""}|${texV ?? ""}|${texW ?? ""}`;
  const existing = cache.get(cacheKey);
  if (existing) return existing;

  const base = matFrom(ctx, key);
  const cloned = base.clone(`mat_${key}_t`);
  cloned.maxSimultaneousLights = 8;
  if (base.diffuseTexture) cloned.diffuseTexture = base.diffuseTexture.clone();

  const tex = cloned.diffuseTexture as Texture | null;
  if (tex) {
    if (texU !== undefined) tex.uScale = texU;
    if (texV !== undefined) tex.vScale = texV;
    if (texW !== undefined) tex.wAng = texW;
  }
  cache.set(cacheKey, cloned);
  return cloned;
}

// ── Геометрия стены ───────────────────────────────────────────
interface WallFrame {
  wallX: number;
  wallZ: number;
  rotY: number;
  /** Полная длина стены вдоль её оси. */
  wallLen: number;
}

/**
 * Вычисляет положение стены и её длину по размерам комнаты.
 * Раньше WALL_OFFSET был жёстко 9. Теперь зависит от sizeX/sizeZ.
 */
function wallFrame(side: WallSide, ctx: RoomContext): WallFrame {
  const offsetX = (ctx.sizeX - STUB_GAP) / 2;
  const offsetZ = (ctx.sizeZ - STUB_GAP) / 2;
  switch (side) {
    case "n": return { wallX: ctx.centerX,             wallZ: ctx.centerZ - offsetZ, rotY: 0,             wallLen: ctx.sizeX - STUB_GAP };
    case "s": return { wallX: ctx.centerX,             wallZ: ctx.centerZ + offsetZ, rotY: Math.PI,       wallLen: ctx.sizeX - STUB_GAP };
    case "w": return { wallX: ctx.centerX - offsetX,   wallZ: ctx.centerZ,           rotY: Math.PI / 2,   wallLen: ctx.sizeZ - STUB_GAP };
    case "e": return { wallX: ctx.centerX + offsetX,   wallZ: ctx.centerZ,           rotY: -Math.PI / 2,  wallLen: ctx.sizeZ - STUB_GAP };
  }
}

function placeWallPiece(ctx: RoomContext, side: WallSide, p: Piece): Mesh {
  const { wallX, wallZ, rotY } = wallFrame(side, ctx);

  let wx: number, wz: number;
  switch (side) {
    case "n": wx = wallX + p.lx; wz = wallZ + p.lz; break;
    case "s": wx = wallX - p.lx; wz = wallZ - p.lz; break;
    case "w": wx = wallX + p.lz; wz = wallZ - p.lx; break;
    case "e": wx = wallX - p.lz; wz = wallZ + p.lx; break;
  }
  const wy = ctx.floorY + p.ly + p.h / 2;

  let mesh: Mesh;
  if (p.type === "column") {
    mesh = MeshBuilder.CreateCylinder(
      "piece_col",
      { height: p.h, diameter: p.w, tessellation: 16 },
      ctx.scene
    );
  } else {
    mesh = MeshBuilder.CreateBox(
      "piece_wall",
      { width: p.w, height: p.h, depth: p.d },
      ctx.scene
    );
  }

  mesh.position.set(wx, wy, wz);
  mesh.material = getCachedMaterial(ctx, p.mat, p.texU, p.texV, p.texW);

  const hasLocalTilt = !!(p.rx || p.ry || p.rz);
  if (hasLocalTilt) {
    const qLocal = Quaternion.FromEulerAngles(p.rx ?? 0, p.ry ?? 0, p.rz ?? 0);
    const qWall = Quaternion.RotationAxis(Vector3.Up(), rotY);
    const e = qWall.multiply(qLocal).toEulerAngles();
    mesh.rotation.set(e.x, e.y, e.z);
  } else if (rotY !== 0) {
    mesh.rotation.y = rotY;
  }

  mesh.checkCollisions = true;
  mesh.isPickable = false;

  const tex = (mesh.material as StandardMaterial).diffuseTexture as Texture | null;
  mesh.metadata = {
    type: p.type,
    material: p.mat,
    w: p.w, h: p.h, d: p.d,
    tex: {
      uScale: tex ? tex.uScale : 1,
      vScale: tex ? tex.vScale : 1,
      uOffset: tex ? tex.uOffset : 0,
      vOffset: tex ? tex.vOffset : 0,
      wAng: tex ? tex.wAng : 0,
    },
  };

  return mesh;
}

function brickPiece(x: number): Piece {
  return {
    type: "wall", lx: x, ly: -0.02, lz: 0,
    w: 0.9, h: 0.7, d: 0.9,
    mat: "darkStone", texU: 0.1, texV: 0.1,
  };
}

// ═══════════════════════════════════════════════════════════════
//  ПУБЛИЧНЫЙ API
// ═══════════════════════════════════════════════════════════════

export function buildTemplatedWall(
  ctx: RoomContext,
  side: WallSide,
  hasDoor: boolean
): Mesh[] {
  const out: Mesh[] = [];
  const frame = wallFrame(side, ctx);
  const wallLen = frame.wallLen;

  // 1. Основная стена
  if (hasDoor) {
    const segW = (wallLen - DOOR_W) / 2;
    const segOff = DOOR_W / 2 + segW / 2;
    out.push(placeWallPiece(ctx, side, {
      type: "wall", lx: -segOff, ly: 0, lz: 0,
      w: segW, h: WALL_H, d: WALL_T, mat: "stone",
      texU: 1, texV: 1, texW: Math.PI,
    }));
    out.push(placeWallPiece(ctx, side, {
      type: "wall", lx: +segOff, ly: 0, lz: 0,
      w: segW, h: WALL_H, d: WALL_T, mat: "stone",
      texU: 1, texV: 1, texW: Math.PI,
    }));
  } else {
    out.push(placeWallPiece(ctx, side, {
      type: "wall", lx: 0, ly: 0, lz: 0,
      w: wallLen, h: WALL_H, d: WALL_T, mat: "stone",
      texU: 2, texV: 1, texW: Math.PI,
    }));
  }

  // 2. Верхняя балка
  out.push(placeWallPiece(ctx, side, {
    type: "wall", lx: 0, ly: 4.5, lz: 0,
    w: wallLen, h: 0.7, d: 0.8, mat: "darkStone",
    texU: 4, texV: 0.2,
  }));

  // 3. Декор
  if (hasDoor) {
    for (const p of DOOR_PIECES) {
      out.push(placeWallPiece(ctx, side, p));
    }

    // Плинтусы по бокам от двери (до края стены)
    const plinthStart = 2.0;
    const plinthEnd = wallLen / 2 - 0.1;
    const plinthLen = plinthEnd - plinthStart;
    if (plinthLen > 0.1) {
      const plinthOff = (plinthStart + plinthEnd) / 2;
      out.push(placeWallPiece(ctx, side, {
        type: "wall", lx: -plinthOff, ly: -0.21, lz: 0,
        w: plinthLen, h: 0.7, d: 0.8, mat: "sand",
        texU: 0.2, texV: 0.2,
      }));
      out.push(placeWallPiece(ctx, side, {
        type: "wall", lx: +plinthOff, ly: -0.21, lz: 0,
        w: plinthLen, h: 0.7, d: 0.8, mat: "sand",
        texU: 0.2, texV: 0.2,
      }));
    }
  } else {
    // Плинтус через всю стену
    out.push(placeWallPiece(ctx, side, {
      type: "wall", lx: 0, ly: -0.21, lz: 0,
      w: wallLen, h: 0.7, d: 0.8, mat: "sand",
      texU: 0.4, texV: 0.2, texW: Math.PI,
    }));
  }

  // 4. Кирпичи по всей длине
  const brickHalf = Math.floor((wallLen / 2 - 0.5) / BRICK_DX);
  for (let k = -brickHalf; k <= brickHalf; k++) {
    const x = k * BRICK_DX;
    if (hasDoor && Math.abs(x) <= DOOR_HALF_ZONE) continue;
    out.push(placeWallPiece(ctx, side, brickPiece(x)));
  }

  return out;
}