import {
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core";

export type RoomType =
  | "corridor"
  | "hall"
  | "trap"
  | "treasure"
  | "pillared"
  | "stair";

export interface RoomTemplate {
  type: RoomType;
  /** Множитель размера комнаты (1 = стандартная ячейка). */
  sizeScale: number;
  /** Насколько пол ниже базового уровня этажа (для зала с буром). */
  floorOffset: number;
  buildDecor(
    scene: Scene,
    origin: Vector3,
    cellSize: number,
    floorY: number,
    materials: RoomMaterials
  ): Mesh[];
}

export interface RoomMaterials {
  stone: StandardMaterial;
  darkStone: StandardMaterial;
  sand: StandardMaterial;
  metal: StandardMaterial;
  wood: StandardMaterial;
}

function makeBox(
  scene: Scene,
  name: string,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  mat: StandardMaterial,
  collide = true
): Mesh {
  const m = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
  m.position.set(x, y, z);
  m.material = mat;
  m.checkCollisions = collide;
  m.isPickable = false;
  return m;
}

function makeCyl(
  scene: Scene,
  name: string,
  h: number,
  dia: number,
  x: number,
  y: number,
  z: number,
  mat: StandardMaterial,
  collide = true
): Mesh {
  const m = MeshBuilder.CreateCylinder(name, { height: h, diameter: dia, tessellation: 12 }, scene);
  m.position.set(x, y, z);
  m.material = mat;
  m.checkCollisions = collide;
  m.isPickable = false;
  return m;
}

/** Коридор — узкий проход, минимум декора. */
const corridor: RoomTemplate = {
  type: "corridor",
  sizeScale: 1,
  floorOffset: 0,
  buildDecor(scene, origin, cellSize, floorY, mats) {
    const half = cellSize * 0.35;
    return [
      makeBox(scene, "corrPillarL", 0.4, 2.8, 0.4, origin.x - half, floorY + 1.4, origin.z, mats.darkStone),
      makeBox(scene, "corrPillarR", 0.4, 2.8, 0.4, origin.x + half, floorY + 1.4, origin.z, mats.darkStone),
    ];
  },
};

/** Зал — большая комната. */
const hall: RoomTemplate = {
  type: "hall",
  sizeScale: 1.15,
  floorOffset: 0,
  buildDecor(scene, origin, cellSize, floorY, mats) {
    const s = cellSize * 0.28;
    return [
      makeCyl(scene, "hallCol1", 3.2, 0.55, origin.x - s, floorY + 1.6, origin.z - s, mats.stone),
      makeCyl(scene, "hallCol2", 3.2, 0.55, origin.x + s, floorY + 1.6, origin.z - s, mats.stone),
      makeCyl(scene, "hallCol3", 3.2, 0.55, origin.x - s, floorY + 1.6, origin.z + s, mats.stone),
      makeCyl(scene, "hallCol4", 3.2, 0.55, origin.x + s, floorY + 1.6, origin.z + s, mats.stone),
    ];
  },
};

/** Камера с ловушкой — яма в центре (урон через коллизию ниже пола). */
const trap: RoomTemplate = {
  type: "trap",
  sizeScale: 1,
  floorOffset: 0,
  buildDecor(scene, origin, cellSize, floorY, mats) {
    const pit = makeBox(
      scene,
      "trapPit",
      cellSize * 0.45,
      0.15,
      cellSize * 0.45,
      origin.x,
      floorY - 0.4,
      origin.z,
      mats.darkStone,
      false
    );
    // Шипы
    const spikes: Mesh[] = [];
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        if (i === 0 && j === 0) continue;
        spikes.push(
          makeCyl(
            scene,
            "spike",
            0.55,
            0.12,
            origin.x + i * 0.7,
            floorY - 0.15,
            origin.z + j * 0.7,
            mats.metal,
            false
          )
        );
      }
    }
    return [pit, ...spikes];
  },
};

/** Сокровищница — саркофаги. */
const treasure: RoomTemplate = {
  type: "treasure",
  sizeScale: 1,
  floorOffset: 0,
  buildDecor(scene, origin, cellSize, floorY, mats) {
    return [
      makeBox(scene, "sarc1", 1.8, 0.9, 0.9, origin.x - 2.2, floorY + 0.45, origin.z - 1.5, mats.stone),
      makeBox(scene, "sarc2", 1.8, 0.9, 0.9, origin.x + 2.2, floorY + 0.45, origin.z + 1.5, mats.stone),
      makeBox(scene, "chest", 0.9, 0.55, 0.55, origin.x, floorY + 0.28, origin.z, mats.wood),
    ];
  },
};

/** Столбовая — колонны мешают обзору. */
const pillared: RoomTemplate = {
  type: "pillared",
  sizeScale: 1,
  floorOffset: 0,
  buildDecor(scene, origin, cellSize, floorY, mats) {
    const positions = [
      [-2.2, -2.2],
      [2.2, -2.2],
      [-2.2, 2.2],
      [2.2, 2.2],
      [0, -2.5],
      [0, 2.5],
    ];
    return positions.map(([dx, dz], idx) =>
      makeCyl(scene, `pillar${idx}`, 3.4, 0.7, origin.x + dx, floorY + 1.7, origin.z + dz, mats.darkStone)
    );
  },
};

/** Лестничная — пандус вверх/вниз. */
const stair: RoomTemplate = {
  type: "stair",
  sizeScale: 1,
  floorOffset: 0,
  buildDecor() {
    return [];
  },
};

/** Большой зал с буром — перевёрнутая усечённая трапеция, ниже уровня. */
export const drillHallTemplate: RoomTemplate = {
  type: "hall",
  sizeScale: 1,
  floorOffset: 0,
  buildDecor() {
    return []; // геометрия строится отдельно в LevelGenerator.buildDrillRoom
  },
};

export const ROOM_TEMPLATES: Record<RoomType, RoomTemplate> = {
  corridor,
  hall,
  trap,
  treasure,
  pillared,
  stair,
};

export function pickRandomType(rng: () => number, preferStair = false): RoomType {
  if (preferStair) return "stair";
  const pool: RoomType[] = ["corridor", "hall", "trap", "treasure", "pillared", "corridor", "hall"];
  return pool[Math.floor(rng() * pool.length)];
}
