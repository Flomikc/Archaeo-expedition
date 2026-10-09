import {
  AbstractMesh,
  Mesh,
  MeshBuilder,
  Quaternion,
  StandardMaterial,
  Texture,
  Vector3,
} from "@babylonjs/core";

import { NO_EXITS, RoomBlueprint, RoomContext } from "../RoomBlueprint";
import {
  boxAt,
  buildAllWalls,
  buildCeiling,
  buildFloorWithHole,
  buildTorch,
} from "../room-kit";

// ============================================================
//  ЛЕСТНИЦА ВВЕРХ + ПЛОЩАДКА
//
//  STAIR_UP — симметричная комната с ДВУМЯ лестницами
//  (x=+2.4 и x=−2.4), идущими вверх с юга на север. Потолка
//  НЕТ: верх лестницы торчит выше стен, игрок выходит на
//  следующий этаж через открытое пространство сверху.
//
//  Генератор задаёт единственную горизонтальную дверь через
//  exitsOverride — комната поворачивается под неё (rotY).
//  Канонический JSON — вход с юга, T = север, rotY = 0.
//
//  STAIR_LANDING — верхняя площадка, живёт здесь же,
//  пока на штатных хелперах (JSON для неё ещё не присылали).
// ============================================================

type Dir = "n" | "s" | "w" | "e";
type MatKey = "stone" | "darkStone" | "sand";

function opposite(d: Dir): Dir {
  return d === "n" ? "s" : d === "s" ? "n" : d === "w" ? "e" : "w";
}

/** Единственный горизонтальный выход — иначе stair_up не имеет смысла. */
function findHorizontalExit(ctx: RoomContext): Dir | null {
  const found: Dir[] = [];
  if (ctx.doors.n) found.push("n");
  if (ctx.doors.s) found.push("s");
  if (ctx.doors.w) found.push("w");
  if (ctx.doors.e) found.push("e");
  if (found.length !== 1) return null;
  return found[0];
}

/**
 * Угол поворота всей комнаты, чтобы канонический север (T=n)
 * совпал с реальным T.
 *   T=n → 0   (канонический JSON)
 *   T=s → π
 *   T=w → π/2
 *   T=e → −π/2
 */
function rotYForT(T: Dir): number {
  switch (T) {
    case "n": return 0;
    case "s": return Math.PI;
    case "w": return Math.PI / 2;
    case "e": return -Math.PI / 2;
  }
}

/** Дыра в потолке landing — по направлению движения. */
function holeOffset(T: Dir): { dx: number; dz: number; halfW: number; halfD: number } {
  switch (T) {
    case "n": return { dx: 0,  dz: -3, halfW: 2, halfD: 3 };
    case "s": return { dx: 0,  dz: +3, halfW: 2, halfD: 3 };
    case "e": return { dx: +3, dz: 0,  halfW: 3, halfD: 2 };
    case "w": return { dx: -3, dz: 0,  halfW: 3, halfD: 2 };
  }
}

// ============================================================
//  ПИС И ХЕЛПЕРЫ
// ============================================================

interface Piece {
  kind: "box" | "cyl";
  dx: number; dy: number; dz: number;
  w: number; h: number; d: number;
  rx: number; ry: number; rz: number;
  mat: MatKey;
  texU: number; texV: number; wAng: number;
  uOffset: number; vOffset: number;
  collide: boolean; pickable: boolean;
}

function P(
  kind: "box" | "cyl",
  dx: number, dy: number, dz: number,
  w: number, h: number, d: number,
  mat: MatKey, texU: number, texV: number,
  opts: Partial<Omit<Piece, "kind" | "dx" | "dy" | "dz" | "w" | "h" | "d" | "mat" | "texU" | "texV">> = {}
): Piece {
  return {
    kind, dx, dy, dz, w, h, d, mat, texU, texV,
    rx: opts.rx ?? 0, ry: opts.ry ?? 0, rz: opts.rz ?? 0,
    wAng: opts.wAng ?? 0,
    uOffset: opts.uOffset ?? 0, vOffset: opts.vOffset ?? 0,
    collide: opts.collide ?? true, pickable: opts.pickable ?? true,
  };
}

/**
 * Отражение через плоскость YZ (x → −x).
 * Для пиков с rx — Rx(θ) инвариантна относительно этого отражения,
 * поэтому rx НЕ трогаем. Для Ry и Rz: M·R·M = R(−θ), значит
 * ry → −ry, rz → −rz.
 */
function mirrorPiece(p: Piece): Piece {
  return { ...p, dx: -p.dx, ry: -p.ry, rz: -p.rz };
}

// ============================================================
//  ГЕОМЕТРИЯ — данные из JSON
// ============================================================

// ── Пол ────────────────────────────────────────────────────
const FLOOR: Piece[] = [
  P("box", 0, -0.1, 0, 12, 0.2, 18, "sand", 1.5, 1, { pickable: false }),
];

// ── Наклонная балка (визуальный «каркас» под ступенями) ────
const RAMP: Piece[] = [
  P("box", 0, 2.72, -0.93, 5, 0.4, 12, "darkStone", 1.6, 1.2, { rx: 0.5211 }),
];

// ── Северная стена (z=−9) — глухая, кирпичи 13 шт ──────────
const NORTH_WALL: Piece[] = (() => {
  const out: Piece[] = [
    P("box", 0, 2.25, -9, 12, 4.5, 0.5, "stone", 1.33, 1, { wAng: Math.PI }),
    P("box", 0, 4.85, -9, 13, 0.7, 0.8, "darkStone", 4, 0.2),
    P("box", 0, 0.14, -9, 12, 0.7, 0.8, "sand", 0.4, 0.2, { wAng: Math.PI }),
  ];
  for (let x = -6; x <= 6; x++) {
    out.push(P("box", x, 0.33, -9, 0.9, 0.7, 0.9, "darkStone", 0.1, 0.1));
  }
  return out;
})();

// ── Южная стена (z=+9) с дверью + ВСЕ обвязки ─────────────
//  Полностью из JSON, включая западную половину двери
//  (wall на x=−4.45 и плинтус) — она была в конце JSON.
const SOUTH_WALL: Piece[] = [
  // Боковые панели стены (западнее и восточнее двери)
  P("box", 4.45, 2.25, 9, 4.6, 4.5, 0.5, "stone", 0.6, 1,
    { ry: Math.PI, wAng: Math.PI }),
  P("box", -4.45, 2.25, 9, 4.6, 4.5, 0.5, "stone", 0.6, 1,
    { ry: Math.PI, wAng: Math.PI }),
  // Верхняя балка
  P("box", 0, 4.85, 9, 13, 0.7, 0.8, "darkStone", 4, 0.2, { ry: Math.PI }),
  // Плинтусы под панелями
  P("box", 4.45, 0.14, 9, 4.6, 0.7, 0.8, "sand", 0.2, 0.2, { ry: Math.PI }),
  P("box", -4.45, 0.14, 9, 4.6, 0.7, 0.8, "sand", 0.2, 0.2, { ry: Math.PI }),
  // Колонны по бокам двери
  P("cyl", 2.06, 2.46, 9, 0.8, 4.5, 0.8, "sand", 1, 1, { ry: Math.PI }),
  P("cyl", -2.06, 2.46, 9, 0.8, 4.5, 0.8, "sand", 1, 1, { ry: Math.PI }),
  // Кубики-основания дверных стоек
  P("box", 2, 0.33, 9, 0.9, 1, 0.9, "darkStone", 0.1, 0.1, { ry: Math.PI }),
  P("box", -2, 0.33, 9, 0.9, 1, 0.9, "darkStone", 0.1, 0.1, { ry: Math.PI }),
  // Второй уровень стоек (в JSON восточная чуть отклонена)
  P("box", 2, 1.3, 9, 0.9, 0.7, 0.9, "darkStone", 0.1, 0.1, { ry: 3.1164 }),
  P("box", -2, 1.3, 9, 0.9, 0.7, 0.9, "darkStone", 0.1, 0.1, { ry: Math.PI }),
  // Верхние блоки стоек
  P("box", 2, 3.71, 9, 0.9, 0.9, 0.9, "darkStone", 0.1, 0.1, { ry: Math.PI }),
  P("box", -2, 3.71, 9, 0.9, 0.9, 0.9, "darkStone", 0.1, 0.1, { ry: Math.PI }),
  // Вертикальные стойки двери
  P("box", 2, 2.42, 9, 0.6, 5, 0.56, "darkStone", 6, 2, { ry: Math.PI }),
  P("box", -2, 2.42, 9, 0.6, 5, 0.56, "darkStone", 6, 2, { ry: Math.PI }),
  // Мелкие блоки на стойках
  P("box", 1.87, 2.58, 9, 0.5, 0.8, 0.6, "darkStone", 0.2, 0.2, { ry: Math.PI }),
  P("box", -1.87, 2.58, 9, 0.5, 0.8, 0.6, "darkStone", 0.2, 0.2, { ry: Math.PI }),
  // Арка — наклонные блоки
  P("box", 1.2, 4.38, 9, 0.9, 0.9, 0.9, "darkStone", 0.1, 0.1,
    { ry: Math.PI, rz: 0.3604 }),
  P("box", 0, 4.61, 9, 0.9, 0.9, 0.9, "darkStone", 0.1, 0.1, { ry: Math.PI }),
  P("box", -1.2, 4.38, 9, 0.9, 0.9, 0.9, "darkStone", 0.1, 0.1,
    { ry: Math.PI, rz: -0.3613 }),
  // Каменные блоки арки
  P("box", 1.67, 4.33, 9, 0.9, 0.86, 0.6, "stone", 6, 2,
    { rx: 0.005, ry: -3.1376, rz: 0.6661 }),
  P("box", 0.58, 4.63, 9, 0.9, 0.8, 0.6, "stone", 6, 2,
    { ry: Math.PI, rz: 0.1356 }),
  P("box", -0.58, 4.63, 9, 0.9, 0.8, 0.6, "stone", 6, 2,
    { ry: Math.PI, rz: -0.1361 }),
  P("box", -1.67, 4.33, 9, 0.9, 0.86, 0.6, "stone", 6, 2,
    { rx: -0.0052, ry: 3.1381, rz: -0.6667 }),
  // Горизонтальная балка внутри проёма
  P("box", 0, 3.54, 9, 4, 0.45, 0.4, "darkStone", 0.2, 0.2, { ry: Math.PI }),
  // Тонкие стойки с внешней стороны
  P("box", 2, 2.4, 9.25, 0.4, 5, 0.4, "darkStone", 6, 2, { ry: Math.PI }),
  P("box", -2, 2.4, 9.25, 0.4, 5, 0.4, "darkStone", 6, 2, { ry: Math.PI }),
  // Кирпичи-дорожка по обеим сторонам двери (3..6 и -6..-3)
  P("box", 3, 0.33, 9, 0.9, 0.7, 0.9, "darkStone", 0.1, 0.1, { ry: Math.PI }),
  P("box", 4, 0.33, 9, 0.9, 0.7, 0.9, "darkStone", 0.1, 0.1, { ry: Math.PI }),
  P("box", 5, 0.33, 9, 0.9, 0.7, 0.9, "darkStone", 0.1, 0.1, { ry: Math.PI }),
  P("box", 6, 0.33, 9, 0.9, 0.7, 0.9, "darkStone", 0.1, 0.1, { ry: Math.PI }),
  P("box", -3, 0.33, 9, 0.9, 0.7, 0.9, "darkStone", 0.1, 0.1, { ry: Math.PI }),
  P("box", -4, 0.33, 9, 0.9, 0.7, 0.9, "darkStone", 0.1, 0.1, { ry: Math.PI }),
  P("box", -5, 0.33, 9, 0.9, 0.7, 0.9, "darkStone", 0.1, 0.1, { ry: Math.PI }),
  P("box", -6, 0.33, 9, 0.9, 0.7, 0.9, "darkStone", 0.1, 0.1, { ry: Math.PI }),
];

// ── Боковая стена (мастер: восточная, x=+6) ─────────────────
const SIDE_WALL_EAST: Piece[] = (() => {
  const out: Piece[] = [
    P("box", 6, 2.25, 0, 18, 4.5, 0.5, "stone", 2, 1, { ry: -Math.PI / 2 }),
    P("box", 6, 4.85, 0, 18, 0.7, 0.8, "darkStone", 4, 0.2, { ry: -Math.PI / 2 }),
    P("box", 6, 0.14, 0, 18, 0.7, 0.8, "sand", 0.4, 0.2,
      { ry: -Math.PI / 2, wAng: Math.PI }),
  ];
  for (let z = -8; z <= 8; z++) {
    out.push(P("box", 6, 0.33, z, 0.9, 0.7, 0.9, "darkStone", 0.1, 0.1,
      { ry: -Math.PI / 2 }));
  }
  return out;
})();

const SIDE_WALL_WEST: Piece[] = SIDE_WALL_EAST.map(mirrorPiece);

// ── Лестница (мастер: восточная, x=+2.4) ───────────────────
//  Нижний блок → 7 ступеней с наклоном rx=0.5219 → средний
//  блок → верхний блок. Плюс два цилиндра-опоры.
const STAIRS_EAST: Piece[] = [
  // Нижний блок
  P("box", 2.4, 0.78, 3.8, 1.4, 2, 1.4, "sand", 0.1, 0.1,
    { uOffset: 0.2, vOffset: 0.1 }),
  // 7 ступеней
  P("box", 2.4, 1.0, 2.1, 1, 1, 1, "sand", 0.1, 0.1,
    { rx: 0.5219, uOffset: 0.2, vOffset: 0.1 }),
  P("box", 2.4, 1.64, 0.98, 1, 1, 1, "sand", 0.1, 0.1,
    { rx: 0.5219, uOffset: 0.2, vOffset: 0.1 }),
  P("box", 2.4, 2.28, -0.13, 1, 1, 1, "sand", 0.1, 0.1,
    { rx: 0.5219, uOffset: 0.2, vOffset: 0.1 }),
  P("box", 2.4, 2.92, -1.24, 1, 1, 1, "sand", 0.1, 0.1,
    { rx: 0.5219, uOffset: 0.2, vOffset: 0.1 }),
  P("box", 2.4, 3.56, -2.35, 1, 1, 1, "sand", 0.1, 0.1,
    { rx: 0.5219, uOffset: 0.2, vOffset: 0.1 }),
  P("box", 2.4, 4.19, -3.44, 1, 1, 1, "sand", 0.1, 0.1,
    { rx: 0.5219, uOffset: 0.2, vOffset: 0.1 }),
  P("box", 2.4, 4.82, -4.54, 1, 1, 1, "sand", 0.1, 0.1,
    { rx: 0.5219, uOffset: 0.2, vOffset: 0.1 }),
  // Средний и верхний блоки
  P("box", 2.4, 2.86, -0.8, 1.4, 2.4, 1.4, "sand", 0.1, 0.1,
    { uOffset: 0.2, vOffset: 0.1 }),
  P("box", 2.4, 5.47, -5.36, 1.4, 2.4, 1.4, "sand", 0.1, 0.1,
    { uOffset: 0.2, vOffset: 0.1 }),
  // Цилиндры-опоры
  P("cyl", 2.4, 2.24, -5.36, 1.3, 5, 0.8, "sand", 1, 1.5, { ry: Math.PI }),
  P("cyl", 2.4, 1.02, -0.8, 1.3, 3, 0.8, "sand", 1, 1, { ry: Math.PI }),
];

const STAIRS_WEST: Piece[] = STAIRS_EAST.map(mirrorPiece);

// ============================================================
//  МАТЕРИАЛЫ
// ============================================================

function matFromKey(ctx: RoomContext, key: MatKey): StandardMaterial {
  switch (key) {
    case "stone":     return ctx.materials.stone;
    case "darkStone": return ctx.materials.darkStone;
    case "sand":      return ctx.materials.sand;
  }
}

function cloneMatFull(
  ctx: RoomContext, base: StandardMaterial, meshName: string,
  texU: number, texV: number, wAng: number,
  uOffset: number, vOffset: number
): StandardMaterial {
  const cloned = base.clone(`${base.name}_${meshName}`);
  cloned.maxSimultaneousLights = 8;
  if (base.diffuseTexture) {
    cloned.diffuseTexture = base.diffuseTexture.clone();
  }
  const tex = cloned.diffuseTexture as Texture | null;
  if (tex) {
    tex.uScale = texU; tex.vScale = texV;
    tex.wAng = wAng;
    tex.uOffset = uOffset; tex.vOffset = vOffset;
  }
  return cloned;
}

// ============================================================
//  РАЗМЕЩЕНИЕ
// ============================================================

function placePiece(
  ctx: RoomContext, p: Piece, rotY: number, index: number, tag: string
): Mesh {
  const cos = Math.cos(rotY);
  const sin = Math.sin(rotY);
  const px =  p.dx * cos + p.dz * sin;
  const pz = -p.dx * sin + p.dz * cos;

  let ex = p.rx, ey = p.ry, ez = p.rz;
  if (rotY !== 0) {
    const qLocal = Quaternion.FromEulerAngles(p.rx, p.ry, p.rz);
    const qRoom  = Quaternion.RotationAxis(Vector3.Up(), rotY);
    const e = qRoom.multiply(qLocal).toEulerAngles();
    ex = e.x; ey = e.y; ez = e.z;
  }

  let mesh: Mesh;
  if (p.kind === "cyl") {
    mesh = MeshBuilder.CreateCylinder(
      `${tag}_cyl_${index}`,
      { height: p.h, diameter: p.w, tessellation: 16 },
      ctx.scene
    );
  } else {
    mesh = MeshBuilder.CreateBox(
      `${tag}_box_${index}`,
      { width: p.w, height: p.h, depth: p.d },
      ctx.scene
    );
  }

  mesh.position.set(ctx.centerX + px, ctx.floorY + p.dy, ctx.centerZ + pz);
  mesh.rotation.set(ex, ey, ez);

  const base = matFromKey(ctx, p.mat);
  mesh.material = cloneMatFull(ctx, base, mesh.name,
    p.texU, p.texV, p.wAng, p.uOffset, p.vOffset);

  mesh.checkCollisions = p.collide;
  mesh.isPickable = p.pickable;

  mesh.metadata = {
    type: p.kind === "cyl" ? "column" : "wall",
    material: p.mat,
    w: p.w, h: p.h, d: p.d,
    tex: {
      uScale: p.texU, vScale: p.texV,
      uOffset: p.uOffset, vOffset: p.vOffset,
      wAng: p.wAng,
    },
  };

  return mesh;
}

// ============================================================
//  STAIR_UP
// ============================================================

export const STAIR_UP: RoomBlueprint = {
  id: "stair_up",
  category: "stair",
  label: "Лестница вверх",
  // exits — заглушка, генератор всегда переопределяет.
  exits: { ...NO_EXITS, s: true, up: true },
  weight: 0,
  footprint: { w: 1, h: 1 },

  build(ctx) {
    const out: AbstractMesh[] = [];
    const entry = findHorizontalExit(ctx);
    if (!entry) {
      console.warn("[stair_up] нет единственного горизонтального выхода в ctx.doors");
      return out;
    }
    const T = opposite(entry);
    const rotY = rotYForT(T);

    FLOOR.forEach((p, i)        => out.push(placePiece(ctx, p, rotY, i, "f")));
    RAMP.forEach((p, i)         => out.push(placePiece(ctx, p, rotY, i, "r")));
    NORTH_WALL.forEach((p, i)   => out.push(placePiece(ctx, p, rotY, i, "n")));
    SOUTH_WALL.forEach((p, i)   => out.push(placePiece(ctx, p, rotY, i, "s")));
    SIDE_WALL_EAST.forEach((p, i) => out.push(placePiece(ctx, p, rotY, i, "e")));
    SIDE_WALL_WEST.forEach((p, i) => out.push(placePiece(ctx, p, rotY, i, "w")));
    STAIRS_EAST.forEach((p, i)  => out.push(placePiece(ctx, p, rotY, i, "ste")));
    STAIRS_WEST.forEach((p, i)  => out.push(placePiece(ctx, p, rotY, i, "stw")));

    // Потолка НЕТ — комната открыта сверху.
    return out;
  },
};

// ============================================================
//  STAIR_LANDING (не тронут — нет JSON, оставляю на хелперах)
// ============================================================

function railPositions(T: Dir): Array<{ dx: number; dz: number; w: number; d: number }> {
  switch (T) {
    case "n": return [
      { dx: 0,    dz: 0,    w: 4.4, d: 0.2 },
      { dx: -2.2, dz: -3,   w: 0.2, d: 6.4 },
      { dx: +2.2, dz: -3,   w: 0.2, d: 6.4 },
    ];
    case "s": return [
      { dx: 0,    dz: 0,    w: 4.4, d: 0.2 },
      { dx: -2.2, dz: +3,   w: 0.2, d: 6.4 },
      { dx: +2.2, dz: +3,   w: 0.2, d: 6.4 },
    ];
    case "e": return [
      { dx: 0,    dz: 0,    w: 0.2, d: 4.4 },
      { dx: +3,   dz: -2.2, w: 6.4, d: 0.2 },
      { dx: +3,   dz: +2.2, w: 6.4, d: 0.2 },
    ];
    case "w": return [
      { dx: 0,    dz: 0,    w: 0.2, d: 4.4 },
      { dx: -3,   dz: -2.2, w: 6.4, d: 0.2 },
      { dx: -3,   dz: +2.2, w: 6.4, d: 0.2 },
    ];
  }
}

function sideWalls(T: Dir): [Dir, Dir] {
  switch (T) {
    case "n": return ["w", "e"];
    case "s": return ["w", "e"];
    case "e": return ["n", "s"];
    case "w": return ["n", "s"];
  }
}

export const STAIR_LANDING: RoomBlueprint = {
  id: "stair_landing",
  category: "stair",
  label: "Лестничная площадка (верх)",
  exits: { ...NO_EXITS, n: true, down: true },
  weight: 0,
  footprint: { w: 1, h: 1 },

  build(ctx) {
    const out: AbstractMesh[] = [];
    const exit = findHorizontalExit(ctx);
    if (!exit) {
      console.warn("[stair_landing] нет горизонтального выхода в ctx.doors");
      return out;
    }
    const T = exit;

    out.push(...buildFloorWithHole(ctx, holeOffset(T)));
    out.push(...buildCeiling(ctx));
    out.push(...buildAllWalls(ctx));

    for (const r of railPositions(T)) {
      out.push(boxAt(ctx, "rail", r.dx, r.dz, 0, r.w, 0.8, r.d, ctx.materials.wood));
    }

    const [s1, s2] = sideWalls(T);
    out.push(...buildTorch(ctx, s1, 0.5));
    out.push(...buildTorch(ctx, s2, 0.5));

    return out;
  },
};