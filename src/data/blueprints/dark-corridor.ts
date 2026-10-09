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

// ============================================================
//  УЗКИЙ ТЁМНЫЙ КОРИДОР
//
//  Пол/потолок 5×18, торцевые стены с полноценным дверным
//  проёмом, боковые стены — 18 м глухие с тремя колоннами.
//
//  JSON снят для варианта N↔S (двери на севере и юге).
//  Вариант W↔E — тот же набор, повёрнутый на 90° вокруг Y.
//
//  ⚠ Факелов в JSON нет. Коридор освещается только фонариком
//    игрока и ambient-светом сцены.
// ============================================================

// ============================================================
//  СЛУЖЕБНОЕ
// ============================================================

type MatKey = "stone" | "darkStone" | "sand";

interface Piece {
  kind: "box" | "cyl";
  dx: number;   // центр по X (мировые для NS-варианта)
  dy: number;   // центр по Y, ОТ ПОЛА (пол = 0)
  dz: number;   // центр по Z
  w: number;    // для cyl — diameter
  h: number;
  d: number;
  rx: number;
  ry: number;
  rz: number;
  mat: MatKey;
  texU: number;
  texV: number;
  wAng: number;
  uOffset: number;
  vOffset: number;
  collide: boolean;
  pickable: boolean;
}

/**
 * Короткий конструктор пика. Дефолты:
 *   rx=ry=rz=0, wAng=0, uOffset=0, vOffset=0, collide=true, pickable=true.
 */
function P(
  kind: "box" | "cyl",
  dx: number, dy: number, dz: number,
  w: number, h: number, d: number,
  mat: MatKey, texU: number, texV: number,
  opts: Partial<Omit<Piece, "kind" | "dx" | "dy" | "dz" | "w" | "h" | "d" | "mat" | "texU" | "texV">> = {}
): Piece {
  return {
    kind, dx, dy, dz, w, h, d, mat, texU, texV,
    rx: opts.rx ?? 0,
    ry: opts.ry ?? 0,
    rz: opts.rz ?? 0,
    wAng: opts.wAng ?? 0,
    uOffset: opts.uOffset ?? 0,
    vOffset: opts.vOffset ?? 0,
    collide: opts.collide ?? true,
    pickable: opts.pickable ?? true,
  };
}

// ============================================================
//  ПОЛ / ПОТОЛОК
// ============================================================

const FLOOR_CEIL: Piece[] = [
  // Пол 5×18.9. Раньше было d:18 — на 0.9 короче клетки, из-за чего
  // у соседей была щель по краям. Тянем до 18.9 = CELL_SIZE.
  P("box", 0, -0.1, 0, 5, 0.2, 18.9, "sand", 1.5, 0.45,
    { vOffset: 0.234, pickable: false }),

  // Потолок 5×18 — НЕ меняю. Скажи, если надо тоже 18.9.
  P("box", 0, 5.15, 0, 5, 0.2, 18.9, "darkStone", 2, 0.6,
    { pickable: false }),
];

// ============================================================
//  СЕВЕРНАЯ СТЕНА (z = −9) — дверной проём
// ============================================================
//  Геометрия 1:1 из JSON. Дверной проём шириной 4 м, колонны
//  на x=±2.06, арка сверху.

const NORTH_WALL: Piece[] = [
  // Балка над всей стеной
  P("box", 0, 4.85, -9, 5, 0.7, 0.8, "darkStone", 4, 0.2),
  // Колонны по бокам проёма
  P("cyl", -2.06, 2.46, -9, 0.8, 4.5, 0.8, "sand", 1, 1),
  P("cyl",  2.06, 2.46, -9, 0.8, 4.5, 0.8, "sand", 1, 1),
  // Кубики-основания стоек двери
  P("box", -2, 0.33, -9, 0.9, 1, 0.9, "darkStone", 0.1, 0.1),
  P("box",  2, 0.33, -9, 0.9, 1, 0.9, "darkStone", 0.1, 0.1),
  // Второй уровень стойки
  P("box", -2, 1.3, -9, 0.9, 0.7, 0.9, "darkStone", 0.1, 0.1, { ry: -0.0252 }),
  P("box",  2, 1.3, -9, 0.9, 0.7, 0.9, "darkStone", 0.1, 0.1),
  // Верхний блок стойки
  P("box", -2, 3.71, -9, 0.9, 0.9, 0.9, "darkStone", 0.1, 0.1),
  P("box",  2, 3.71, -9, 0.9, 0.9, 0.9, "darkStone", 0.1, 0.1),
  // Вертикальные стойки проёма
  P("box", -2, 2.42, -9, 0.6, 5, 0.56, "darkStone", 6, 2),
  P("box",  2, 2.42, -9, 0.6, 5, 0.56, "darkStone", 6, 2),
  // Мелкие блоки на стойках
  P("box", -1.87, 2.58, -9, 0.5, 0.8, 0.6, "darkStone", 0.2, 0.2),
  P("box",  1.87, 2.58, -9, 0.5, 0.8, 0.6, "darkStone", 0.2, 0.2),
  // Арка — наклонные блоки
  P("box", -1.2, 4.38, -9, 0.9, 0.9, 0.9, "darkStone", 0.1, 0.1, { rz: 0.3604 }),
  P("box",  0,   4.61, -9, 0.9, 0.9, 0.9, "darkStone", 0.1, 0.1),
  P("box",  1.2, 4.38, -9, 0.9, 0.9, 0.9, "darkStone", 0.1, 0.1, { rz: -0.3613 }),
  // Каменные блоки арки
  P("box", -1.67, 4.33, -9, 0.9, 0.86, 0.6, "stone", 6, 2,
    { rx: 0.005, ry: 0.004, rz: 0.6661 }),
  P("box", -0.58, 4.63, -9, 0.9, 0.8, 0.6, "stone", 6, 2, { rz: 0.1356 }),
  P("box",  0.58, 4.63, -9, 0.9, 0.8, 0.6, "stone", 6, 2, { rz: -0.1361 }),
  P("box",  1.67, 4.33, -9, 0.9, 0.86, 0.6, "stone", 6, 2,
    { rx: -0.0052, ry: -0.0035, rz: -0.6667 }),
  // Горизонтальная балка внутри проёма
  P("box", 0, 3.54, -9, 4, 0.45, 0.4, "darkStone", 0.2, 0.2),
  // Тонкие стойки с внешней стороны стены
  P("box", -2, 2.4, -9.25, 0.4, 5, 0.4, "darkStone", 6, 2),
  P("box",  2, 2.4, -9.25, 0.4, 5, 0.4, "darkStone", 6, 2),
];

// ============================================================
//  ЮЖНАЯ СТЕНА (z = +9) — дверной проём
// ============================================================
//  Транскрипция из JSON 1:1. Лёгкие опечатки редактора
//  (ry=3.1164, ry=-3.1376, ry=3.1381) сохранены — если
//  заметишь искажение, скажи, приведу к чистому π.

const SOUTH_WALL: Piece[] = [
  P("box", 0, 4.85, 9, 5, 0.7, 0.8, "darkStone", 4, 0.2, { ry: Math.PI }),
  P("cyl",  2.06, 2.46, 9, 0.8, 4.5, 0.8, "sand", 1, 1, { ry: Math.PI }),
  P("cyl", -2.06, 2.46, 9, 0.8, 4.5, 0.8, "sand", 1, 1, { ry: Math.PI }),
  P("box",  2, 0.33, 9, 0.9, 1, 0.9, "darkStone", 0.1, 0.1, { ry: Math.PI }),
  P("box", -2, 0.33, 9, 0.9, 1, 0.9, "darkStone", 0.1, 0.1, { ry: Math.PI }),
  P("box",  2, 1.3, 9, 0.9, 0.7, 0.9, "darkStone", 0.1, 0.1, { ry: 3.1164 }),
  P("box", -2, 1.3, 9, 0.9, 0.7, 0.9, "darkStone", 0.1, 0.1, { ry: Math.PI }),
  P("box",  2, 3.71, 9, 0.9, 0.9, 0.9, "darkStone", 0.1, 0.1, { ry: Math.PI }),
  P("box", -2, 3.71, 9, 0.9, 0.9, 0.9, "darkStone", 0.1, 0.1, { ry: Math.PI }),
  P("box",  2, 2.42, 9, 0.6, 5, 0.56, "darkStone", 6, 2, { ry: Math.PI }),
  P("box", -2, 2.42, 9, 0.6, 5, 0.56, "darkStone", 6, 2, { ry: Math.PI }),
  P("box",  1.87, 2.58, 9, 0.5, 0.8, 0.6, "darkStone", 0.2, 0.2, { ry: Math.PI }),
  P("box", -1.87, 2.58, 9, 0.5, 0.8, 0.6, "darkStone", 0.2, 0.2, { ry: Math.PI }),
  P("box",  1.2, 4.38, 9, 0.9, 0.9, 0.9, "darkStone", 0.1, 0.1,
    { ry: Math.PI, rz: 0.3604 }),
  P("box",  0,   4.61, 9, 0.9, 0.9, 0.9, "darkStone", 0.1, 0.1, { ry: Math.PI }),
  P("box", -1.2, 4.38, 9, 0.9, 0.9, 0.9, "darkStone", 0.1, 0.1,
    { ry: Math.PI, rz: -0.3613 }),
  P("box",  1.67, 4.33, 9, 0.9, 0.86, 0.6, "stone", 6, 2,
    { rx: 0.005, ry: -3.1376, rz: 0.6661 }),
  P("box",  0.58, 4.63, 9, 0.9, 0.8, 0.6, "stone", 6, 2,
    { ry: Math.PI, rz: 0.1356 }),
  P("box", -0.58, 4.63, 9, 0.9, 0.8, 0.6, "stone", 6, 2,
    { ry: Math.PI, rz: -0.1361 }),
  P("box", -1.67, 4.33, 9, 0.9, 0.86, 0.6, "stone", 6, 2,
    { rx: -0.0052, ry: 3.1381, rz: -0.6667 }),
  P("box", 0, 3.54, 9, 4, 0.45, 0.4, "darkStone", 0.2, 0.2, { ry: Math.PI }),
  P("box",  2, 2.4, 9.25, 0.4, 5, 0.4, "darkStone", 6, 2, { ry: Math.PI }),
  P("box", -2, 2.4, 9.25, 0.4, 5, 0.4, "darkStone", 6, 2, { ry: Math.PI }),
];

// ============================================================
//  ЗАПАДНАЯ СТЕНА (x = −2.17) — глухая, с тремя колоннами
// ============================================================
//  Основная стена 18×4.5 повёрнута на ry=π/2 (чтобы «ширина»
//  шла по Z, а толщина — по X).
//
//  Колонны на z = −4.5, 0, +4.5. У каждой — обвязка:
//    • нижний блок 0.9×1×0.9
//    • вертикальная стойка 0.6×5×0.56
//    • декоративный блок 0.5×0.8×0.6 (только z=0 и z=+4.5)
//    • средний блок 0.9×0.7×0.9

const WEST_WALL: Piece[] = [
  // Основная стена (18 длиной, 0.5 толщиной, вдоль Z)
  P("box", -2.17, 2.38, 0, 18, 4.5, 0.5, "stone", 2, 1,
    { ry: Math.PI / 2, wAng: Math.PI }),
  // Верхняя балка
  P("box", -2, 4.85, 0, 18, 0.7, 0.8, "darkStone", 4, 0.2, { ry: Math.PI / 2 }),
  // Нижний плинтус (у западной стены он на y=0.26, а не 0.14 —
  // отличается от плинтуса в wall-template; так в JSON)
  P("box", -2.12, 0.26, 0, 18, 0.7, 0.8, "darkStone", 4, 0.2, { ry: Math.PI / 2 }),

  // ── Колонны ────────────────────────────────────────────
  P("cyl", -2.06, 2.46, -4.5, 0.8, 4.5, 0.8, "sand", 1, 1),
  P("cyl", -2.06, 2.46,  0,   0.8, 4.5, 0.8, "sand", 1, 1),
  P("cyl", -2.06, 2.46,  4.5, 0.8, 4.5, 0.8, "sand", 1, 1),

  // ── Обвязка колонны z = −4.5 ───────────────────────────
  //   (в JSON у этой колонны нет декоративного блока 0.5×0.8×0.6)
  P("box", -2, 0.33, -4.5, 0.9, 1, 0.9, "darkStone", 0.1, 0.1, { ry: Math.PI }),
  P("box", -2, 2.42, -4.5, 0.6, 5, 0.56, "darkStone", 6, 2, { ry: Math.PI }),
  P("box", -2, 1.3,  -4.5, 0.9, 0.7, 0.9, "darkStone", 0.1, 0.1, { ry: Math.PI }),

  // ── Обвязка колонны z = 0 ──────────────────────────────
  P("box", -2, 0.33, 0, 0.9, 1, 0.9, "darkStone", 0.1, 0.1, { ry: Math.PI }),
  P("box", -2, 2.42, 0, 0.6, 5, 0.56, "darkStone", 6, 2, { ry: Math.PI }),
  P("box", -1.87, 2.58, 0, 0.5, 0.8, 0.6, "darkStone", 0.2, 0.2, { ry: Math.PI }),
  P("box", -2, 1.3,  0, 0.9, 0.7, 0.9, "darkStone", 0.1, 0.1, { ry: Math.PI }),

  // ── Обвязка колонны z = +4.5 ───────────────────────────
  P("box", -2, 0.33, 4.5, 0.9, 1, 0.9, "darkStone", 0.1, 0.1, { ry: Math.PI }),
  P("box", -2, 2.42, 4.5, 0.6, 5, 0.56, "darkStone", 6, 2, { ry: Math.PI }),
  P("box", -1.87, 2.58, 4.5, 0.5, 0.8, 0.6, "darkStone", 0.2, 0.2, { ry: Math.PI }),
  P("box", -2, 1.3,  4.5, 0.9, 0.7, 0.9, "darkStone", 0.1, 0.1, { ry: Math.PI }),
];

/**
 * Отражает набор пиков через плоскость YZ (x → −x).
 *
 * Для нашего случая (rx=rz=0 везде, ry ∈ {0, π/2, π}) отражение
 * даёт: dx → −dx, ry → −ry. Проверено через матрицы:
 *   M · Ry(θ) · M = Ry(−θ),  M = diag(−1, 1, 1).
 *
 * ⚠ Если в будущем добавим пики с rx≠0 или rz≠0 — эта функция
 *    должна их обрабатывать тоже (сейчас она их не трогает).
 */
function mirrorPieces(src: Piece[]): Piece[] {
  return src.map((p) => ({ ...p, dx: -p.dx, ry: -p.ry }));
}

// Восточная стена — отражение западной. Считаем ОДИН раз.
const EAST_WALL: Piece[] = mirrorPieces(WEST_WALL);

// ============================================================
//  РАЗМЕЩЕНИЕ
// ============================================================

function matFromKey(ctx: RoomContext, key: MatKey): StandardMaterial {
  switch (key) {
    case "stone":     return ctx.materials.stone;
    case "darkStone": return ctx.materials.darkStone;
    case "sand":      return ctx.materials.sand;
  }
}

/**
 * Клон материала с ПОЛНЫМ набором tex-параметров (включая
 * uOffset/vOffset — их `room-kit.applyTex` не поддерживает).
 * Клонирую ВСЕГДА: у каждого пика свой набор UV.
 */
function cloneMatFull(
  ctx: RoomContext,
  base: StandardMaterial,
  meshName: string,
  texU: number, texV: number, wAng: number,
  uOffset: number, vOffset: number
): StandardMaterial {
  const cloned = base.clone(`${base.name}_${meshName}`);
  // maxSimultaneousLights обязателен: у нас в сцене 30+ источников
  // света, и без явного 8 фонарик игрока не попадёт в шейдер.
  cloned.maxSimultaneousLights = 8;

  if (base.diffuseTexture) {
    cloned.diffuseTexture = base.diffuseTexture.clone();
  }
  const tex = cloned.diffuseTexture as Texture | null;
  if (tex) {
    tex.uScale = texU;
    tex.vScale = texV;
    tex.wAng = wAng;
    tex.uOffset = uOffset;
    tex.vOffset = vOffset;
  }
  return cloned;
}

/**
 * Размещает один пик в мире.
 *
 *  1. Берём локальные (dx, dy, dz) — уже с учётом возможного
 *     отражения (для восточной стены его применили заранее).
 *  2. Крутим позицию на roomRotY вокруг центра комнаты
 *     (для W↔E варианта roomRotY = π/2, тогда N→W, S→E).
 *  3. Ориентацию получаем как qRoom · qLocal — тот же приём,
 *     что в wall-template.placeWallPiece.
 *
 * Обрати внимание: dy — это ЦЕНТР меша (как в JSON редактора),
 * поэтому worldY = floorY + dy (БЕЗ прибавления h/2).
 */
function placePiece(
  ctx: RoomContext,
  p: Piece,
  roomRotY: number,
  index: number,
  tag: string
): Mesh {
  // ── Поворот позиции ────────────────────────────────────
  const cos = Math.cos(roomRotY);
  const sin = Math.sin(roomRotY);
  const px =  p.dx * cos + p.dz * sin;
  const pz = -p.dx * sin + p.dz * cos;

  // ── Ориентация ─────────────────────────────────────────
  let ex = p.rx, ey = p.ry, ez = p.rz;
  if (roomRotY !== 0) {
    const qLocal = Quaternion.FromEulerAngles(p.rx, p.ry, p.rz);
    const qRoom  = Quaternion.RotationAxis(Vector3.Up(), roomRotY);
    const e = qRoom.multiply(qLocal).toEulerAngles();
    ex = e.x; ey = e.y; ez = e.z;
  }

  // ── Геометрия ──────────────────────────────────────────
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

  // ── Материал ───────────────────────────────────────────
  const base = matFromKey(ctx, p.mat);
  mesh.material = cloneMatFull(
    ctx, base, mesh.name,
    p.texU, p.texV, p.wAng, p.uOffset, p.vOffset
  );

  // ── Коллизии / pick ────────────────────────────────────
  mesh.checkCollisions = p.collide;
  mesh.isPickable = p.pickable;

  // ── Metadata для редактора ─────────────────────────────
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
//  ФАБРИКА
// ============================================================

type Axis = "ns" | "we";

function makeNarrowCorridor(id: string, label: string, axis: Axis): RoomBlueprint {
  // Для N↔S поворот = 0 (координаты JSON — уже финальные).
  // Для W↔E поворот = π/2: N(-Z) → W(-X), S(+Z) → E(+X).
  const rotY = axis === "ns" ? 0 : Math.PI / 2;

  const exits = axis === "ns"
    ? { ...NO_EXITS, n: true, s: true }
    : { ...NO_EXITS, w: true, e: true };

  return {
    id,
    category: "corridor",
    label,
    exits,
    weight: 5,
    footprint: { w: 1, h: 1 },

    build(ctx) {
      const out: AbstractMesh[] = [];

      FLOOR_CEIL.forEach((p, i) => out.push(placePiece(ctx, p, rotY, i, "fc")));
      NORTH_WALL.forEach((p, i) => out.push(placePiece(ctx, p, rotY, i, "n")));
      SOUTH_WALL.forEach((p, i) => out.push(placePiece(ctx, p, rotY, i, "s")));
      WEST_WALL.forEach((p, i) => out.push(placePiece(ctx, p, rotY, i, "w")));
      EAST_WALL.forEach((p, i) => out.push(placePiece(ctx, p, rotY, i, "e")));

      return out;
    },
  };
}

// ─── Экспорт ────────────────────────────────────────────────────────
//  Имена и id сохранены: GridLevelGenerator ищет blueprint'ы по
//  строке "dark_corridor_ns" / "dark_corridor_we" в extendToApproach.
export const DARK_CORRIDOR_NS = makeNarrowCorridor(
  "dark_corridor_ns",
  "Тёмный коридор N↔S",
  "ns",
);

export const DARK_CORRIDOR_WE = makeNarrowCorridor(
  "dark_corridor_we",
  "Тёмный коридор W↔E",
  "we",
);