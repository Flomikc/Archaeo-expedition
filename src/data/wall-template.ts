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
//  ШАБЛОН СТЕНЫ
//
//  Извлечён из JSON corner_ne. Все размеры и параметры текстур
//  скопированы 1:1.
//
//  Локальные координаты piece внутри стены (стена длиной 18 м):
//    lx — вдоль стены (0 = центр; + = вправо от зрителя внутри комнаты)
//    ly — НИЗ коробки над полом (0 = уровень пола)
//    lz — вглубь комнаты (+ = внутрь), -0.25 для внешних стоек
//    w,h,d — размеры по локальным осям
//    rx,ry,rz — опциональные наклоны (радианы)
//    texU,texV — uScale/vScale текстуры
//    texW — wAng (поворот текстуры), радианы
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

// ── Геометрические константы ──────────────────────────────────
const WALL_LEN = 18;
const BRICK_DX = 1;          // шаг кирпичей по X
const BRICK_X_MIN = -8;
const BRICK_X_MAX = 8;
const DOOR_HALF_ZONE = 2;    // |x| <= 2 — зона двери (кирпичи пропускаем)

// ═══════════════════════════════════════════════════════════════
//  КИРПИЧ
// ═══════════════════════════════════════════════════════════════

function brickPiece(x: number): Piece {
  return {
    type: "wall",
    lx: x, ly: -0.02, lz: 0,
    w: 0.9, h: 0.7, d: 0.9,
    mat: "darkStone",
    texU: 0.1, texV: 0.1,
  };
}

// ═══════════════════════════════════════════════════════════════
//  WALL С ДВЕРЬЮ
// ═══════════════════════════════════════════════════════════════

const WALL_WITH_DOOR_PIECES: Piece[] = [
  // ── Основные сегменты стены (два, с проёмом) ────────────────
  { type: "wall", lx: -5.4, ly: 0, lz: 0, w: 7.2, h: 4.5, d: 0.5,
    mat: "stone", texU: 1, texV: 1, texW: Math.PI },
  { type: "wall", lx: +5.4, ly: 0, lz: 0, w: 7.2, h: 4.5, d: 0.5,
    mat: "stone", texU: 1, texV: 1, texW: Math.PI },

  // ── Верхняя балка через всю стену ──────────────────────────
  { type: "wall", lx: 0, ly: 4.5, lz: 0, w: 18, h: 0.7, d: 0.8,
    mat: "darkStone", texU: 4, texV: 0.2 },

  // ── Нижние плинтусы (по бокам от двери) ─────────────────────
  { type: "wall", lx: -5.29, ly: -0.21, lz: 0, w: 7.2, h: 0.7, d: 0.8,
    mat: "sand", texU: 0.2, texV: 0.2 },
  { type: "wall", lx: +5.29, ly: -0.21, lz: 0, w: 7.2, h: 0.7, d: 0.8,
    mat: "sand", texU: 0.2, texV: 0.2 },

  // ── Колонны по бокам двери ──────────────────────────────────
  { type: "column", lx: -2.06, ly: 0.21, lz: 0, w: 0.8, h: 4.5, d: 0.8,
    mat: "sand", texU: 1, texV: 1 },
  { type: "column", lx: +2.06, ly: 0.21, lz: 0, w: 0.8, h: 4.5, d: 0.8,
    mat: "sand", texU: 1, texV: 1 },

  // ── Кубики-основания дверных стоек ─────────────────────────
  { type: "wall", lx: -2, ly: -0.17, lz: 0, w: 0.9, h: 1.0, d: 0.9,
    mat: "darkStone", texU: 0.1, texV: 0.1 },
  { type: "wall", lx: +2, ly: -0.17, lz: 0, w: 0.9, h: 1.0, d: 0.9,
    mat: "darkStone", texU: 0.1, texV: 0.1 },

  // ── Следующие уровни (небольшие блоки) ──────────────────────
  { type: "wall", lx: -2, ly: 0.95, lz: 0, w: 0.9, h: 0.7, d: 0.9,
    mat: "darkStone", texU: 0.1, texV: 0.1, ry: -0.0252 },
  { type: "wall", lx: +2, ly: 0.95, lz: 0, w: 0.9, h: 0.7, d: 0.9,
    mat: "darkStone", texU: 0.1, texV: 0.1 },
  { type: "wall", lx: -2, ly: 3.26, lz: 0, w: 0.9, h: 0.9, d: 0.9,
    mat: "darkStone", texU: 0.1, texV: 0.1 },
  { type: "wall", lx: +2, ly: 3.26, lz: 0, w: 0.9, h: 0.9, d: 0.9,
    mat: "darkStone", texU: 0.1, texV: 0.1 },

  // ── Вертикальные стойки двери ───────────────────────────────
  { type: "wall", lx: -2, ly: -0.08, lz: 0, w: 0.6, h: 5.0, d: 0.56,
    mat: "darkStone", texU: 6, texV: 2 },
  { type: "wall", lx: +2, ly: -0.08, lz: 0, w: 0.6, h: 5.0, d: 0.56,
    mat: "darkStone", texU: 6, texV: 2 },

  // ── Мелкие блоки на стойках ─────────────────────────────────
  { type: "wall", lx: -1.87, ly: 2.18, lz: 0, w: 0.5, h: 0.8, d: 0.6,
    mat: "darkStone", texU: 0.2, texV: 0.2 },
  { type: "wall", lx: +1.87, ly: 2.18, lz: 0, w: 0.5, h: 0.8, d: 0.6,
    mat: "darkStone", texU: 0.2, texV: 0.2 },

  // ── Арка — наклонные блоки ──────────────────────────────────
  { type: "wall", lx: -1.2, ly: 3.93, lz: 0, w: 0.9, h: 0.9, d: 0.9,
    mat: "darkStone", texU: 0.1, texV: 0.1, rz: 0.3604 },
  { type: "wall", lx:  0.0, ly: 4.16, lz: 0, w: 0.9, h: 0.9, d: 0.9,
    mat: "darkStone", texU: 0.1, texV: 0.1 },
  { type: "wall", lx: +1.2, ly: 3.93, lz: 0, w: 0.9, h: 0.9, d: 0.9,
    mat: "darkStone", texU: 0.1, texV: 0.1, rz: -0.3613 },

  // ── Каменные блоки на арке (с наклонами) ────────────────────
  { type: "wall", lx: -1.67, ly: 3.90, lz: 0, w: 0.9, h: 0.86, d: 0.6,
    mat: "stone", texU: 6, texV: 2,
    rx: 0.005, ry: 0.004, rz: 0.6661 },
  { type: "wall", lx: -0.58, ly: 4.23, lz: 0, w: 0.9, h: 0.80, d: 0.6,
    mat: "stone", texU: 6, texV: 2, rz: 0.1356 },
  { type: "wall", lx: +0.58, ly: 4.23, lz: 0, w: 0.9, h: 0.80, d: 0.6,
    mat: "stone", texU: 6, texV: 2, rz: -0.1361 },
  { type: "wall", lx: +1.67, ly: 3.90, lz: 0, w: 0.9, h: 0.86, d: 0.6,
    mat: "stone", texU: 6, texV: 2,
    rx: -0.0052, ry: -0.0035, rz: -0.6667 },

  // ── Горизонтальная балка внутри проёма ──────────────────────
  { type: "wall", lx: 0, ly: 3.315, lz: 0, w: 4.0, h: 0.45, d: 0.4,
    mat: "darkStone", texU: 0.2, texV: 0.2 },

  // ── Тонкие стойки с внешней стороны стены ───────────────────
  { type: "wall", lx: -2, ly: -0.1, lz: -0.25, w: 0.4, h: 5.0, d: 0.4,
    mat: "darkStone", texU: 6, texV: 2 },
  { type: "wall", lx: +2, ly: -0.1, lz: -0.25, w: 0.4, h: 5.0, d: 0.4,
    mat: "darkStone", texU: 6, texV: 2 },
];

// ═══════════════════════════════════════════════════════════════
//  WALL БЕЗ ДВЕРИ
// ═══════════════════════════════════════════════════════════════

const WALL_WITHOUT_DOOR_PIECES: Piece[] = [
  // ── Сплошная стена ──────────────────────────────────────────
  { type: "wall", lx: 0, ly: 0, lz: 0, w: 18, h: 4.5, d: 0.5,
    mat: "stone", texU: 2, texV: 1, texW: Math.PI },

  // ── Верхняя балка ───────────────────────────────────────────
  { type: "wall", lx: 0, ly: 4.5, lz: 0, w: 18, h: 0.7, d: 0.8,
    mat: "darkStone", texU: 4, texV: 0.2 },

  // ── Нижний плинтус (сплошной) ───────────────────────────────
  { type: "wall", lx: 0, ly: -0.21, lz: 0, w: 18, h: 0.7, d: 0.8,
    mat: "sand", texU: 0.4, texV: 0.2, texW: Math.PI },
];

// ═══════════════════════════════════════════════════════════════
//  КЭШ МАТЕРИАЛОВ С ТЕКСТУРАМИ
// ═══════════════════════════════════════════════════════════════
//
// Каждый уникальный набор (material, texU, texV, texW) получает
// свою копию материала — чтобы текстура не пересекалась между
// pieces. Кэш живёт, пока жив RoomMaterials (уровень).

const MATERIAL_CACHE = new WeakMap<
  object,
  Map<string, StandardMaterial>
>();

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
  // Если ничего не переопределено — берём шаренный материал
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
  cloned.maxSimultaneousLights = 8;   // ← важно
  if (base.diffuseTexture) {
    cloned.diffuseTexture = base.diffuseTexture.clone();
  }
  const tex = cloned.diffuseTexture as Texture | null;
  if (tex) {
    if (texU !== undefined) tex.uScale = texU;
    if (texV !== undefined) tex.vScale = texV;
    if (texW !== undefined) tex.wAng = texW;
  }

  cache.set(cacheKey, cloned);
  return cloned;
}

// ═══════════════════════════════════════════════════════════════
//  ПОСТРОЙКА ОДНОГО PIECE
// ═══════════════════════════════════════════════════════════════

// Стена длиной 18 м стоит на 9 м от центра клетки.
// Клетка 18.9 м, край пола на 9.45 м — значит по краям остаётся
// по 0.45 м «стыковочной площадки», как в оригинальном JSON.
const WALL_OFFSET = 9;

function wallFrame(side: WallSide, _ctx: RoomContext) {
  switch (side) {
    case "n": return { wallX: _ctx.centerX,                wallZ: _ctx.centerZ - WALL_OFFSET, rotY: 0 };
    case "s": return { wallX: _ctx.centerX,                wallZ: _ctx.centerZ + WALL_OFFSET, rotY: Math.PI };
    case "w": return { wallX: _ctx.centerX - WALL_OFFSET,  wallZ: _ctx.centerZ,                rotY: Math.PI / 2 };
    case "e": return { wallX: _ctx.centerX + WALL_OFFSET,  wallZ: _ctx.centerZ,                rotY: -Math.PI / 2 };
  }
}

function placeWallPiece(
  ctx: RoomContext,
  side: WallSide,
  p: Piece
): Mesh {
  const { wallX, wallZ, rotY } = wallFrame(side, ctx);

  // Преобразование (lx, lz) → мир. Для каждой стороны своя логика,
  // чтобы lx=+ всегда был «вправо», если смотреть изнутри комнаты.
  let wx: number, wz: number;
  switch (side) {
    case "n": wx = wallX + p.lx; wz = wallZ + p.lz; break;
    case "s": wx = wallX - p.lx; wz = wallZ - p.lz; break;
    case "w": wx = wallX + p.lz; wz = wallZ - p.lx; break;
    case "e": wx = wallX - p.lz; wz = wallZ + p.lx; break;
  }
  const wy = ctx.floorY + p.ly + p.h / 2;

  // ── Геометрия ─────────────────────────────────────────────
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

  // ── Материал с учётом текстур ─────────────────────────────
  const mat = getCachedMaterial(ctx, p.mat, p.texU, p.texV, p.texW);
  mesh.material = mat;

  // ── Поворот ───────────────────────────────────────────────
  // Всегда через Euler (не quaternion), чтобы редактор читал
  // mesh.rotation без дополнительных преобразований.
  const hasLocalTilt = !!(p.rx || p.ry || p.rz);
  if (hasLocalTilt) {
    const qLocal = Quaternion.FromEulerAngles(
      p.rx ?? 0, p.ry ?? 0, p.rz ?? 0
    );
    const qWall = Quaternion.RotationAxis(Vector3.Up(), rotY);
    const qFinal = qWall.multiply(qLocal);
    const e = qFinal.toEulerAngles();
    mesh.rotation.set(e.x, e.y, e.z);
  } else if (rotY !== 0) {
    mesh.rotation.y = rotY;
  }

  mesh.checkCollisions = true;
  mesh.isPickable = false;

  // ── Metadata для редактора ────────────────────────────────
  const tex = (mesh.material as StandardMaterial).diffuseTexture as Texture | null;
  const texParams = {
    uScale: tex ? tex.uScale : 1,
    vScale: tex ? tex.vScale : 1,
    uOffset: tex ? tex.uOffset : 0,
    vOffset: tex ? tex.vOffset : 0,
    wAng: tex ? tex.wAng : 0,
  };

  mesh.metadata = {
    type: p.type,
    material: p.mat,
    w: p.w,
    h: p.h,
    d: p.d,
    tex: texParams,
  };

  return mesh;
}

// ═══════════════════════════════════════════════════════════════
//  ПУБЛИЧНЫЙ API
// ═══════════════════════════════════════════════════════════════

/**
 * Строит стену.
 *  • hasDoor = true  → точная копия стены с дверью из corner_ne.
 *  • hasDoor = false → сплошная стена (по южной стене corner_ne):
 *                      одна стена, одна балка, один плинтус,
 *                      кирпичи по всей длине включая зону двери.
 */
export function buildTemplatedWall(
  ctx: RoomContext,
  side: WallSide,
  hasDoor: boolean
): Mesh[] {
  const out: Mesh[] = [];

  if (hasDoor) {
    for (const p of WALL_WITH_DOOR_PIECES) {
      out.push(placeWallPiece(ctx, side, p));
    }
    // Кирпичи по бокам от двери (x = ±3..±8)
    for (let x = BRICK_X_MIN; x <= BRICK_X_MAX; x += BRICK_DX) {
      if (Math.abs(x) <= DOOR_HALF_ZONE) continue;
      out.push(placeWallPiece(ctx, side, brickPiece(x)));
    }
  } else {
    for (const p of WALL_WITHOUT_DOOR_PIECES) {
      out.push(placeWallPiece(ctx, side, p));
    }
    // Кирпичи по всей длине (включая зону, где была бы дверь)
    for (let x = BRICK_X_MIN; x <= BRICK_X_MAX; x += BRICK_DX) {
      out.push(placeWallPiece(ctx, side, brickPiece(x)));
    }
  }

  return out;
}