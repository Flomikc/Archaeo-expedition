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
//  Геометрия взята 1:1 из JSON редактора (roomId: "drill").
//  Комната асимметрична:
//    • центр по X ≈ 4 (запад −8.55, восток +16.55)
//    • стены 25.1 × 6.5 м (выше обычных 4.5 — верх открыт)
//    • обод пола по периметру (верх на y=0)
//    • утопленная площадка 18×18 (верх на y=−1.18)
//    • полный дверной проём на ЗАПАДЕ
//
//  ⚠ Комната вставляется генератором через sizeOverride {x:26,z:26}
//    по ЦЕНТРУ 2×2-блока (centerX = westEdge + 13). Т.к. по JSON
//    центр комнаты сдвинут на x=+4, западная стена окажется
//    на westEdge + 4.45 — с щелью 4.45 м до соседа. См. заметку
//    в чате. Сейчас реализовано буквально по JSON.
// ============================================================

// ============================================================
//  МАТЕРИАЛЫ И ТИПЫ
// ============================================================

type MatKey = "stone" | "darkStone" | "sand";
type JsonType = "box" | "wall" | "floor" | "column";

interface Piece {
  t: JsonType;           // используется и для геометрии (column → cyl), и для metadata.type
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
//  ПИСЫ ИЗ JSON
// ============================================================

const PIECES: Piece[] = [
  // ── ПОЛ: обод по периметру (верх на y=0) ──────────────────
  P("box", -6.97, -0.1, 0,  4.05, 0.2, 26,  "sand", 2,   0.3),
  P("box", 14.76, -0.1, 0,  4.05, 0.2, 26,  "sand", 2,   0.3),
  P("box",  3.9,  -0.1, 11, 4.05, 0.2, 17.7, "sand", 1.2, 0.3,
    { ry: Math.PI / 2, vOffset: 0.025 }),
  P("box",  3.9,  -0.1, -11, 4.05, 0.2, 17.7, "sand", 1.2, 0.3,
    { ry: Math.PI / 2, vOffset: 0.18 }),

  // ── ПОЛ: утопленная площадка 18×18 (верх на y=−1.18) ──────
  P("floor", 3.9, -1.28, 0, 18, 0.2, 18, "sand", 6, 6),

  // ── СТЕНЫ 25.1×6.5 ───────────────────────────────────────
  P("wall", 4, 3.25, -12.55, 25.1, 6.5, 0.5, "stone", 2, 1,
    { wAng: Math.PI }),
  P("wall", 4, 3.25, 12.55, 25.1, 6.5, 0.5, "stone", 2, 1,
    { ry: Math.PI, wAng: Math.PI }),
  P("wall", 16.55, 3.25, 0, 25.1, 6.5, 0.5, "stone", 2, 1,
    { ry: -Math.PI / 2, wAng: Math.PI }),

  // ── ЗАПАДНАЯ СТЕНА: два сегмента + балка ─────────────────
  P("wall", -8.55, 2.25,  5.18, 6.75, 4.5, 0.5, "stone", 1, 1,
    { ry: Math.PI / 2, wAng: Math.PI }),
  P("wall", -8.55, 2.25, -5.18, 6.75, 4.5, 0.5, "stone", 1, 1,
    { ry: Math.PI / 2, wAng: Math.PI }),
  P("wall", -8.55, 4.85, 0, 17.1, 0.7, 0.8, "darkStone", 4, 0.2,
    { ry: Math.PI / 2 }),

  // ── ДВЕРНОЙ НАБОР: колонны и обвязки ─────────────────────
  P("column", -8.55, 2.46,  2.06, 0.8, 4.5, 0.8, "sand", 1, 1,
    { ry: Math.PI / 2 }),
  P("column", -8.55, 2.46, -2.06, 0.8, 4.5, 0.8, "sand", 1, 1,
    { ry: Math.PI / 2 }),
  P("wall", -8.55, 0.33,  2, 0.9, 1,   0.9, "darkStone", 0.1, 0.1,
    { ry: Math.PI / 2 }),
  P("wall", -8.55, 0.33, -2, 0.9, 1,   0.9, "darkStone", 0.1, 0.1,
    { ry: Math.PI / 2 }),
  P("wall", -8.55, 1.3,  2, 0.9, 0.7, 0.9, "darkStone", 0.1, 0.1,
    { ry: 1.5456 }),
  P("wall", -8.55, 1.3, -2, 0.9, 0.7, 0.9, "darkStone", 0.1, 0.1,
    { ry: Math.PI / 2 }),
  P("wall", -8.55, 3.71,  2, 0.9, 0.9, 0.9, "darkStone", 0.1, 0.1,
    { ry: Math.PI / 2 }),
  P("wall", -8.55, 3.71, -2, 0.9, 0.9, 0.9, "darkStone", 0.1, 0.1,
    { ry: Math.PI / 2 }),
  P("wall", -8.55, 2.42,  2, 0.6, 5, 0.56, "darkStone", 6, 2,
    { ry: Math.PI / 2 }),
  P("wall", -8.55, 2.42, -2, 0.6, 5, 0.56, "darkStone", 6, 2,
    { ry: Math.PI / 2 }),
  P("wall", -8.55, 2.58,  1.87, 0.5, 0.8, 0.6, "darkStone", 0.2, 0.2,
    { ry: Math.PI / 2 }),
  P("wall", -8.55, 2.58, -1.87, 0.5, 0.8, 0.6, "darkStone", 0.2, 0.2,
    { ry: Math.PI / 2 }),

  // ── АРКА (наклонные блоки) ───────────────────────────────
  P("wall", -8.55, 4.38,  1.2, 0.9, 0.9, 0.9, "darkStone", 0.1, 0.1,
    { ry: Math.PI / 2, rz: 0.3604 }),
  P("wall", -8.55, 4.61,  0,   0.9, 0.9, 0.9, "darkStone", 0.1, 0.1,
    { ry: Math.PI / 2 }),
  P("wall", -8.55, 4.38, -1.2, 0.9, 0.9, 0.9, "darkStone", 0.1, 0.1,
    { ry: Math.PI / 2, rz: -0.3613 }),
  P("wall", -8.55, 4.33,  1.67, 0.9, 0.86, 0.6, "stone", 6, 2,
    { rx: 0.005, ry: 1.5748, rz: 0.6661 }),
  P("wall", -8.55, 4.63,  0.58, 0.9, 0.8,  0.6, "stone", 6, 2,
    { ry: Math.PI / 2, rz: 0.1356 }),
  P("wall", -8.55, 4.63, -0.58, 0.9, 0.8,  0.6, "stone", 6, 2,
    { ry: Math.PI / 2, rz: -0.1361 }),
  P("wall", -8.55, 4.33, -1.67, 0.9, 0.86, 0.6, "stone", 6, 2,
    { rx: -0.0052, ry: 1.5673, rz: -0.6667 }),
  P("wall", -8.55, 3.54,  0,   4,   0.45, 0.4, "darkStone", 0.2, 0.2,
    { ry: Math.PI / 2 }),

  // ── Внешние тонкие стойки двери ──────────────────────────
  P("wall", -8.8, 2.4,  2, 0.4, 5, 0.4, "darkStone", 6, 2,
    { ry: Math.PI / 2 }),
  P("wall", -8.8, 2.4, -2, 0.4, 5, 0.4, "darkStone", 6, 2,
    { ry: Math.PI / 2 }),

  // ── Плинтусы западной стены ──────────────────────────────
  P("wall", -8.55, 0.14,  5.23, 6.45, 0.7, 0.8, "sand", 0.2, 0.2,
    { ry: Math.PI / 2 }),
  P("wall", -8.55, 0.14, -5.22, 6.45, 0.7, 0.8, "sand", 0.2, 0.2,
    { ry: Math.PI / 2 }),
];

// ── Кирпичи вдоль западной стены (z=±3..±8) ─────────────────
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
  // maxSimultaneousLights обязателен — у нас в сцене 30+ источников.
  cloned.maxSimultaneousLights = 8;

  if (base.diffuseTexture) {
    cloned.diffuseTexture = base.diffuseTexture.clone();
  }
  const tex = cloned.diffuseTexture as Texture | null;
  if (tex) {
    tex.uScale = texU;  tex.vScale = texV;
    tex.wAng   = wAng;
    tex.uOffset = uOffset; tex.vOffset = vOffset;
  }
  return cloned;
}

// ============================================================
//  РАЗМЕЩЕНИЕ
// ============================================================

function placePiece(ctx: RoomContext, p: Piece, index: number): Mesh {
  // Ориентация: в этой комнате поворот только через mesh.rotation.
  // Использую Euler напрямую, как в wall-template для отдельных pieces.

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

  // dy в JSON — это ЦЕНТР по Y, поэтому floorY + p.dy (без h/2).
  mesh.position.set(ctx.centerX + p.dx, ctx.floorY + p.dy, ctx.centerZ + p.dz);
  mesh.rotation.set(p.rx, p.ry, p.rz);

  const base = matFromKey(ctx, p.mat);
  mesh.material = cloneMatFull(ctx, base, mesh.name,
    p.texU, p.texV, p.wAng, p.uOffset, p.vOffset);

  mesh.checkCollisions = true;
  mesh.isPickable = p.t === "floor" ? false : true;

  // metadata для редактора — тот же формат, что setMeshMeta в room-kit.
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

  // sizeOverride читает GridLevelGenerator: центр комнаты кладётся
  // в центр 2×2-блока, габарит — 26×26.
  // (Раньше тут был дубликат спреда — теперь один.)
  ...({ sizeOverride: { x: 26, z: 26 } } as object),

  build(ctx) {
    const out: AbstractMesh[] = [];

    // ── Вся геометрия из JSON ─────────────────────────────
    for (let i = 0; i < PIECES.length; i++) {
      out.push(placePiece(ctx, PIECES[i], i));
    }

    // ── Свет ──────────────────────────────────────────────
    // В JSON источников нет, но стены 6.5 м, верх открыт —
    // без верхнего света комната превращается в чёрную дыру.
    // Если свет не нужен, просто убери этот блок.

    // Холодный свет сверху («луна»).
    const moon = new DirectionalLight(
      "drillMoon",
      new Vector3(0.15, -1, 0.1),
      ctx.scene
    );
    moon.position.set(ctx.centerX + 4, ctx.floorY + 30, ctx.centerZ + 4);
    moon.intensity = 1.1;
    moon.diffuse = new Color3(0.55, 0.7, 1.0);
    moon.specular = new Color3(0.25, 0.35, 0.55);

    // Общая заливка, чтобы низ ямы не был чёрным.
    const fill = new HemisphericLight(
      "drillFill", new Vector3(0, 1, 0), ctx.scene
    );
    fill.intensity = 0.4;
    fill.diffuse = new Color3(0.5, 0.6, 0.85);
    fill.groundColor = new Color3(0.06, 0.08, 0.13);

    return out;
  },
};