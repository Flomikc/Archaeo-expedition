import {
  Color3,
  DirectionalLight,
  DynamicTexture,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core";

import {
  RoomDoors,
  RoomMaterials,
  RoomTemplate,
  RoomType,
  ROOM_TEMPLATES,
  pickRandomType,
} from "../data/RoomTemplates";

export interface Cell {
  i: number;
  j: number;
  floor: number;
}

export interface PathNode {
  cell: Cell;
  prevDir: "n" | "s" | "w" | "e" | "up" | null;
  nextDir: "n" | "s" | "w" | "e" | "up" | null;
  doors: RoomDoors;
  type: RoomType;
  template: RoomTemplate;
  centerX: number;
  centerZ: number;
  sizeX: number;
  sizeZ: number;
  isGoal: boolean;
  isStart: boolean;
}

export interface LevelData {
  readonly nodes: PathNode[];
  readonly start: PathNode;
  readonly goal: PathNode;
  readonly seed: number;
  readonly floorHeight: number;
  readonly wallHeight: number;
  readonly cellSize: number;
}

function mulberry32(a: number): () => number {
  return () => {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Параметры дыры под рампу (в метрах). */
const HOLE_HALF_X = 2.2;    // половина ширины дыры по X
const HOLE_HALF_Z = 3.6;    // половина длины дыры по Z
const HOLE_Z_OFFSET = -3.0; // центр дыры смещён на север от центра комнаты

/** Длина и высота подъёма рампы. Должны совпадать с дырой. */
const RAMP_RUN = 6.0;
const RAMP_RISE = 6.0;

export class LevelGenerator {
  static readonly FLOORS = 3;
  static readonly CELL_SIZE = 14;
  static readonly WALL_HEIGHT = 4.5;
  static readonly FLOOR_HEIGHT = 6.0;
  static readonly PATH_LENGTH = 12;

  private rng: () => number = Math.random;
  private readonly gridW = 5;
  private readonly gridD = 5;

  build(scene: Scene, seed?: number): LevelData {
    const actualSeed = seed ?? (Date.now() & 0xffffffff);
    this.rng = mulberry32(actualSeed);

    const path = this.generateLinearPath();
    this.assignTypesAndDoors(path);
    this.layoutPath(path);

    const mats = this.createMaterials(scene);
    for (const node of path) {
      this.buildRoom(scene, node, mats);
    }

    return {
      nodes: path,
      start: path[0],
      goal: path[path.length - 1],
      seed: actualSeed,
      floorHeight: LevelGenerator.FLOOR_HEIGHT,
      wallHeight: LevelGenerator.WALL_HEIGHT,
      cellSize: LevelGenerator.CELL_SIZE,
    };
  }

  // ================= 1. ЛИНЕЙНЫЙ ПУТЬ =================

  private generateLinearPath(): PathNode[] {
    const path: PathNode[] = [];
    const visited = new Set<string>();
    const target = LevelGenerator.PATH_LENGTH;
    const floors = LevelGenerator.FLOORS;

    // Распределяем горизонтальные шаги по этажам равномерно
    const totalUps = floors - 1;
    const horizontalTotal = target - totalUps - 1; // -1 на стартовую комнату
    const perFloor = Math.floor(horizontalTotal / floors);
    const extra = horizontalTotal - perFloor * floors;

    const startCell: Cell = { i: 0, j: 0, floor: 0 };
    const startNode: PathNode = {
      cell: startCell,
      prevDir: null,
      nextDir: null,
      doors: { n: false, s: false, w: false, e: false, up: false, down: false },
      type: "entrance",
      template: ROOM_TEMPLATES.entrance,
      centerX: 0,
      centerZ: 0,
      sizeX: 0,
      sizeZ: 0,
      isStart: true,
      isGoal: false,
    };
    path.push(startNode);
    visited.add(this.cellKey(startCell));

    let cur = startNode;

    for (let f = 0; f < floors; f++) {
      const horizOnFloor = perFloor + (f < extra ? 1 : 0);

      // Горизонтальные шаги на этом этаже
      for (let h = 0; h < horizOnFloor; h++) {
        const options: Array<{ dir: "n" | "s" | "w" | "e"; cell: Cell }> = [];
        const dirs: Array<{ dir: "n" | "s" | "w" | "e"; di: number; dj: number }> = [
          { dir: "n", di: 0, dj: -1 },
          { dir: "s", di: 0, dj: 1 },
          { dir: "w", di: -1, dj: 0 },
          { dir: "e", di: 1, dj: 0 },
        ];
        for (const d of dirs) {
          const ni = cur.cell.i + d.di;
          const nj = cur.cell.j + d.dj;
          if (ni < 0 || nj < 0 || ni >= this.gridW || nj >= this.gridD) continue;
          const cand: Cell = { i: ni, j: nj, floor: f };
          if (visited.has(this.cellKey(cand))) continue;
          options.push({ dir: d.dir, cell: cand });
        }
        if (options.length === 0) break;

        const chosen = options[Math.floor(this.rng() * options.length)];
        cur.nextDir = chosen.dir;

        const node: PathNode = {
          cell: chosen.cell,
          prevDir: this.oppositeDir(chosen.dir),
          nextDir: null,
          doors: { n: false, s: false, w: false, e: false, up: false, down: false },
          type: "corridor",
          template: ROOM_TEMPLATES.corridor,
          centerX: 0,
          centerZ: 0,
          sizeX: 0,
          sizeZ: 0,
          isStart: false,
          isGoal: false,
        };
        path.push(node);
        visited.add(this.cellKey(chosen.cell));
        cur = node;
      }

      // UP на следующий этаж (кроме последнего этажа)
      if (f < floors - 1) {
        const upCell: Cell = { i: cur.cell.i, j: cur.cell.j, floor: f + 1 };
        if (!visited.has(this.cellKey(upCell))) {
          cur.nextDir = "up";
          const node: PathNode = {
            cell: upCell,
            prevDir: "up",
            nextDir: null,
            doors: { n: false, s: false, w: false, e: false, up: false, down: false },
            type: "stair",
            template: ROOM_TEMPLATES.stair,
            centerX: 0,
            centerZ: 0,
            sizeX: 0,
            sizeZ: 0,
            isStart: false,
            isGoal: false,
          };
          path.push(node);
          visited.add(this.cellKey(upCell));
          cur = node;
        }
      }
    }

    return path;
  }

  private oppositeDir(d: PathNode["nextDir"]): PathNode["prevDir"] {
    if (d === "n") return "s";
    if (d === "s") return "n";
    if (d === "e") return "w";
    if (d === "w") return "e";
    if (d === "up") return "up";
    return null;
  }

  private cellKey(c: Cell): string {
    return `${c.floor},${c.i},${c.j}`;
  }

  // ================= 2. ТИПЫ И ДВЕРИ =================

  private assignTypesAndDoors(path: PathNode[]): void {
    for (let idx = 0; idx < path.length; idx++) {
      const node = path[idx];

      node.doors = {
        n: node.prevDir === "n" || node.nextDir === "n",
        s: node.prevDir === "s" || node.nextDir === "s",
        w: node.prevDir === "w" || node.nextDir === "w",
        e: node.prevDir === "e" || node.nextDir === "e",
        up: node.nextDir === "up",
        down: node.prevDir === "up",
      };

      if (idx === 0) {
        node.type = "entrance";
      } else if (idx === path.length - 1) {
        node.type = "drill";
      } else if (node.doors.up || node.doors.down) {
        node.type = "stair";
      } else {
        node.type = pickRandomType(this.rng);
      }

      node.template = ROOM_TEMPLATES[node.type];
      node.isStart = idx === 0;
      node.isGoal = idx === path.length - 1;
    }
  }

  // ================= 3. РАЗМЕРЫ И ПОЗИЦИИ =================

  private layoutPath(path: PathNode[]): void {
    // --- Размеры ---
    for (const node of path) {
      // Направление движения через комнату
      const entersFromNS = node.prevDir === "n" || node.prevDir === "s";
      const entersFromWE = node.prevDir === "w" || node.prevDir === "e";
      const exitsToNS = node.nextDir === "n" || node.nextDir === "s";
      const exitsToWE = node.nextDir === "w" || node.nextDir === "e";

      // Базовая вариативная ширина (перпендикуляр к движению)
      const variableWidth = 9 + this.rng() * 7; // 9..16

      let sizeX: number;
      let sizeZ: number;

      if (node.isStart || node.isGoal || node.doors.up || node.doors.down) {
        // Старт, финал и лестничные — квадратные, побольше
        const big = node.isGoal ? 20 : node.isStart ? 16 : 14;
        sizeX = big;
        sizeZ = big;
      } else if (entersFromNS && exitsToNS) {
        // Прямой проход по Z: Z фиксирован, X варьируется
        sizeX = variableWidth;
        sizeZ = LevelGenerator.CELL_SIZE;
      } else if (entersFromWE && exitsToWE) {
        // Прямой проход по X: X фиксирован, Z варьируется
        sizeX = LevelGenerator.CELL_SIZE;
        sizeZ = variableWidth;
      } else if (entersFromNS && exitsToWE) {
        // Поворот N→E: квадратная, вариативная
        sizeX = variableWidth;
        sizeZ = variableWidth;
      } else if (entersFromWE && exitsToNS) {
        // Поворот W→N: квадратная, вариативная
        sizeX = variableWidth;
        sizeZ = variableWidth;
      } else {
        // Тупик или иное — квадратная
        sizeX = variableWidth;
        sizeZ = variableWidth;
      }

      node.sizeX = sizeX;
      node.sizeZ = sizeZ;
    }

    // --- Позиции ---
    for (let idx = 0; idx < path.length; idx++) {
      const node = path[idx];

      if (idx === 0) {
        node.centerX = 0;
        node.centerZ = 0;
        continue;
      }

      const prev = path[idx - 1];
      const dir = node.prevDir;

      switch (dir) {
        case "n": {
          // Предыдущая комната к северу → мы размещаемся южнее
          const d = prev.sizeZ / 2 + node.sizeZ / 2;
          node.centerX = prev.centerX;
          node.centerZ = prev.centerZ + d;
          break;
        }
        case "s": {
          // Предыдущая к югу → мы севернее
          const d = prev.sizeZ / 2 + node.sizeZ / 2;
          node.centerX = prev.centerX;
          node.centerZ = prev.centerZ - d;
          break;
        }
        case "e": {
          // Предыдущая к востоку → мы западнее
          const d = prev.sizeX / 2 + node.sizeX / 2;
          node.centerZ = prev.centerZ;
          node.centerX = prev.centerX - d;
          break;
        }
        case "w": {
          // Предыдущая к западу → мы восточнее
          const d = prev.sizeX / 2 + node.sizeX / 2;
          node.centerZ = prev.centerZ;
          node.centerX = prev.centerX + d;
          break;
        }
        case "up": {
          node.centerX = prev.centerX;
          node.centerZ = prev.centerZ;
          break;
        }
        default:
          node.centerX = prev.centerX;
          node.centerZ = prev.centerZ;
      }
    }
  }

  // ================= 4. ГЕОМЕТРИЯ =================

  private buildRoom(scene: Scene, node: PathNode, mats: RoomMaterials): void {
    const floorY = node.cell.floor * LevelGenerator.FLOOR_HEIGHT;
    const wallH = LevelGenerator.WALL_HEIGHT;
    const wallT = 0.5;
    const cx = node.centerX;
    const cz = node.centerZ;
    const sx = node.sizeX;
    const sz = node.sizeZ;

    // --- Пол ---
    if (node.isGoal) {
      // Особый пол-обод строится в buildDrillPit
    } else if (node.doors.down) {
      this.buildFloorWithHole(scene, mats, cx, cz, floorY, sx, sz);
    } else {
      const f = MeshBuilder.CreateBox("floor",
        { width: sx, height: 0.2, depth: sz }, scene);
      f.position.set(cx, floorY - 0.1, cz);
      f.material = mats.sand;
      f.checkCollisions = true;
      f.isPickable = false;
    }

    // --- Потолок ---
    const ceilY = floorY + wallH + 0.1;
    if (node.doors.up) {
      this.buildCeilingWithHole(scene, mats, cx, cz, ceilY, sx, sz);
    } else if (!node.isGoal) {
      const c = MeshBuilder.CreateBox("ceil",
        { width: sx, height: 0.2, depth: sz }, scene);
      c.position.set(cx, ceilY, cz);
      c.material = mats.darkStone;
      c.checkCollisions = true;
      c.isPickable = false;
    }

    // --- Стены ---
    const fullWallH = LevelGenerator.FLOOR_HEIGHT;
    this.buildWall(scene, mats.stone, cx, cz - sz / 2, floorY, sx, wallT, "x", node.doors.n, fullWallH);
    this.buildWall(scene, mats.stone, cx, cz + sz / 2, floorY, sx, wallT, "x", node.doors.s, fullWallH);
    this.buildWall(scene, mats.stone, cx - sx / 2, cz, floorY, sz, wallT, "z", node.doors.w, fullWallH);
    this.buildWall(scene, mats.stone, cx + sx / 2, cz, floorY, sz, wallT, "z", node.doors.e, fullWallH);

    // --- Декор ---
    node.template.buildDecor(scene, new Vector3(cx, 0, cz), Math.min(sx, sz), floorY, mats, node.doors);

    // --- Рампа вверх ---
    if (node.doors.up) {
      this.buildRampUp(scene, mats, cx, cz, floorY);
    }

    // --- Финальная комната ---
    if (node.isGoal) {
      this.buildDrillPit(scene, mats, cx, cz, floorY, sx, sz);
    }
  }

  private buildWall(
    scene: Scene,
    material: StandardMaterial,
    centerX: number,
    centerZ: number,
    floorY: number,
    wallLength: number,
    thickness: number,
    axis: "x" | "z",
    hasDoor: boolean,
    height: number
  ): void {
    const doorWidth = 3.6;
    const doorHeight = 3.4;

    const dims = (len: number, h: number): [number, number, number] =>
      axis === "x" ? [len, h, thickness] : [thickness, h, len];

    const addBox = (len: number, h: number, offset: number, y: number): Mesh => {
      const [w, hh, d] = dims(len, h);
      const box = MeshBuilder.CreateBox("wall", { width: w, height: hh, depth: d }, scene);
      if (axis === "x") box.position.set(centerX + offset, floorY + y, centerZ);
      else box.position.set(centerX, floorY + y, centerZ + offset);
      box.material = material;
      box.checkCollisions = true;
      box.isPickable = false;
      return box;
    };

    if (!hasDoor) {
      addBox(wallLength, height, 0, height / 2);
      return;
    }

    const sideWidth = Math.max(0.5, (wallLength - doorWidth) / 2);
    const offset = doorWidth / 2 + sideWidth / 2;
    addBox(sideWidth, height, -offset, height / 2);
    addBox(sideWidth, height, offset, height / 2);
    addBox(doorWidth, height - doorHeight, 0, doorHeight + (height - doorHeight) / 2);
  }

  /** Пол с дырой по центру-северу (для рампы снизу). */
  private buildFloorWithHole(
    scene: Scene,
    mats: RoomMaterials,
    cx: number,
    cz: number,
    floorY: number,
    sx: number,
    sz: number
  ): void {
    const holeCenterZ = cz + HOLE_Z_OFFSET;
    const holeN = holeCenterZ - HOLE_HALF_Z;
    const holeS = holeCenterZ + HOLE_HALF_Z;

    const makeStrip = (w: number, d: number, x: number, z: number): void => {
      const m = MeshBuilder.CreateBox("floorStrip",
        { width: w, height: 0.2, depth: d }, scene);
      m.position.set(x, floorY - 0.1, z);
      m.material = mats.sand;
      m.checkCollisions = true;
      m.isPickable = false;
    };

    // Полоса севернее дыры
    const nTop = cz - sz / 2;
    if (holeN > nTop + 0.1) {
      makeStrip(sx, holeN - nTop, cx, (nTop + holeN) / 2);
    }
    // Полоса южнее дыры
    const sBottom = cz + sz / 2;
    if (sBottom > holeS + 0.1) {
      makeStrip(sx, sBottom - holeS, cx, (holeS + sBottom) / 2);
    }
    // Полоса западнее дыры
    const wLeft = cx - sx / 2;
    if (cx - HOLE_HALF_X > wLeft + 0.1) {
      makeStrip(cx - HOLE_HALF_X - wLeft, HOLE_HALF_Z * 2,
        (wLeft + cx - HOLE_HALF_X) / 2, holeCenterZ);
    }
    // Полоса восточнее дыры
    const eRight = cx + sx / 2;
    if (eRight > cx + HOLE_HALF_X + 0.1) {
      makeStrip(eRight - cx - HOLE_HALF_X, HOLE_HALF_Z * 2,
        (cx + HOLE_HALF_X + eRight) / 2, holeCenterZ);
    }
  }

  /** Потолок с дырой в том же месте, где рампа наверх. */
  private buildCeilingWithHole(
    scene: Scene,
    mats: RoomMaterials,
    cx: number,
    cz: number,
    ceilY: number,
    sx: number,
    sz: number
  ): void {
    const holeCenterZ = cz + HOLE_Z_OFFSET;
    const holeN = holeCenterZ - HOLE_HALF_Z;
    const holeS = holeCenterZ + HOLE_HALF_Z;

    const makeStrip = (w: number, d: number, x: number, z: number): void => {
      const m = MeshBuilder.CreateBox("ceilStrip",
        { width: w, height: 0.2, depth: d }, scene);
      m.position.set(x, ceilY, z);
      m.material = mats.darkStone;
      m.checkCollisions = true;
      m.isPickable = false;
    };

    const nTop = cz - sz / 2;
    if (holeN > nTop + 0.1) {
      makeStrip(sx, holeN - nTop, cx, (nTop + holeN) / 2);
    }
    const sBottom = cz + sz / 2;
    if (sBottom > holeS + 0.1) {
      makeStrip(sx, sBottom - holeS, cx, (holeS + sBottom) / 2);
    }
    const wLeft = cx - sx / 2;
    if (cx - HOLE_HALF_X > wLeft + 0.1) {
      makeStrip(cx - HOLE_HALF_X - wLeft, HOLE_HALF_Z * 2,
        (wLeft + cx - HOLE_HALF_X) / 2, holeCenterZ);
    }
    const eRight = cx + sx / 2;
    if (eRight > cx + HOLE_HALF_X + 0.1) {
      makeStrip(eRight - cx - HOLE_HALF_X, HOLE_HALF_Z * 2,
        (cx + HOLE_HALF_X + eRight) / 2, holeCenterZ);
    }
  }

  /** Рампа от юга (низ) к северу (верх). Верх точно под дырой в потолке. */
  private buildRampUp(
    scene: Scene,
    mats: RoomMaterials,
    cx: number,
    cz: number,
    floorY: number
  ): void {
    const len = Math.sqrt(RAMP_RUN * RAMP_RUN + RAMP_RISE * RAMP_RISE);
    const angle = Math.atan2(RAMP_RISE, RAMP_RUN);
    const rampCenterZ = cz + HOLE_Z_OFFSET; // центр рампы совпадает с центром дыры

    const ramp = MeshBuilder.CreateBox("ramp",
      { width: 4.0, height: 0.4, depth: len }, scene);
    ramp.position.set(cx, floorY + RAMP_RISE / 2, rampCenterZ);
    ramp.rotation.x = angle; // +X-ось: -Z конец идёт вверх
    ramp.material = mats.darkStone;
    ramp.checkCollisions = true;
    ramp.isPickable = false;
  }

  /** Финальная комната: открытый верх, синий свет, яма с буром и спуском. */
  private buildDrillPit(
    scene: Scene,
    mats: RoomMaterials,
    cx: number,
    cz: number,
    floorY: number,
    sx: number,
    sz: number
  ): void {
    const minSize = Math.min(sx, sz);
    const pitTopSize = minSize * 0.55;    // обод = 22.5% комнаты с каждой стороны
    const pitBottomSize = minSize * 0.3;
    const pitDepth = 2.5;
    const rimWidth = (minSize - pitTopSize) / 2;

    // --- Обод пола вокруг ямы ---
    const mkRim = (w: number, d: number, x: number, z: number): void => {
      const b = MeshBuilder.CreateBox("pitRim",
        { width: w, height: 0.2, depth: d }, scene);
      b.position.set(x, floorY - 0.1, z);
      b.material = mats.sand;
      b.checkCollisions = true;
      b.isPickable = false;
    };
    mkRim(sx, rimWidth, cx, cz - pitTopSize / 2 - rimWidth / 2);
    mkRim(sx, rimWidth, cx, cz + pitTopSize / 2 + rimWidth / 2);
    mkRim(rimWidth, pitTopSize, cx - pitTopSize / 2 - rimWidth / 2, cz);
    mkRim(rimWidth, pitTopSize, cx + pitTopSize / 2 + rimWidth / 2, cz);

    // --- Стенки ямы (усечённая пирамида) ---
    const pit = MeshBuilder.CreateCylinder("drillPit", {
      height: pitDepth,
      diameterTop: pitTopSize,
      diameterBottom: pitBottomSize,
      tessellation: 4,
    }, scene);
    pit.position.set(cx, floorY - pitDepth / 2, cz);
    pit.rotation.y = Math.PI / 4;

    const pitMat = mats.stone.clone("drillPitMat");
    pitMat.backFaceCulling = false;
    pit.material = pitMat;
    pit.checkCollisions = true;
    pit.isPickable = false;

    // --- Дно ямы ---
    const pitFloor = MeshBuilder.CreateBox("drillPitFloor",
      { width: pitBottomSize, height: 0.3, depth: pitBottomSize }, scene);
    pitFloor.position.set(cx, floorY - pitDepth - 0.15, cz);
    pitFloor.material = mats.darkStone;
    pitFloor.checkCollisions = true;
    pitFloor.isPickable = false;

    // --- Рампа вдоль западной стенки ямы ---
    const rimEdgeX = cx - pitTopSize / 2 + 0.6;
    const bottomEdgeX = cx - pitBottomSize / 2 + 0.6;
    const rampRun = Math.abs(rimEdgeX - bottomEdgeX);
    const rampLen = Math.sqrt(rampRun * rampRun + pitDepth * pitDepth);
    const rampAngle = Math.atan2(pitDepth, rampRun);

    const ramp = MeshBuilder.CreateBox("drillRamp",
      { width: rampLen, height: 0.4, depth: 3.5 }, scene);
    ramp.position.set((rimEdgeX + bottomEdgeX) / 2, floorY - pitDepth / 2, cz);
    // Знак rotation.z: чтобы запад (rimEdge) был выше востока (bottomEdge)
    ramp.rotation.z = -rampAngle;
    ramp.material = mats.darkStone;
    ramp.checkCollisions = true;
    ramp.isPickable = false;

    // --- Синий лунный свет ---
    const moon = new DirectionalLight("drillMoon",
      new Vector3(0.2, -1, 0.15), scene);
    moon.position.set(cx + 5, floorY + 20, cz + 5);
    moon.intensity = 1.2;
    moon.diffuse = new Color3(0.55, 0.7, 1.0);
    moon.specular = new Color3(0.3, 0.4, 0.6);

    const fill = new HemisphericLight("drillFill",
      new Vector3(0, 1, 0), scene);
    fill.intensity = 0.35;
    fill.diffuse = new Color3(0.5, 0.6, 0.85);
    fill.groundColor = new Color3(0.05, 0.07, 0.12);
  }

  // ================= МАТЕРИАЛЫ =================

  private createMaterials(scene: Scene): RoomMaterials {
    const stone = new StandardMaterial("stone", scene);
    stone.diffuseColor = new Color3(0.55, 0.46, 0.33);
    stone.specularColor = new Color3(0.04, 0.04, 0.04);
    stone.ambientColor = new Color3(0.25, 0.2, 0.13);

    const tex = new DynamicTexture("stoneTex", { width: 256, height: 256 }, scene, false);
    const ctx = tex.getContext();
    ctx.fillStyle = "#7a6a4c";
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = "#4c3e28";
    ctx.lineWidth = 3;
    for (let y = 0; y < 256; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(256, y);
      ctx.stroke();
      const offset = (y / 32) % 2 === 0 ? 0 : 40;
      for (let x = offset; x < 256; x += 80) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + 32);
        ctx.stroke();
      }
    }
    tex.update();
    stone.diffuseTexture = tex;

    const darkStone = new StandardMaterial("darkStone", scene);
    darkStone.diffuseColor = new Color3(0.3, 0.24, 0.18);
    darkStone.specularColor = new Color3(0.03, 0.03, 0.03);
    darkStone.ambientColor = new Color3(0.15, 0.12, 0.08);

    const sand = new StandardMaterial("sand", scene);
    sand.diffuseColor = new Color3(0.85, 0.7, 0.45);
    sand.specularColor = Color3.Black();
    sand.emissiveColor = new Color3(0.18, 0.14, 0.09);
    sand.ambientColor = new Color3(0.5, 0.4, 0.25);

    const metal = new StandardMaterial("metal", scene);
    metal.diffuseColor = new Color3(0.4, 0.42, 0.45);
    metal.specularColor = new Color3(0.2, 0.2, 0.2);

    const wood = new StandardMaterial("wood", scene);
    wood.diffuseColor = new Color3(0.32, 0.22, 0.12);
    wood.specularColor = new Color3(0.05, 0.05, 0.05);

    return { stone, darkStone, sand, metal, wood };
  }
}