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
  RoomMaterials,
  RoomTemplate,
  RoomType,
  ROOM_TEMPLATES,
  drillHallTemplate,
  pickRandomType,
} from "../data/RoomTemplates";

export interface Cell {
  i: number;
  j: number;
  floor: number;
}

export interface RoomInfo {
  cell: Cell;
  type: RoomType;
  template: RoomTemplate;
  isDrillRoom: boolean;
}

export interface LevelData {
  readonly size: number;
  readonly floors: number;
  readonly cellSize: number;
  readonly wallHeight: number;
  readonly floorHeight: number;
  readonly start: Cell;
  readonly goal: Cell;
  readonly connections: ReadonlySet<string>;
  readonly rooms: ReadonlyMap<string, RoomInfo>;
  readonly seed: number;
  cellCenter(cell: Cell): Vector3;
  roomKey(cell: Cell): string;
}

function mulberry32(a: number): () => number {
  return () => {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Многоуровневая пирамида: 3 этажа × 4×4, лестницы, шаблоны комнат.
 * Комната с буром — увеличенная и опущена ниже уровня.
 */
export class LevelGenerator {
  static readonly SIZE = 4;
  static readonly FLOORS = 3;
  static readonly CELL_SIZE = 14;
  static readonly WALL_HEIGHT = 4.2;
  static readonly FLOOR_HEIGHT = 5.5;

  private readonly connections = new Set<string>();
  private readonly rooms = new Map<string, RoomInfo>();
  private rng: () => number = Math.random;

  static connectionKey(a: Cell, b: Cell): string {
    const k1 = `${a.floor},${a.i},${a.j}`;
    const k2 = `${b.floor},${b.i},${b.j}`;
    return k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`;
  }

  static roomKey(cell: Cell): string {
    return `${cell.floor},${cell.i},${cell.j}`;
  }

  build(scene: Scene, seed?: number): LevelData {
    this.connections.clear();
    this.rooms.clear();

    const actualSeed = seed ?? (Date.now() & 0xffffffff);
    this.rng = mulberry32(actualSeed);

    const size = LevelGenerator.SIZE;
    const cellSize = LevelGenerator.CELL_SIZE;
    const floors = LevelGenerator.FLOORS;

    const start: Cell = { i: 0, j: 0, floor: 0 };
    const goal: Cell = { i: size - 1, j: size - 1, floor: floors - 1 };

    for (let f = 0; f < floors; f++) {
      this.carveFloor(size, f);
    }
    this.placeStairs(size, floors);
    this.assignRoomTypes(size, floors, goal);
    this.ensureReachable(start, goal, size, floors);

    const mats = this.createMaterials(scene);
    this.buildGeometry(scene, size, floors, cellSize, mats);

    const cellCenter = (cell: Cell): Vector3 => {
      const room = this.rooms.get(LevelGenerator.roomKey(cell));
      const offset = room?.template.floorOffset ?? 0;
      const baseY = cell.floor * LevelGenerator.FLOOR_HEIGHT + offset;
      return new Vector3(cell.i * cellSize, baseY, cell.j * cellSize);
    };

    return {
      size,
      floors,
      cellSize,
      wallHeight: LevelGenerator.WALL_HEIGHT,
      floorHeight: LevelGenerator.FLOOR_HEIGHT,
      start,
      goal,
      connections: this.connections,
      rooms: this.rooms,
      seed: actualSeed,
      cellCenter,
      roomKey: LevelGenerator.roomKey,
    };
  }

  private isConnected(a: Cell, b: Cell): boolean {
    return this.connections.has(LevelGenerator.connectionKey(a, b));
  }

  private carveFloor(size: number, floor: number): void {
    const visited: boolean[][] = [];
    for (let i = 0; i < size; i++) visited.push(new Array(size).fill(false));

    const start: Cell = { i: 0, j: 0, floor };
    const stack: Cell[] = [start];
    visited[0][0] = true;

    const dirs: Array<[number, number]> = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];

    while (stack.length > 0) {
      const cur = stack[stack.length - 1];
      const neigh: Cell[] = [];
      for (const [di, dj] of dirs) {
        const ni = cur.i + di;
        const nj = cur.j + dj;
        if (ni < 0 || nj < 0 || ni >= size || nj >= size) continue;
        if (visited[ni][nj]) continue;
        neigh.push({ i: ni, j: nj, floor });
      }
      if (neigh.length === 0) {
        stack.pop();
        continue;
      }
      const next = neigh[Math.floor(this.rng() * neigh.length)];
      visited[next.i][next.j] = true;
      this.connections.add(LevelGenerator.connectionKey(cur, next));
      stack.push(next);
    }
  }

  private placeStairs(size: number, floors: number): void {
    for (let f = 0; f < floors - 1; f++) {
      const candidates: Cell[] = [];
      for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
          candidates.push({ i, j, floor: f });
        }
      }
      for (let k = candidates.length - 1; k > 0; k--) {
        const r = Math.floor(this.rng() * (k + 1));
        [candidates[k], candidates[r]] = [candidates[r], candidates[k]];
      }
      const count = 1 + (this.rng() > 0.5 ? 1 : 0);
      for (let n = 0; n < count && n < candidates.length; n++) {
        const lower = candidates[n];
        const upper: Cell = { i: lower.i, j: lower.j, floor: f + 1 };
        this.connections.add(LevelGenerator.connectionKey(lower, upper));
      }
    }
  }

  private assignRoomTypes(size: number, floors: number, goal: Cell): void {
    const stairCells = new Set<string>();
    for (const key of this.connections) {
      const [a, b] = key.split("|");
      const [fa, ia, ja] = a.split(",").map(Number);
      const [fb, ib, jb] = b.split(",").map(Number);
      if (fa !== fb) {
        stairCells.add(`${fa},${ia},${ja}`);
        stairCells.add(`${fb},${ib},${jb}`);
      }
    }

    for (let f = 0; f < floors; f++) {
      for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
          const cell: Cell = { i, j, floor: f };
          const key = LevelGenerator.roomKey(cell);
          const isGoal = cell.floor === goal.floor && cell.i === goal.i && cell.j === goal.j;
          const isStair = stairCells.has(key);

          let type: RoomType;
          let template: RoomTemplate;
          if (isGoal) {
            type = "hall";
            template = drillHallTemplate;
          } else if (isStair) {
            type = "stair";
            template = ROOM_TEMPLATES.stair;
          } else {
            type = pickRandomType(this.rng);
            template = ROOM_TEMPLATES[type];
          }

          this.rooms.set(key, {
            cell,
            type,
            template,
            isDrillRoom: isGoal,
          });
        }
      }
    }
  }

  private ensureReachable(start: Cell, goal: Cell, size: number, floors: number): void {
    const visited = new Set<string>();
    const queue: Cell[] = [start];
    visited.add(LevelGenerator.roomKey(start));

    const dirs: Array<[number, number, number]> = [
      [1, 0, 0],
      [-1, 0, 0],
      [0, 1, 0],
      [0, -1, 0],
      [0, 0, 1],
      [0, 0, -1],
    ];

    while (queue.length > 0) {
      const cur = queue.shift()!;
      for (const [di, dj, df] of dirs) {
        const next: Cell = { i: cur.i + di, j: cur.j + dj, floor: cur.floor + df };
        if (next.i < 0 || next.j < 0 || next.i >= size || next.j >= size) continue;
        if (next.floor < 0 || next.floor >= floors) continue;
        if (!this.isConnected(cur, next)) continue;
        const k = LevelGenerator.roomKey(next);
        if (visited.has(k)) continue;
        visited.add(k);
        queue.push(next);
      }
    }

    if (!visited.has(LevelGenerator.roomKey(goal))) {
      for (let f = 0; f < floors - 1; f++) {
        const a: Cell = { i: goal.i, j: goal.j, floor: f };
        const b: Cell = { i: goal.i, j: goal.j, floor: f + 1 };
        this.connections.add(LevelGenerator.connectionKey(a, b));
        const ka = LevelGenerator.roomKey(a);
        const kb = LevelGenerator.roomKey(b);
        if (this.rooms.has(ka)) {
          const r = this.rooms.get(ka)!;
          this.rooms.set(ka, { ...r, type: "stair", template: ROOM_TEMPLATES.stair });
        }
        if (this.rooms.has(kb)) {
          const r = this.rooms.get(kb)!;
          this.rooms.set(kb, { ...r, type: "stair", template: ROOM_TEMPLATES.stair });
        }
      }
    }
  }

  private createMaterials(scene: Scene): RoomMaterials {
    const stone = new StandardMaterial("pyrStone", scene);
    stone.diffuseColor = new Color3(0.55, 0.48, 0.35);
    stone.specularColor = new Color3(0.04, 0.04, 0.04);
    stone.ambientColor = new Color3(0.12, 0.1, 0.07);

    const tex = new DynamicTexture("stoneTex", { width: 256, height: 256 }, scene, false);
    const ctx = tex.getContext();
    ctx.fillStyle = "#8a7a5c";
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = "#5c4e38";
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

    const darkStone = new StandardMaterial("pyrDark", scene);
    darkStone.diffuseColor = new Color3(0.28, 0.24, 0.18);
    darkStone.specularColor = new Color3(0.03, 0.03, 0.03);

    const sand = new StandardMaterial("pyrSand", scene);
    sand.diffuseColor = new Color3(0.42, 0.36, 0.26);
    sand.specularColor = Color3.Black();

    const metal = new StandardMaterial("pyrMetal", scene);
    metal.diffuseColor = new Color3(0.4, 0.42, 0.45);
    metal.specularColor = new Color3(0.2, 0.2, 0.2);

    const wood = new StandardMaterial("pyrWood", scene);
    wood.diffuseColor = new Color3(0.32, 0.22, 0.12);
    wood.specularColor = new Color3(0.05, 0.05, 0.05);

    return { stone, darkStone, sand, metal, wood };
  }

  private buildGeometry(
    scene: Scene,
    size: number,
    floors: number,
    cellSize: number,
    mats: RoomMaterials
  ): void {
    for (let f = 0; f < floors; f++) {
      this.buildFloorLevel(scene, size, f, cellSize, mats);
    }
  }

  private buildFloorLevel(
    scene: Scene,
    size: number,
    floor: number,
    cellSize: number,
    mats: RoomMaterials
  ): void {
    const baseY = floor * LevelGenerator.FLOOR_HEIGHT;

    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        const cell: Cell = { i, j, floor };
        const room = this.rooms.get(LevelGenerator.roomKey(cell))!;
        const floorY = baseY;
        const cx = i * cellSize;
        const cz = j * cellSize;
        const roomW = cellSize;
        const roomHalf = roomW / 2;

        // Если это комната с буром — генерируем её особой функцией и пропускаем стандартную
        if (room.isDrillRoom) {
          // Стены с дверьми строим как обычно (нужны двери от соседей)
          const northDoor = j > 0 && this.isConnected(cell, { i, j: j - 1, floor });
          const southDoor = j < size - 1 && this.isConnected(cell, { i, j: j + 1, floor });
          const westDoor  = i > 0 && this.isConnected(cell, { i: i - 1, j, floor });
          const eastDoor  = i < size - 1 && this.isConnected(cell, { i: i + 1, j, floor });

          if (j === 0 || !northDoor) this.createWall(scene, mats.stone, cx, cz - roomHalf, floorY, "x", false);
          if (j === size - 1 || !southDoor) this.createWall(scene, mats.stone, cx, cz + roomHalf, floorY, "x", false);
          if (i === 0 || !westDoor)  this.createWall(scene, mats.stone, cx - roomHalf, cz, floorY, "z", false);
          if (i === size - 1 || !eastDoor) this.createWall(scene, mats.stone, cx + roomHalf, cz, floorY, "z", false);

          this.buildDrillRoom(scene, cx, cz, floorY, roomW, mats);
          continue; // Пропускаем стандартный пол/потолок/декор
        }

        // --- ПОЛ ---
        const isStairRoom = room.type === "stair";
        const hasLower = this.isConnected(cell, { i, j, floor: floor - 1 });
        const needFloorHole = isStairRoom && hasLower;

        if (needFloorHole) {
          // Пол-рамка с дыркой по центру (для лестничной комнаты сверху)
          const holeHalf = 1.8;
          const sideW = roomHalf - holeHalf;

          const mkFloorStrip = (w: number, d: number, x: number, z: number) => {
            const b = MeshBuilder.CreateBox("floorStrip",
              { width: w, height: 0.2, depth: d }, scene);
            b.position.set(x, floorY - 0.1, z);
            b.material = mats.sand;
            b.checkCollisions = true;
            b.isPickable = false;
          };
          mkFloorStrip(roomW, sideW, cx, cz - holeHalf - sideW / 2);
          mkFloorStrip(roomW, sideW, cx, cz + holeHalf + sideW / 2);
          mkFloorStrip(sideW, holeHalf * 2, cx - holeHalf - sideW / 2, cz);
          mkFloorStrip(sideW, holeHalf * 2, cx + holeHalf + sideW / 2, cz);
        } else {
          // Обычный цельный пол
          const floorMesh = MeshBuilder.CreateBox(
            `floor_${floor}_${i}_${j}`,
            { width: roomW, height: 0.2, depth: roomW },
            scene
          );
          floorMesh.position.set(cx, floorY - 0.1, cz);
          floorMesh.material = mats.sand;
          floorMesh.checkCollisions = true;
          floorMesh.isPickable = false;
        }

        // --- ПОТОЛОК ---
        const hasUpper = this.isConnected(cell, { i, j, floor: floor + 1 });
        const needCeilHole = isStairRoom && hasUpper;

        if (needCeilHole) {
          // Потолок-рамка с дыркой (для лестничной комнаты снизу)
          const holeHalf = 1.8;
          const sideW = roomHalf - holeHalf;
          const ceilY = floorY + LevelGenerator.WALL_HEIGHT + 0.1;

          const mkCeilStrip = (w: number, d: number, x: number, z: number) => {
            const b = MeshBuilder.CreateBox("ceilStrip",
              { width: w, height: 0.2, depth: d }, scene);
            b.position.set(x, ceilY, z);
            b.material = mats.darkStone;
            b.checkCollisions = true;
            b.isPickable = false;
          };
          mkCeilStrip(roomW, sideW, cx, cz - holeHalf - sideW / 2);
          mkCeilStrip(roomW, sideW, cx, cz + holeHalf + sideW / 2);
          mkCeilStrip(sideW, holeHalf * 2, cx - holeHalf - sideW / 2, cz);
          mkCeilStrip(sideW, holeHalf * 2, cx + holeHalf + sideW / 2, cz);
        } else {
          // Обычный цельный потолок
          const ceil = MeshBuilder.CreateBox(
            `ceil_${floor}_${i}_${j}`,
            { width: roomW, height: 0.2, depth: roomW },
            scene
          );
          ceil.position.set(cx, floorY + LevelGenerator.WALL_HEIGHT + 0.1, cz);
          ceil.material = mats.darkStone;
          ceil.checkCollisions = true;
          ceil.isPickable = false;
        }

        let northDoor = j > 0 && this.isConnected(cell, { i, j: j - 1, floor });
        let southDoor = j < size - 1 && this.isConnected(cell, { i, j: j + 1, floor });
        let westDoor = i > 0 && this.isConnected(cell, { i: i - 1, j, floor });
        let eastDoor = i < size - 1 && this.isConnected(cell, { i: i + 1, j, floor });

        // Для лестничной комнаты оставляем ровно один боковой выход
        if (isStairRoom) {
          let kept = false;
          northDoor = northDoor && !kept ? (kept = true) : false;
          southDoor = southDoor && !kept ? (kept = true) : false;
          westDoor  = westDoor  && !kept ? (kept = true) : false;
          eastDoor  = eastDoor  && !kept ? (kept = true) : false;
        }

        if (j === 0 || !northDoor) this.createWall(scene, mats.stone, cx, cz - roomHalf, floorY, "x", false);
        else this.createWall(scene, mats.stone, cx, cz - roomHalf, floorY, "x", true);

        if (j === size - 1 || !southDoor) this.createWall(scene, mats.stone, cx, cz + roomHalf, floorY, "x", false);
        else this.createWall(scene, mats.stone, cx, cz + roomHalf, floorY, "x", true);

        if (i === 0 || !westDoor) this.createWall(scene, mats.stone, cx - roomHalf, cz, floorY, "z", false);
        else this.createWall(scene, mats.stone, cx - roomHalf, cz, floorY, "z", true);

        if (i === size - 1 || !eastDoor) this.createWall(scene, mats.stone, cx + roomHalf, cz, floorY, "z", false);
        else this.createWall(scene, mats.stone, cx + roomHalf, cz, floorY, "z", true);

        room.template.buildDecor(scene, new Vector3(cx, 0, cz), cellSize, floorY, mats);

        if (room.type === "stair") {
          const upperExists = this.isConnected(cell, { i, j, floor: floor + 1 });
          if (upperExists) {
            this.buildRamp(scene, cx, cz, floorY, LevelGenerator.FLOOR_HEIGHT, mats.stone, true);
          }
        }
      }
    }
  }

  private createWall(
    scene: Scene,
    material: StandardMaterial,
    centerX: number,
    centerZ: number,
    floorY: number,
    axis: "x" | "z",
    hasDoor: boolean
  ): void {
    const length = LevelGenerator.CELL_SIZE;
    const height = LevelGenerator.WALL_HEIGHT;
    const thickness = 0.45;
    const doorWidth = 3.4;
    const doorHeight = 2.7;

    const dims = (len: number, h: number): [number, number, number] =>
      axis === "x" ? [len, h, thickness] : [thickness, h, len];

    const addBox = (len: number, h: number, offsetAlong: number, y: number): Mesh => {
      const [w, hh, d] = dims(len, h);
      const box = MeshBuilder.CreateBox("wall", { width: w, height: hh, depth: d }, scene);
      if (axis === "x") {
        box.position.set(centerX + offsetAlong, floorY + y, centerZ);
      } else {
        box.position.set(centerX, floorY + y, centerZ + offsetAlong);
      }
      box.material = material;
      box.checkCollisions = true;
      box.isPickable = true;
      return box;
    };

    if (!hasDoor) {
      addBox(length, height, 0, height / 2);
      return;
    }

    const sideWidth = (length - doorWidth) / 2;
    const offset = doorWidth / 2 + sideWidth / 2;
    addBox(sideWidth, height, -offset, height / 2);
    addBox(sideWidth, height, offset, height / 2);
    addBox(doorWidth, height - doorHeight, 0, doorHeight + (height - doorHeight) / 2);
  }

  /**
   * Финальный зал: открытый верх, синий свет, усечённая пирамида вниз с буром на дне.
   */
  private buildDrillRoom(
    scene: Scene,
    cx: number,
    cz: number,
    floorY: number,
    roomW: number,
    mats: RoomMaterials
  ): void {
    const pitTopSize = roomW * 0.72;        // ~10 м при комнате 14
    const pitBottomSize = roomW * 0.32;     // ~4.5 м
    const rimWidth = (roomW - pitTopSize) / 2;
    const pitDepth = 4.0;

    // ---------- 1. Обод пола вокруг ямы (4 полосы) ----------
    const mkRim = (w: number, d: number, x: number, z: number) => {
      const b = MeshBuilder.CreateBox("drillRim",
        { width: w, height: 0.2, depth: d }, scene);
      b.position.set(x, floorY - 0.1, z);
      b.material = mats.sand;
      b.checkCollisions = true;
      b.isPickable = false;
    };
    mkRim(roomW, rimWidth, cx, cz - pitTopSize / 2 - rimWidth / 2);
    mkRim(roomW, rimWidth, cx, cz + pitTopSize / 2 + rimWidth / 2);
    mkRim(rimWidth, pitTopSize, cx - pitTopSize / 2 - rimWidth / 2, cz);
    mkRim(rimWidth, pitTopSize, cx + pitTopSize / 2 + rimWidth / 2, cz);

    // ---------- 2. Стены ямы (усечённая пирамида) ----------
    // CreateCylinder с tessellation=4 даёт квадрат; диаметры задают верх/низ.
    const pit = MeshBuilder.CreateCylinder("drillPit", {
      height: pitDepth,
      diameterTop: pitTopSize,
      diameterBottom: pitBottomSize,
      tessellation: 4,
      sideOrientation: Mesh.BACKSIDE, // видеть стенки изнутри
    }, scene);
    pit.position.set(cx, floorY - pitDepth / 2, cz);
    pit.rotation.y = Math.PI / 4; // разворачиваем квадрат лицом к осям
    pit.material = mats.stone;
    pit.checkCollisions = true;
    pit.isPickable = false;

    // ---------- 3. Дно ямы ----------
    const pitFloor = MeshBuilder.CreateBox("drillPitFloor",
      { width: pitBottomSize, height: 0.3, depth: pitBottomSize }, scene);
    pitFloor.position.set(cx, floorY - pitDepth - 0.15, cz);
    pitFloor.material = mats.darkStone;
    pitFloor.checkCollisions = true;
    pitFloor.isPickable = false;

    // ---------- 4. Рампа вдоль западной стенки ямы ----------
    // Идёт от обода на западной стороне вниз к западному краю дна.
    const rampStartX = cx - pitTopSize / 2 + 0.5; // край ямы (запад)
    const rampEndX   = cx - pitBottomSize / 2 + 0.5;
    const rampRun    = rampStartX - rampEndX;
    const rampLen    = Math.sqrt(rampRun * rampRun + pitDepth * pitDepth);
    const rampAngle  = Math.atan2(pitDepth, rampRun);

    const ramp = MeshBuilder.CreateBox("drillRamp",
      { width: rampLen, height: 0.3, depth: 2.5 }, scene);
    ramp.position.set(
      (rampStartX + rampEndX) / 2,
      floorY - pitDepth / 2,
      cz
    );
    // Наклоняем по X-оси: чем больше X, тем ниже — поэтому rotation.z положительный
    ramp.rotation.z = rampAngle;
    ramp.material = mats.darkStone;
    ramp.checkCollisions = true;
    ramp.isPickable = false;

    // ---------- 5. Синий лунный свет сверху ----------
    const moon = new DirectionalLight(
      "drillMoon",
      new Vector3(0.2, -1, 0.15),
      scene
    );
    moon.position.set(cx + 5, floorY + 20, cz + 5);
    moon.intensity = 1.1;
    moon.diffuse = new Color3(0.55, 0.7, 1.0);   // холодный голубой
    moon.specular = new Color3(0.3, 0.4, 0.6);

    // Мягкий ambient внутри зала, чтобы стены не были чёрными
    const fill = new HemisphericLight(
      "drillFill",
      new Vector3(0, 1, 0),
      scene
    );
    fill.intensity = 0.25;
    fill.diffuse = new Color3(0.4, 0.5, 0.75);
    fill.groundColor = new Color3(0.05, 0.06, 0.1);
  }

  private buildRamp(
    scene: Scene,
    cx: number,
    cz: number,
    floorY: number,
    rise: number,
    mat: StandardMaterial,
    upward: boolean
  ): void {
    const run = 4.5;
    const len = Math.sqrt(run * run + rise * rise);
    const angle = Math.atan2(rise, run);

    const ramp = MeshBuilder.CreateBox("ramp",
      { width: 3.2, height: 0.4, depth: len }, scene);
    ramp.position.set(
      cx,
      floorY + rise / 2,
      cz + (upward ? run / 2 : -run / 2)
    );
    ramp.rotation.x = upward ? -angle : angle;
    ramp.material = mat;
    ramp.checkCollisions = true;
    ramp.isPickable = false;
  }
}
