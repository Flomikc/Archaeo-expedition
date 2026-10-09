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
  buildAllWalls,
  buildCeiling,
  buildFloor,
} from "../room-kit";

// ============================================================
//  УГЛОВАЯ КОМНАТА С БАССЕЙНОМ И ПАВИЛЬОНОМ
//
//  Исходный JSON снят для corner_ne: двери на N и E, декор
//  (бассейн, два ручья, павильон) — в юго-западном «мёртвом»
//  углу, то есть в углу, противоположном обеим дверям.
//
//  Идея: строим декор один раз в координатах corner_ne, а
//  потом крутим его вокруг центра комнаты на нужный угол для
//  каждого из 4 вариантов. Так не нужно переписывать 30
//  координат под каждый поворот.
// ============================================================

type Side = "n" | "s" | "w" | "e";

/** Собирает exits из двух сторон. */
function exitsOf(a: Side, b: Side) {
  return {
    ...NO_EXITS,
    n: a === "n" || b === "n",
    s: a === "s" || b === "s",
    w: a === "w" || b === "w",
    e: a === "e" || b === "e",
  };
}

// ============================================================
//  УГЛЫ ПОВОРОТА ДЕКОРА
// ============================================================
//
//  Для corner_ne (исходный JSON) поворот = 0.
//  Для остальных — крутим всё вокруг центра комнаты так,
//  чтобы бассейн остался в «мёртвом» углу:
//    corner_ne: dead SW (как в JSON)      →  0
//    corner_nw: dead SE                   →  +π/2
//    corner_se: dead NW                   →  −π/2
//    corner_sw: dead NE                   →  π
//
//  Формула поворота позиции (x, z) на угол θ вокруг Y:
//    x' =  x·cosθ + z·sinθ
//    z' = −x·sinθ + z·cosθ

const CORNER_ROT: Record<"ne" | "nw" | "se" | "sw", number> = {
  ne: 0,
  nw: Math.PI / 2,
  se: -Math.PI / 2,
  sw: Math.PI,
};

// ============================================================
//  ДЕКОРАТИВНЫЕ ПИСЫ
// ============================================================
//
//  Всё, что НЕ покрывается buildFloor / buildAllWalls /
//  buildCeiling, выписано сюда 1:1 из JSON редактора.
//
//  Поля:
//    kind      — "box" | "cyl" (cyl для столбов павильона)
//    dx, dz    — центр от центра комнаты (JSON x/z)
//    cy        — центр по Y (JSON y; пол на 0)
//    w, h, d   — габариты (для cyl: w = diameter, d не нужен)
//    rx/ry/rz  — Эйлеровы углы (радианы)
//    texU/V    — uScale/vScale текстуры
//    wAng      — wAng текстуры (поворот UV)
//    collide   — участвует ли в коллизиях (вода — нет)
//    pickable  — попадает ли в pick (для дебаг-редактора)

type MatKey = "stone" | "darkStone" | "sand" | "water";

interface DecorPiece {
  kind: "box" | "cyl";
  dx: number;
  dz: number;
  cy: number;
  w: number;
  h: number;
  d: number;
  rx: number;
  ry: number;
  rz: number;
  mat: MatKey;
  texU: number;
  texV: number;
  wAng: number;
  collide: boolean;
  pickable: boolean;
}

const DECOR: DecorPiece[] = [
  // ── Кирпичи-дорожки, ведущие к павильону ────────────────────
  { kind: "box", dx: -8, dz: 1, cy: 0.33,
    w: 0.9, h: 0.7, d: 0.9, rx: 0, ry: Math.PI, rz: 0,
    mat: "darkStone", texU: 0.1, texV: 0.1, wAng: 0,
    collide: true, pickable: true },
  { kind: "box", dx: -7, dz: 1, cy: 0.33,
    w: 0.9, h: 0.7, d: 0.9, rx: 0, ry: Math.PI, rz: 0,
    mat: "darkStone", texU: 0.1, texV: 0.1, wAng: 0,
    collide: true, pickable: true },
  { kind: "box", dx: -1, dz: 8, cy: 0.33,
    w: 0.9, h: 0.7, d: 0.9, rx: 0, ry: 0, rz: 0,
    mat: "darkStone", texU: 0.1, texV: 0.1, wAng: 0,
    collide: true, pickable: true },
  { kind: "box", dx: -1, dz: 7, cy: 0.33,
    w: 0.9, h: 0.7, d: 0.9, rx: 0, ry: 0, rz: 0,
    mat: "darkStone", texU: 0.1, texV: 0.1, wAng: 0,
    collide: true, pickable: true },
  { kind: "box", dx: -1, dz: 1, cy: 0.33,
    w: 0.9, h: 0.7, d: 0.9, rx: 0, ry: Math.PI, rz: 0,
    mat: "darkStone", texU: 0.1, texV: 0.1, wAng: 0,
    collide: true, pickable: true },

  // ── Песчаные пороги у входа в павильон ─────────────────────
  { kind: "box", dx: -8, dz: 1, cy: 0.14,
    w: 2, h: 0.7, d: 0.7, rx: 0, ry: Math.PI, rz: 0,
    mat: "sand", texU: 0.4, texV: 0.2, wAng: Math.PI,
    collide: true, pickable: true },
  { kind: "box", dx: -1, dz: 8, cy: 0.14,
    w: 2, h: 0.7, d: 0.7, rx: 0, ry: Math.PI / 2, rz: 0,
    mat: "sand", texU: 0.4, texV: 0.2, wAng: Math.PI,
    collide: true, pickable: true },

  // ── Столб павильона ────────────────────────────────────────
  //  В JSON собран из двух частей: круглый столб 4.5 м + «обёртка»
  //  5 м из darkStone. Они пересекаются — так в редакторе,
  //  оставил без изменений.
  { kind: "cyl", dx: -1, dz: 1, cy: 2.46,
    w: 0.7, h: 4.5, d: 0.7, rx: 0, ry: 0, rz: 0,
    mat: "sand", texU: 1, texV: 1, wAng: 0,
    collide: true, pickable: true },
  { kind: "box", dx: -1, dz: 1, cy: 2.42,
    w: 0.6, h: 5, d: 0.56, rx: 0, ry: -Math.PI / 2, rz: 0,
    mat: "darkStone", texU: 6, texV: 2, wAng: 0,
    collide: true, pickable: true },
  { kind: "box", dx: -1, dz: 1, cy: 1.13,
    w: 0.9, h: 0.7, d: 0.9, rx: 0, ry: Math.PI, rz: 0,
    mat: "darkStone", texU: 0.1, texV: 0.1, wAng: 0,
    collide: true, pickable: true },
  { kind: "box", dx: -1, dz: 1, cy: 4.7,
    w: 0.9, h: 0.7, d: 0.9, rx: 0, ry: Math.PI, rz: 0,
    mat: "darkStone", texU: 0.1, texV: 0.1, wAng: 0,
    collide: true, pickable: true },

  // ── Вертикальные «усики» павильона ──────────────────────────
  //  В JSON y=3.16, h=5 → меш идёт с 0.66 до 5.66 и торчит выше
  //  потолка (потолок на 5.05…5.25). Это как в редакторе.
  { kind: "box", dx: -1, dz: 6.7, cy: 3.16,
    w: 0.9, h: 5, d: 0.3, rx: 0, ry: Math.PI, rz: 0,
    mat: "darkStone", texU: 0.1, texV: 0.1, wAng: 0,
    collide: true, pickable: true },
  { kind: "box", dx: -6.7, dz: 1, cy: 3.16,
    w: 0.9, h: 5, d: 0.3, rx: 0, ry: Math.PI / 2, rz: 0,
    mat: "darkStone", texU: 0.1, texV: 0.1, wAng: 0,
    collide: true, pickable: true },

  // ── Сдвоенные стенки павильона ─────────────────────────────
  //  По 2 панели на сторону, расстояние между ними 0.4 м.
  { kind: "box", dx: -1.2, dz: 7.74, cy: 2.25,
    w: 2.2, h: 4.5, d: 0.2, rx: 0, ry: -Math.PI / 2, rz: 0,
    mat: "stone", texU: 0.3, texV: 1, wAng: Math.PI,
    collide: true, pickable: true },
  { kind: "box", dx: -0.8, dz: 7.74, cy: 2.25,
    w: 2.2, h: 4.5, d: 0.2, rx: 0, ry: -Math.PI / 2, rz: 0,
    mat: "stone", texU: 0.3, texV: 1, wAng: 0,
    collide: true, pickable: true },
  { kind: "box", dx: -7.74, dz: 1.2, cy: 2.25,
    w: 2.2, h: 4.5, d: 0.2, rx: 0, ry: 0, rz: 0,
    mat: "stone", texU: 0.3, texV: 1, wAng: Math.PI,
    collide: true, pickable: true },
  { kind: "box", dx: -7.74, dz: 0.8, cy: 2.25,
    w: 2.2, h: 4.5, d: 0.2, rx: 0, ry: 0, rz: 0,
    mat: "stone", texU: 0.3, texV: 1, wAng: 0,
    collide: true, pickable: true },

  // ── Верхние балки павильона ────────────────────────────────
  { kind: "box", dx: -1, dz: 4.8, cy: 4.85,
    w: 8, h: 0.7, d: 0.8, rx: 0, ry: Math.PI / 2, rz: 0,
    mat: "darkStone", texU: 4, texV: 0.2, wAng: 0,
    collide: true, pickable: true },
  { kind: "box", dx: -4.8, dz: 1, cy: 4.85,
    w: 8, h: 0.7, d: 0.8, rx: 0, ry: Math.PI, rz: 0,
    mat: "darkStone", texU: 4, texV: 0.2, wAng: 0,
    collide: true, pickable: true },

  // ── Бассейн 8×8 ────────────────────────────────────────────
  //  Вода — без коллизий и без pick (это декаль над песком).
  { kind: "box", dx: -4.8, dz: 4.8, cy: 0.14,
    w: 8, h: 0.3, d: 8, rx: 0, ry: 0, rz: 0,
    mat: "water", texU: 1, texV: 1, wAng: 0,
    collide: false, pickable: false },
  // Песчаный «остров» поверх воды — можно стоять.
  { kind: "box", dx: -6, dz: 6, cy: 0.16,
    w: 6, h: 0.5, d: 6, rx: 0, ry: 0, rz: 0,
    mat: "sand", texU: 0.5, texV: 0.5, wAng: 0,
    collide: true, pickable: true },

  // ── Бортики бассейна ───────────────────────────────────────
  //  Песчаный бортик + кирпич-обкладка с внешней стороны.
  { kind: "box", dx: -1, dz: 4.24, cy: 0.16,
    w: 0.45, h: 0.5, d: 6, rx: 0, ry: 0, rz: 0,
    mat: "sand", texU: 0.5, texV: 0.02, wAng: 0,
    collide: true, pickable: true },
  { kind: "box", dx: -0.86, dz: 4.24, cy: 0.21,
    w: 0.2, h: 0.45, d: 6, rx: 0, ry: Math.PI, rz: 0,
    mat: "darkStone", texU: 0.1, texV: 0.1, wAng: 0,
    collide: true, pickable: true },

  { kind: "box", dx: -4.24, dz: 1, cy: 0.16,
    w: 0.45, h: 0.5, d: 6, rx: 0, ry: Math.PI / 2, rz: 0,
    mat: "sand", texU: 0.5, texV: 0.02, wAng: Math.PI,
    collide: true, pickable: true },
  { kind: "box", dx: -4.24, dz: 0.86, cy: 0.21,
    w: 0.2, h: 0.45, d: 6, rx: 0, ry: Math.PI / 2, rz: 0,
    mat: "darkStone", texU: 0.1, texV: 0.1, wAng: Math.PI / 2,
    collide: true, pickable: true },

  // ── Ручей вдоль юго-восточной стены ────────────────────────
  { kind: "box", dx: 4, dz: 8, cy: 0.14,
    w: 9.4, h: 0.3, d: 1.6, rx: 0, ry: 0, rz: 0,
    mat: "water", texU: 0.3, texV: 1, wAng: 0,
    collide: false, pickable: false },
  { kind: "box", dx: 4, dz: 7, cy: 0.12,
    w: 0.45, h: 0.5, d: 9.4, rx: 0, ry: Math.PI / 2, rz: 0,
    mat: "sand", texU: 0.5, texV: 0.02, wAng: Math.PI,
    collide: true, pickable: true },

  // ── Ручей вдоль северо-западной стены ──────────────────────
  { kind: "box", dx: -8, dz: -4, cy: 0.14,
    w: 9.4, h: 0.3, d: 1.6, rx: 0, ry: Math.PI / 2, rz: 0,
    mat: "water", texU: 0.3, texV: 1, wAng: 0,
    collide: false, pickable: false },
  { kind: "box", dx: -7, dz: -4, cy: 0.12,
    w: 0.45, h: 0.5, d: 9.4, rx: 0, ry: 0, rz: 0,
    mat: "sand", texU: 0.5, texV: 0.02, wAng: Math.PI,
    collide: true, pickable: true },
];

// ============================================================
//  ХЕЛПЕРЫ
// ============================================================

function matFromKey(ctx: RoomContext, key: MatKey): StandardMaterial {
  switch (key) {
    case "stone":     return ctx.materials.stone;
    case "darkStone": return ctx.materials.darkStone;
    case "sand":      return ctx.materials.sand;
    case "water":     return ctx.materials.water;
  }
}

/**
 * Клон материала с tex-параметрами. Явно проставляю
 * maxSimultaneousLights = 8 — иначе клон может унаследовать
 * дефолт 4, и фонарик/торчи перестанут попадать в шейдер.
 *
 * Клонирую ВСЕГДА (а не переиспользую общий материал), потому
 * что у каждого меша свой набор uScale/vScale/wAng.
 */
function cloneMatWithTex(
  ctx: RoomContext,
  base: StandardMaterial,
  meshName: string,
  texU: number,
  texV: number,
  wAng: number
): StandardMaterial {
  const cloned = base.clone(`${base.name}_${meshName}`);
  cloned.maxSimultaneousLights = 8;

  if (base.diffuseTexture) {
    cloned.diffuseTexture = base.diffuseTexture.clone();
  }
  const tex = cloned.diffuseTexture as Texture | null;
  if (tex) {
    tex.uScale = texU;
    tex.vScale = texV;
    tex.wAng = wAng;
  }
  return cloned;
}

/**
 * Размещает одну декоративную деталь.
 *
 * Позиция сначала берётся в «JSON-координатах» (dx, dz),
 * потом крутится на rotY вокруг центра комнаты.
 *
 * Ориентация: R_new = Ry(rotY) · R_local. Считаю через
 * кватернион (как wall-template), потом разворачиваю обратно
 * в Эйлеры — редактор должен видеть mesh.rotation, а не
 * rotationQuaternion.
 */
function placeDecor(
  ctx: RoomContext,
  piece: DecorPiece,
  rotY: number,
  index: number
): Mesh {
  // ── Позиция ──────────────────────────────────────────────
  const cos = Math.cos(rotY);
  const sin = Math.sin(rotY);
  const px =  piece.dx * cos + piece.dz * sin;
  const pz = -piece.dx * sin + piece.dz * cos;

  // ── Ориентация ───────────────────────────────────────────
  let ex = piece.rx;
  let ey = piece.ry;
  let ez = piece.rz;
  if (rotY !== 0) {
    const qLocal = Quaternion.FromEulerAngles(piece.rx, piece.ry, piece.rz);
    const qRoom  = Quaternion.RotationAxis(Vector3.Up(), rotY);
    // qRoom.multiply(qLocal) = qRoom * qLocal: сначала локальный
    // поворот, потом поворот комнаты — то, что нужно.
    const qFinal = qRoom.multiply(qLocal);
    const e = qFinal.toEulerAngles();
    ex = e.x;
    ey = e.y;
    ez = e.z;
  }

  // ── Геометрия ────────────────────────────────────────────
  let mesh: Mesh;
  if (piece.kind === "cyl") {
    mesh = MeshBuilder.CreateCylinder(
      `decor_cyl_${index}`,
      { height: piece.h, diameter: piece.w, tessellation: 16 },
      ctx.scene
    );
  } else {
    mesh = MeshBuilder.CreateBox(
      `decor_box_${index}`,
      { width: piece.w, height: piece.h, depth: piece.d },
      ctx.scene
    );
  }

  // Важно: cy в JSON — это ЦЕНТР меша по Y. Поэтому
  // прибавляем floorY и НЕ прибавляем h/2 (в отличие от boxAt).
  mesh.position.set(
    ctx.centerX + px,
    ctx.floorY + piece.cy,
    ctx.centerZ + pz
  );
  mesh.rotation.set(ex, ey, ez);

  // ── Материал ─────────────────────────────────────────────
  const base = matFromKey(ctx, piece.mat);
  mesh.material = cloneMatWithTex(
    ctx, base, mesh.name, piece.texU, piece.texV, piece.wAng
  );

  // ── Коллизии / pick ──────────────────────────────────────
  mesh.checkCollisions = piece.collide;
  mesh.isPickable = piece.pickable;

  // ── Metadata для редактора ───────────────────────────────
  mesh.metadata = {
    type: piece.kind === "cyl" ? "column" : "wall",
    material: piece.mat,
    w: piece.w,
    h: piece.h,
    d: piece.d,
    tex: {
      uScale: piece.texU,
      vScale: piece.texV,
      uOffset: 0,
      vOffset: 0,
      wAng: piece.wAng,
    },
  };

  return mesh;
}

// ============================================================
//  ФАБРИКА УГЛА
// ============================================================

function makeCornerPool(
  id: string,
  label: string,
  a: Side,
  b: Side,
  cornerKey: "ne" | "nw" | "se" | "sw"
): RoomBlueprint {
  const rotY = CORNER_ROT[cornerKey];

  return {
    id,
    category: "corner",
    label,
    exits: exitsOf(a, b),
    // Вес 4 — как у старого базового угла. У остальных «специальных»
    // (stream / artifact / pit) — 2.
    weight: 4,
    footprint: { w: 1, h: 1 },

    build(ctx) {
      const out: AbstractMesh[] = [];

      // ── Базовая геометрия ──────────────────────────────────
      // Пол 18.9×18.9, стены (двери по ctx.doors — важно, если
      // генератор подменил exitsOverride), потолок.
      out.push(...buildFloor(ctx));
      out.push(...buildAllWalls(ctx));
      out.push(...buildCeiling(ctx));

      // ── Декор ──────────────────────────────────────────────
      for (let i = 0; i < DECOR.length; i++) {
        out.push(placeDecor(ctx, DECOR[i], rotY, i));
      }

      return out;
    },
  };
}

// ─── 4 варианта ─────────────────────────────────────────────────────
//  id'ы ДОЛЖНЫ остаться старыми: GridLevelGenerator.cornerIdFor()
//  ищет blueprint'ы по строкам "corner_ne" / "corner_nw" /
//  "corner_se" / "corner_sw".
export const CORNER_NE = makeCornerPool("corner_ne", "Поворот N↔E", "n", "e", "ne");
export const CORNER_NW = makeCornerPool("corner_nw", "Поворот N↔W", "n", "w", "nw");
export const CORNER_SE = makeCornerPool("corner_se", "Поворот S↔E", "s", "e", "se");
export const CORNER_SW = makeCornerPool("corner_sw", "Поворот S↔W", "s", "w", "sw");