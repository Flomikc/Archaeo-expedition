import {
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core";

export type RoomType =
  | "entrance"
  | "corridor"
  | "hall"
  | "trap"
  | "treasure"
  | "pillared"
  | "stair"
  | "drill";

export interface RoomDoors {
  n: boolean;
  s: boolean;
  w: boolean;
  e: boolean;
  up: boolean;
  down: boolean;
}

export interface RoomMaterials {
  stone: StandardMaterial;
  darkStone: StandardMaterial;
  sand: StandardMaterial;
  metal: StandardMaterial;
  wood: StandardMaterial;
}

export interface RoomTemplate {
  type: RoomType;
  buildDecor(
    scene: Scene,
    origin: Vector3,
    cellSize: number,
    floorY: number,
    materials: RoomMaterials,
    doors: RoomDoors
  ): Mesh[];
}

function makeBox(
  scene: Scene, name: string,
  w: number, h: number, d: number,
  x: number, y: number, z: number,
  mat: StandardMaterial, collide = true
): Mesh {
  const m = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
  m.position.set(x, y, z);
  m.material = mat;
  m.checkCollisions = collide;
  m.isPickable = false;
  return m;
}

function makeCyl(
  scene: Scene, name: string,
  h: number, dia: number,
  x: number, y: number, z: number,
  mat: StandardMaterial, collide = true
): Mesh {
  const m = MeshBuilder.CreateCylinder(name, { height: h, diameter: dia, tessellation: 14 }, scene);
  m.position.set(x, y, z);
  m.material = mat;
  m.checkCollisions = collide;
  m.isPickable = false;
  return m;
}

/** Entrance — старт, пустая комната со столом у стены. */
const entrance: RoomTemplate = {
  type: "entrance",
  buildDecor(scene, origin, _cellSize, floorY, mats, doors) {
    // Стол ставим у той стены, где НЕТ двери, чтобы не мешать проходу
    const out: Mesh[] = [];
    if (!doors.n) {
      out.push(makeBox(scene, "entrTable", 2, 0.9, 0.8,
        origin.x, floorY + 0.45, origin.z - 4, mats.wood));
    }
    return out;
  },
};

/** Corridor — ставит две узкие стены по бокам от направления движения. */
const corridor: RoomTemplate = {
  type: "corridor",
  buildDecor(scene, origin, cellSize, floorY, mats, doors) {
    const out: Mesh[] = [];
    const half = cellSize / 2;
    const inner = 2.2;    // насколько близко к центру стоят стены
    const h = 3.5;
    const t = 0.6;

    // Движение N-S → ставим стены по W и E (только там, где нет двери)
    if (!doors.w && !doors.e && (doors.n || doors.s)) {
      if (!doors.w) out.push(makeBox(scene, "corW", t, h, cellSize,
        origin.x - inner, floorY + h / 2, origin.z, mats.stone));
      if (!doors.e) out.push(makeBox(scene, "corE", t, h, cellSize,
        origin.x + inner, floorY + h / 2, origin.z, mats.stone));
    }
    // Движение W-E → стены по N и S
    if (!doors.n && !doors.s && (doors.w || doors.e)) {
      if (!doors.n) out.push(makeBox(scene, "corN", cellSize, h, t,
        origin.x, floorY + h / 2, origin.z - inner, mats.stone));
      if (!doors.s) out.push(makeBox(scene, "corS", cellSize, h, t,
        origin.x, floorY + h / 2, origin.z + inner, mats.stone));
    }
    return out;
  },
};

/** Hall — 2 колонны по бокам от прохода, не мешают. */
const hall: RoomTemplate = {
  type: "hall",
  buildDecor(scene, origin, cellSize, floorY, mats, doors) {
    const offset = cellSize * 0.35;
    const out: Mesh[] = [];
    if (doors.n || doors.s) {
      out.push(makeCyl(scene, "hallL", 3.2, 0.7, origin.x - offset, floorY + 1.6, origin.z, mats.stone));
      out.push(makeCyl(scene, "hallR", 3.2, 0.7, origin.x + offset, floorY + 1.6, origin.z, mats.stone));
    } else {
      out.push(makeCyl(scene, "hallN", 3.2, 0.7, origin.x, floorY + 1.6, origin.z - offset, mats.stone));
      out.push(makeCyl(scene, "hallS", 3.2, 0.7, origin.x, floorY + 1.6, origin.z + offset, mats.stone));
    }
    return out;
  },
};

/** Trap — ловушка смещена в сторону от линии прохода. */
const trap: RoomTemplate = {
  type: "trap",
  buildDecor(scene, origin, cellSize, floorY, mats, doors) {
    const out: Mesh[] = [];
    const offset = cellSize * 0.3;
    // Яма
    const pitX = (doors.n || doors.s) ? origin.x + offset : origin.x;
    const pitZ = (doors.w || doors.e) ? origin.z + offset : origin.z;
    out.push(makeBox(scene, "trapPit", 3, 0.2, 3, pitX, floorY - 0.45, pitZ, mats.darkStone, false));
    for (let ii = -1; ii <= 1; ii++) {
      for (let jj = -1; jj <= 1; jj++) {
        if (ii === 0 && jj === 0) continue;
        out.push(makeCyl(scene, "spike", 0.45, 0.14,
          pitX + ii * 0.8, floorY - 0.15, pitZ + jj * 0.8, mats.metal, false));
      }
    }
    return out;
  },
};

/** Treasure — саркофаги по краям. */
const treasure: RoomTemplate = {
  type: "treasure",
  buildDecor(scene, origin, cellSize, floorY, mats, doors) {
    const out: Mesh[] = [];
    const off = cellSize * 0.32;
    if (doors.n || doors.s) {
      out.push(makeBox(scene, "sarcL", 1.8, 0.9, 0.9, origin.x - off, floorY + 0.45, origin.z, mats.stone));
      out.push(makeBox(scene, "sarcR", 1.8, 0.9, 0.9, origin.x + off, floorY + 0.45, origin.z, mats.stone));
    } else {
      out.push(makeBox(scene, "sarcN", 0.9, 0.9, 1.8, origin.x, floorY + 0.45, origin.z - off, mats.stone));
      out.push(makeBox(scene, "sarcS", 0.9, 0.9, 1.8, origin.x, floorY + 0.45, origin.z + off, mats.stone));
    }
    return out;
  },
};

/** Pillared — колонны вдоль стен, свободный центр. */
const pillared: RoomTemplate = {
  type: "pillared",
  buildDecor(scene, origin, cellSize, floorY, mats, _doors) {
    const off = cellSize * 0.38;
    const positions: Array<[number, number]> = [
      [-off, -off], [off, -off],
      [-off, off], [off, off],
    ];
    return positions.map(([dx, dz], idx) =>
      makeCyl(scene, `pil${idx}`, 3.5, 0.7,
        origin.x + dx, floorY + 1.75, origin.z + dz, mats.darkStone)
    );
  },
};

/** Stair — рампа строится в LevelGenerator. */
const stair: RoomTemplate = {
  type: "stair",
  buildDecor() {
    return [];
  },
};

/** Drill — финальная комната, всё строится в LevelGenerator. */
const drill: RoomTemplate = {
  type: "drill",
  buildDecor() {
    return [];
  },
};

export const ROOM_TEMPLATES: Record<RoomType, RoomTemplate> = {
  entrance,
  corridor,
  hall,
  trap,
  treasure,
  pillared,
  stair,
  drill,
};

export function pickRandomType(rng: () => number): RoomType {
  const pool: RoomType[] = [
    "corridor",
    "hall", "hall",
    "trap",
    "treasure",
    "pillared",
    "corridor",
  ];
  return pool[Math.floor(rng() * pool.length)];
}