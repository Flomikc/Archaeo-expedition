import {
  AbstractMesh,
  Color3,
  DirectionalLight,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  Texture,
  Vector3,
} from "@babylonjs/core";

import { NO_EXITS, RoomBlueprint, RoomContext } from "../RoomBlueprint";

// ============================================================
//  ФИНАЛЬНАЯ КОМНАТА С БУРОМ
//
//  Геометрия 1:1 из JSON редактора (roomId: "drill").
//
//  Особенности:
//   • Комната 26×26, но центр по X в JSON сдвинут: стены
//     стоят на x=-8.55 (запад) и x=+16.55 (восток), т.е.
//     "нулевая координата" JSON — не центр комнаты, а точка
//     в 4 м западнее центра.
//
//   • Блок 2×2 по сетке — 26×26. Генератор кладёт центр
//     комнаты в СЕРЕДИНУ блока (centerX = westEdge + 13).
//     Так как JSON-нуль смещён, стены уезжают на 4 м
//     восточнее, чем "хотелось бы" геометрически. Это НЕ
//     баг — так задумано в редакторе, и щель между соседом
//     и западной стеной бура компенсируется отдельной
//     полосой пола (см. ниже, 5-й box).
//
//   • Верх ОТКРЫТ: стены 6.5 м высотой, потолка нет.
//     Свет — DirectionalLight + HemisphericLight, чтобы
//     низ утопленной площадки не был чёрным.
//
//   • Дверь — на ЗАПАДЕ (exits: { w: true }). Полный
//     резной набор: колонны, стойки, арка, кирпичи.
// ============================================================

type MatKey = "stone" | "darkStone" | "sand";
type JsonType = "box" | "wall" | "floor" | "column";

interface Piece {
  t: JsonType;          // "column" → cylinder, иначе box
  dx: number; dy: number; dz: number;
  w: number; h: number; d: number;
  rx: number; ry: number; rz: number;
  mat: MatKey;
  texU: number; texV: number;
  wAng: number;
  uOffset: number; vOffset: number;
}

function P(
  t: JsonType,
  dx: number, dy: number, dz: number,
  w: number, h: number, d: number,
  mat: MatKey, texU: number, texV: number,
  opts: Partial<Omit<Piece, "t" | "dx" | "dy" | "dz" | "w" | "h" | "d" | "mat" | "texU" | "texV">> = {}
): Piece {
  return {
    t, dx, dy, dz, w, h, d, mat, texU, texV,
    rx: opts.rx ?? 0,
    ry: opts.ry ?? 0,
    rz: opts.rz ?? 0,
    wAng: opts.wAng ?? 0,
    uOffset: opts.uOffset ?? 0,
    vOffset: opts.vOffset ?? 0,
  };
}

// ============================================================
//  ВСЕ ПИСЫ ИЗ JSON
// ============================================================

const PIECES: Piece[] = [
  // ── ПОЛ: обод по периметру + утопленная площадка ─────────
  // Западная полоса периметра
  P("box", -6.97, -0.1, 0, 4.05, 0.2, 26, "sand", 2, 0.3),
  // Восточная полоса периметра
  P("box", 14.76, -0.1, 0, 4.05, 0.2, 26, "sand", 2, 0.3),
  // Южная полоса периметра (повёрнута)
  P("box", 3.9, -0.1, 11, 4.05, 0.2, 17.7, "sand", 1.2, 0.3,
    { ry: Math.PI / 2, vOffset: 0.025 }),
  // Северная полоса периметра (повёрнута)
  P("box", 3.9, -0.1, -11, 4.05, 0.2, 17.7, "sand", 1.2, 0.3,
    { ry: Math.PI / 2, vOffset: 0.18 }),
  // Центральная утопленная площадка 18×18 (верх на y = -0.72)
  P("floor", 3.9, -0.82, 0, 18, 0.2, 18, "sand", 6, 6),
  // ⚠ НОВАЯ ПОЛОСА: стык к западному блоку.
  // Закрывает разрыв между блоком (западный край клетки) и
  // западной стеной бура. Без неё игрок выходил с соседа в
  // пустоту и падал.
  P("box", -10.97, -0.1, 0, 4.05, 0.2, 26, "sand", 2, 0.3),

  // ── СТЕНЫ 25.1 × 6.5 (высокие, потолка нет) ──────────────
  P("wall", 4, 3.25, -12.55, 25.1, 6.5, 0.5, "stone", 2, 1,
    { wAng: Math.PI }),
  P("wall", 4, 3.25, 12.55, 25.1, 6.5, 0.5, "stone", 2, 1,
    { ry: Math.PI, wAng: Math.PI }),
  P("wall", 16.55, 3.25, 0, 25.1, 6.5, 0.5, "stone", 2, 1,
    { ry: -Math.PI / 2, wAng: Math.PI }),

  // ── ЗАПАДНАЯ СТЕНА: два сегмента + балка сверху ──────────
  P("wall", -8.55, 2.25, 5.18, 6.75, 4.5, 0.5, "stone", 1, 1,
    { ry: Math.PI / 2, wAng: Math.PI }),
  P("wall", -8.55, 2.25, -5.18, 6.75, 4.5, 0.5, "stone", 1, 1,
    { ry: Math.PI / 2, wAng: Math.PI }),
  P("wall", -8.55, 4.85, 0, 17.1, 0.7, 0.8, "darkStone", 4, 0.2,
    { ry: Math.PI / 2 }),

  // ── ДВЕРНОЙ НАБОР: колонны и обвязки ─────────────────────
  P("column", -8.55, 2.46, 2.06, 0.8, 4.5, 0.8, "sand", 1, 1,
    { ry: Math.PI / 2 }),
  P("column", -8.55, 2.46, -2.06, 0.8, 4.5, 0.8, "sand", 1, 1,
    { ry: Math.PI / 2 }),
  P("wall", -8.55, 0.33, 2, 0.9, 1, 0.9, "darkStone", 0.1, 0.1,
    { ry: Math.PI / 2 }),
  P("wall", -8.55, 0.33, -2, 0.9, 1, 0.9, "darkStone", 0.1, 0.1,
    { ry: Math.PI / 2 }),
  P("wall", -8.55, 1.3, 2, 0.9, 0.7, 0.9, "darkStone", 0.1, 0.1,
    { ry: 1.5456 }),
  P("wall", -8.55, 1.3, -2, 0.9, 0.7, 0.9, "darkStone", 0.1, 0.1,
    { ry: Math.PI / 2 }),
  P("wall", -8.55, 3.71, 2, 0.9, 0.9, 0.9, "darkStone", 0.1, 0.1,
    { ry: Math.PI / 2 }),
  P("wall", -8.55, 3.71, -2, 0.9, 0.9, 0.9, "darkStone", 0.1, 0.1,
    { ry: Math.PI / 2 }),
  P("wall", -8.55, 2.42, 2, 0.6, 5, 0.56, "darkStone", 6, 2,
    { ry: Math.PI / 2 }),
  P("wall", -8.55, 2.42, -2, 0.6, 5, 0.56, "darkStone", 6, 2,
    { ry: Math.PI / 2 }),
  P("wall", -8.55, 2.58, 1.87, 0.5, 0.8, 0.6, "darkStone", 0.2, 0.2,
    { ry: Math.PI / 2 }),
  P("wall", -8.55, 2.58, -1.87, 0.5, 0.8, 0.6, "darkStone", 0.2, 0.2,
    { ry: Math.PI / 2 }),

  // ── АРКА (наклонные блоки) ───────────────────────────────
  P("wall", -8.55, 4.38, 1.2, 0.9, 0.9, 0.9, "darkStone", 0.1, 0.1,
    { ry: Math.PI / 2, rz: 0.3604 }),
  P("wall", -8.55, 4.61, 0, 0.9, 0.9, 0.9, "darkStone", 0.1, 0.1,
    { ry: Math.PI / 2 }),
  P("wall", -8.55, 4.38, -1.2, 0.9, 0.9, 0.9, "darkStone", 0.1, 0.1,
    { ry: Math.PI / 2, rz: -0.3613 }),
  P("wall", -8.55, 4.33, 1.67, 0.9, 0.86, 0.6, "stone", 6, 2,
    { rx: 0.005, ry: 1.5748, rz: 0.6661 }),
  P("wall", -8.55, 4.63, 0.58, 0.9, 0.8, 0.6, "stone", 6, 2,
    { ry: Math.PI / 2, rz: 0.1356 }),
  P("wall", -8.55, 4.63, -0.58, 0.9, 0.8, 0.6, "stone", 6, 2,
    { ry: Math.PI / 2, rz: -0.1361 }),
  P("wall", -8.55, 4.33, -1.67, 0.9, 0.86, 0.6, "stone", 6, 2,
    { rx: -0.0052, ry: 1.5673, rz: -0.6667 }),
  P("wall", -8.55, 3.54, 0, 4, 0.45, 0.4, "darkStone", 0.2, 0.2,
    { ry: Math.PI / 2 }),

  // ── Внешние тонкие стойки двери (вынесены чуть западнее) ──
  P("wall", -8.8, 2.4, 2, 0.4, 5, 0.4, "darkStone", 6, 2,
    { ry: Math.PI / 2 }),
  P("wall", -8.8, 2.4, -2, 0.4, 5, 0.4, "darkStone", 6, 2,
    { ry: Math.PI / 2 }),

  // ── Плинтусы западной стены (по обе стороны от двери) ────
  P("wall", -8.55, 0.14, 5.23, 6.45, 0.7, 0.8, "sand", 0.2, 0.2,
    { ry: Math.PI / 2 }),
  P("wall", -8.55, 0.14, -5.22, 6.45, 0.7, 0.8, "sand", 0.2, 0.2,
    { ry: Math.PI / 2 }),
];

// ── Кирпичи вдоль западной стены (z от ±3 до ±8) ────────────
//  Вынесено отдельно, потому что это повторяющийся шаблон —
//  генерим в цикле, а не пишем 12 одинаковых строк.
(() => {
  for (const z of [3, 4, 5, 6, 7, 8, -3, -4, -5, -6, -7, -8]) {
    PIECES.push(P("wall", -8.55, 0.33, z, 0.9, 0.7, 0.9,
      "darkStone", 0.1, 0.1, { ry: Math.PI / 2 }));
  }
})();

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
  // maxSimultaneousLights обязателен: 30+ источников в сцене,
  // без явного 8 фонарик игрока не попадёт в шейдер.
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
//  РАЗМЕЩЕНИЕ ОДНОГО ПИСА
// ============================================================

function placePiece(ctx: RoomContext, p: Piece, index: number): Mesh {
  let mesh: Mesh;
  if (p.t === "column") {
    mesh = MeshBuilder.CreateCylinder(
      `drill_col_${index}`,
      { height: p.h, diameter: p.w, tessellation: 16 },
      ctx.scene
    );
  } else {
    mesh = MeshBuilder.CreateBox(
      `drill_${p.t}_${index}`,
      { width: p.w, height: p.h, depth: p.d },
      ctx.scene
    );
  }

  // ⚠ dy — ЦЕНТР по Y (как в JSON), не низ. Поэтому floorY + p.dy
  //   без прибавления h/2 (в отличие от boxAt).
  mesh.position.set(ctx.centerX + p.dx, ctx.floorY + p.dy, ctx.centerZ + p.dz);
  mesh.rotation.set(p.rx, p.ry, p.rz);

  const base = matFromKey(ctx, p.mat);
  mesh.material = cloneMatFull(ctx, base, mesh.name,
    p.texU, p.texV, p.wAng, p.uOffset, p.vOffset);

  // Пол — не пикается (это подложка). Всё остальное — да.
  mesh.checkCollisions = true;
  mesh.isPickable = p.t !== "floor";

  // metadata для редактора — тот же формат, что setMeshMeta.
  mesh.metadata = {
    type: p.t,
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
//  BLUEPRINT
// ============================================================

export const DRILL_ROOM: RoomBlueprint = {
  id: "drill",
  category: "drill",
  label: "Комната с буром (финал)",
  exits: { ...NO_EXITS, w: true },
  weight: 0,
  footprint: { w: 2, h: 2 },

  // sizeOverride читает GridLevelGenerator: центр комнаты
  // кладётся в середину 2×2-блока, габарит 26×26.
  ...({ sizeOverride: { x: 26, z: 26 } } as object),

  build(ctx) {
    const out: AbstractMesh[] = [];

    // Вся геометрия из JSON — один проход.
    for (let i = 0; i < PIECES.length; i++) {
      out.push(placePiece(ctx, PIECES[i], i));
    }

    // ── Свет ──────────────────────────────────────────────
    // Верх открыт (потолка нет), но стены 6.5 м. Без верхнего
    // света утопленная площадка будет как чёрная дыра.
    // DirectionalLight (холодный «лунный» сверху) + Hemispheric
    // (мягкая заливка снизу, чтобы низ ямы не был чёрным).
    const moon = new DirectionalLight(
      "drillMoon",
      new Vector3(0.15, -1, 0.1),
      ctx.scene
    );
    moon.position.set(ctx.centerX + 4, ctx.floorY + 30, ctx.centerZ + 4);
    moon.intensity = 1.1;
    moon.diffuse = new Color3(0.55, 0.7, 1.0);
    moon.specular = new Color3(0.25, 0.35, 0.55);

    const fill = new HemisphericLight(
      "drillFill", new Vector3(0, 1, 0), ctx.scene
    );
    fill.intensity = 0.4;
    fill.diffuse = new Color3(0.5, 0.6, 0.85);
    fill.groundColor = new Color3(0.06, 0.08, 0.13);

    return out;
  },
};