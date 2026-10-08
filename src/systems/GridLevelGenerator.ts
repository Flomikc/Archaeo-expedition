import { Scene } from "@babylonjs/core";

import {
  NO_EXITS,
  RoomBlueprint,
  RoomContext,
  RoomExits,
  RoomInstance,
  RoomMaterials,
} from "../data/RoomBlueprint";
import { createRoomMaterials } from "../data/room-materials";
import { ALL_BLUEPRINTS, findBlueprint } from "../data/blueprints";

// ============================================================
//  КОНФИГУРАЦИЯ
// ============================================================

export interface GenerationOptions {
  size: "small" | "large";
  seed?: number;
  floors?: number;
}

interface SizeConfig {
  gridW: number;
  gridD: number;
  floors: number;
  roomsPerFloor: [number, number];
}

const SIZE_CONFIG: Record<"small" | "large", SizeConfig> = {
  small: { gridW: 6, gridD: 6, floors: 2, roomsPerFloor: [2, 6] },
  large: { gridW: 9, gridD: 9, floors: 3, roomsPerFloor: [7, 20] },
};

// ============================================================
//  НАПРАВЛЕНИЯ
// ============================================================

const DIRS = ["n", "s", "w", "e"] as const;
type Dir = typeof DIRS[number];

const DELTA: Record<Dir, { di: number; dj: number }> = {
  n: { di: 0, dj: -1 },
  s: { di: 0, dj: +1 },
  w: { di: -1, dj: 0 },
  e: { di: +1, dj: 0 },
};

function opposite(d: Dir): Dir {
  return d === "n" ? "s" : d === "s" ? "n" : d === "w" ? "e" : "w";
}

function cornerIdFor(a: Dir, b: Dir): string {
  const set = new Set([a, b]);
  if (set.has("n") && set.has("e")) return "corner_ne";
  if (set.has("n") && set.has("w")) return "corner_nw";
  if (set.has("s") && set.has("e")) return "corner_se";
  if (set.has("s") && set.has("w")) return "corner_sw";
  throw new Error(`Нет угла для направлений ${a} и ${b}`);
}

// ============================================================
//  ПЛАНИРОВАНИЕ
// ============================================================

interface PlannedRoom {
  cell: { i: number; j: number; floor: number };
  blueprint: RoomBlueprint;
  /**
   * Двери, которые blueprint реально должен нарисовать.
   * Формируется после walk: только те, за которыми есть сосед.
   */
  exitsOverride?: RoomExits;
}

export interface GridLevelData {
  seed: number;
  gridW: number;
  gridD: number;
  floors: number;
  cellSize: number;
  floorHeight: number;
  wallHeight: number;
  materials: RoomMaterials;
  rooms: RoomInstance[];
  start: RoomInstance;
  goal: RoomInstance;
  getAt(i: number, j: number, floor: number): RoomInstance | undefined;
}

// ============================================================
//  RNG
// ============================================================

function mulberry32(a: number): () => number {
  return () => {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ============================================================
//  ГЕНЕРАТОР
// ============================================================

export class GridLevelGenerator {
  static readonly CELL_SIZE = 18.9;
  static readonly FLOOR_HEIGHT = 6.0;
  static readonly WALL_HEIGHT = 4.5;

  build(scene: Scene, options: GenerationOptions): GridLevelData {
    const seed = options.seed ?? (Date.now() & 0xffffffff);
    const rng = mulberry32(seed);
    const cfg = SIZE_CONFIG[options.size];
    const floors = options.floors ?? cfg.floors;
    const { gridW, gridD } = cfg;

    const CELL_SIZE = GridLevelGenerator.CELL_SIZE;
    const FLOOR_HEIGHT = GridLevelGenerator.FLOOR_HEIGHT;
    const WALL_HEIGHT = GridLevelGenerator.WALL_HEIGHT;

    const gKey = (i: number, j: number) => `${i},${j}`;
    const pk = (i: number, j: number, f: number) => `${f},${i},${j}`;

    const globalOccupied = new Set<string>();
    const stairCells = new Set<string>();

    // ── ШАГ 1. Резерв бура ─────────────────────────────────────
    const drillAnchor = { i: gridW - 2, j: gridD - 2 };
    const drillCells: Array<{ i: number; j: number }> = [
      { i: drillAnchor.i,     j: drillAnchor.j     },
      { i: drillAnchor.i + 1, j: drillAnchor.j     },
      { i: drillAnchor.i,     j: drillAnchor.j + 1 },
      { i: drillAnchor.i + 1, j: drillAnchor.j + 1 },
    ];
    for (const c of drillCells) globalOccupied.add(gKey(c.i, c.j));

    const approachCell = { i: drillAnchor.i - 1, j: drillAnchor.j };
    globalOccupied.add(gKey(approachCell.i, approachCell.j));

    // ── ШАГ 2. Планирование ────────────────────────────────────
    const planned = new Map<string, PlannedRoom>();

    const startI = Math.floor(rng() * Math.max(2, Math.floor(gridW / 2)));
    const startJ = Math.floor(rng() * Math.max(2, Math.floor(gridD / 2)));
    globalOccupied.add(gKey(startI, startJ));

    let entryCell = { i: startI, j: startJ };
    let entryBp = findBlueprint("start")!;
    let entryDir: Dir | null = null;
    let entryExits: RoomExits | undefined = undefined;

    for (let floor = 0; floor < floors; floor++) {
      const isLastFloor = floor === floors - 1;

      // Регистрируем входную комнату этажа.
      planned.set(pk(entryCell.i, entryCell.j, floor), {
        cell: { i: entryCell.i, j: entryCell.j, floor },
        blueprint: entryBp,
        exitsOverride: entryExits,
      });

      const [rMin, rMax] = cfg.roomsPerFloor;
      const quota = rMin + Math.floor(rng() * (rMax - rMin + 1));

      const walkResult = this.walkFloor({
        startCell: entryCell,
        startBp: entryBp,
        startEntryDir: entryDir,
        floor,
        quota,
        rng,
        gridW, gridD,
        globalOccupied,
        planned,
        pk,
      });

      if (!isLastFloor) {
        // ── Лестница вверх ────────────────────────────────────
        const stair = this.placeStair(
          walkResult.lastCell,
          walkResult.lastBp,
          walkResult.lastArriveFrom,
          walkResult.lastExitDir,
          { gridW, gridD, globalOccupied, stairCells, planned, pk, floor }
        );
        if (!stair) {
          console.warn(
            `[GridLevelGenerator] не удалось поставить лестницу ` +
            `на этаже ${floor}, прерываю генерацию`
          );
          break;
        }
        entryCell = { i: stair.cell.i, j: stair.cell.j };

        const landingRaw = findBlueprint("stair_landing")!;
        const landingExits: RoomExits = {
          n: false, s: false, w: false, e: false,
          up: false, down: true,
        };
        landingExits[stair.T] = true;

        // ── ВАЖНО ──────────────────────────────────────────────
        // walkFloor читает currentBp.exits напрямую. Если передать
        // raw blueprint, walk пойдёт по static exits (у landing это
        // { n: true }), а не туда, где реально стоит дверь.
        // Поэтому отдаём копию с подменёнными exits.
        entryBp = { ...landingRaw, exits: landingExits };
        entryDir = null;
        entryExits = landingExits;
      } else {
        this.extendToApproach(
          walkResult.lastCell,
          walkResult.lastBp,
          approachCell,
          { gridW, gridD, globalOccupied, planned, pk, floor }
        );

        planned.set(pk(approachCell.i, approachCell.j, floor), {
          cell: { i: approachCell.i, j: approachCell.j, floor },
          blueprint: findBlueprint("dark_corridor_we")!,
        });

        planned.set(pk(drillAnchor.i, drillAnchor.j, floor), {
          cell: { i: drillAnchor.i, j: drillAnchor.j, floor },
          blueprint: findBlueprint("drill")!,
        });
      }
    }
    
    // ── ФИНАЛИЗАЦИЯ ДВЕРЕЙ ─────────────────────────────────────
    // У каждой комнаты выставляем exitsOverride, только если он ещё
    // не задан (лестницы его уже получили). Дверь оставляем ТОЛЬКО
    // если за ней стоит сосед с обратной дверью.
    for (const [, room] of planned) {
      if (room.exitsOverride) continue;    // уже настроен (stair/landing)

      const src = room.blueprint.exits;
      const ex: RoomExits = { ...NO_EXITS };

      for (const d of DIRS) {
        if (!src[d]) continue;
        const delta = DELTA[d];
        const ni = room.cell.i + delta.di;
        const nj = room.cell.j + delta.dj;
        const nb = planned.get(pk(ni, nj, room.cell.floor));
        if (!nb) continue;
        const nbSrc = nb.exitsOverride ?? nb.blueprint.exits;
        if (!nbSrc[opposite(d)]) continue;
        ex[d] = true;
      }

      // up/down сохраняем, если blueprint их объявил
      ex.up = src.up;
      ex.down = src.down;

      room.exitsOverride = ex;
    }

    // ── ШАГ 3. Постройка ───────────────────────────────────────
    const materials = createRoomMaterials(scene);
    const instances: RoomInstance[] = [];

    for (const [, r] of planned) {
      const floorY = r.cell.floor * FLOOR_HEIGHT;
      const fw = r.blueprint.footprint.w;
      const fh = r.blueprint.footprint.h;

      let centerX: number;
      let centerZ: number;
      let sizeX: number;
      let sizeZ: number;

      // Если blueprint задаёт sizeOverride — выравниваем по СЗ-углу
      // занятой grid-области (чтобы западная стена совпала с соседом).
      const override = (r.blueprint as unknown as {
        sizeOverride?: { x: number; z: number };
      }).sizeOverride;

      if (override) {
        const westEdge = (r.cell.i - gridW / 2) * CELL_SIZE;
        const northEdge = (r.cell.j - gridD / 2) * CELL_SIZE;
        sizeX = override.x;
        sizeZ = override.z;
        centerX = westEdge + sizeX / 2;
        centerZ = northEdge + sizeZ / 2;
      } else {
        const cellCenterX = (r.cell.i - gridW / 2 + 0.5) * CELL_SIZE;
        const cellCenterZ = (r.cell.j - gridD / 2 + 0.5) * CELL_SIZE;
        centerX = cellCenterX + (fw - 1) * CELL_SIZE / 2;
        centerZ = cellCenterZ + (fh - 1) * CELL_SIZE / 2;
        sizeX = fw * CELL_SIZE;
        sizeZ = fh * CELL_SIZE;
      }

      const doors: RoomExits = { ...(r.exitsOverride ?? r.blueprint.exits) };

      const ctx: RoomContext = {
        scene, rng,
        cell: r.cell,
        centerX, centerZ, floorY,
        sizeX, sizeZ,
        wallHeight: WALL_HEIGHT,
        ceilingY: floorY + WALL_HEIGHT,
        doors,
        materials,
      };

      const meshes = r.blueprint.build(ctx);

      instances.push({
        blueprint: r.blueprint,
        cell: r.cell,
        exits: doors,
        centerX, centerZ, sizeX, sizeZ, floorY,
        meshes,
        isStart: r.blueprint.id === "start",
        isGoal: r.blueprint.id === "drill",
      });
    }

    const start = instances.find((r) => r.isStart);
    const goal = instances.find((r) => r.isGoal);
    if (!start || !goal) throw new Error("Не найдены start/goal");

    const byCell = new Map<string, RoomInstance>();
    for (const r of instances) byCell.set(pk(r.cell.i, r.cell.j, r.cell.floor), r);

    return {
      seed, gridW, gridD, floors,
      cellSize: CELL_SIZE,
      floorHeight: FLOOR_HEIGHT,
      wallHeight: WALL_HEIGHT,
      materials,
      rooms: instances,
      start, goal,
      getAt: (i, j, floor) => byCell.get(pk(i, j, floor)),
    };
  }

  // ============================================================
  //  WALK
  // ============================================================

    /**
   * Обход сетки зигзагом.
   *
   * ФАЗА 1: планируем только КЛЕТКИ и НАПРАВЛЕНИЯ.
   * ФАЗА 2: по парам (вход, выход) подбираем blueprint'ы.
   *
   * Это гарантирует, что у каждой комнаты есть дверь ТОЧНО
   * в сторону следующей комнаты — тупиков не бывает.
   */
  private walkFloor(params: {
    startCell: { i: number; j: number };
    startBp: RoomBlueprint;
    startEntryDir: Dir | null;
    floor: number;
    quota: number;
    rng: () => number;
    gridW: number;
    gridD: number;
    globalOccupied: Set<string>;
    planned: Map<string, PlannedRoom>;
    pk: (i: number, j: number, f: number) => string;
  }): {
    lastCell: { i: number; j: number };
    lastBp: RoomBlueprint;
    lastExitDir: Dir | null;
    placed: number;
    lastArriveFrom: Dir | null;
  } {
    const {
      startCell, startBp, startEntryDir, floor, quota, rng,
      gridW, gridD, globalOccupied, planned, pk,
    } = params;

    const turnLeft = (d: Dir): Dir =>
      d === "n" ? "w" : d === "w" ? "s" : d === "s" ? "e" : "n";
    const turnRight = (d: Dir): Dir =>
      d === "n" ? "e" : d === "e" ? "s" : d === "s" ? "w" : "n";

    const inPath = new Set<string>();

    const isFreeCell = (i: number, j: number): boolean => {
      if (i < 0 || j < 0 || i >= gridW || j >= gridD) return false;
      const k = `${i},${j}`;
      if (globalOccupied.has(k)) return false;
      if (planned.has(pk(i, j, floor))) return false;
      if (inPath.has(k)) return false;
      return true;
    };

    // ── Стартовая клетка ─────────────────────────────────────
    const startDirs = DIRS.filter((d) => startBp.exits[d]);
    if (startDirs.length === 0) {
      return {
        lastCell: { ...startCell }, lastBp: startBp,
        lastExitDir: null, placed: 1, lastArriveFrom: null,
      };
    }

    let dir: Dir = startDirs[Math.floor(rng() * startDirs.length)];

    interface WalkCell {
      cell: { i: number; j: number };
      arriveFrom: Dir | null;
      exitTo: Dir | null;
    }

    const cells: WalkCell[] = [
      { cell: { ...startCell }, arriveFrom: null, exitTo: null },
    ];
    inPath.add(`${startCell.i},${startCell.j}`);

    const target = Math.max(1, quota);
    let turnParity = 0;
    let safety = 0;

    // ═════════════════════════════════════════════════════════
    //  ФАЗА 1: клетки
    // ═════════════════════════════════════════════════════════
    while (cells.length < target && safety++ < 200) {
      const straightLen = 1 + Math.floor(rng() * 3);
      let anyMoved = false;

      // ── Прямо K ───────────────────────────────────────────
      for (let s = 0; s < straightLen && cells.length < target; s++) {
        const last = cells[cells.length - 1];
        const ni = last.cell.i + DELTA[dir].di;
        const nj = last.cell.j + DELTA[dir].dj;
        if (!isFreeCell(ni, nj)) break;

        last.exitTo = dir;
        cells.push({ cell: { i: ni, j: nj }, arriveFrom: dir, exitTo: null });
        inPath.add(`${ni},${nj}`);
        anyMoved = true;
      }

      if (cells.length >= target) break;

      // ── Поворот ──────────────────────────────────────────
      const last = cells[cells.length - 1];
      const primary = turnParity === 0 ? turnLeft(dir) : turnRight(dir);
      const secondary = turnParity === 0 ? turnRight(dir) : turnLeft(dir);

      let newDir: Dir | null = null;
      const ti = last.cell.i + DELTA[primary].di;
      const tj = last.cell.j + DELTA[primary].dj;
      if (isFreeCell(ti, tj)) {
        newDir = primary;
      } else {
        const si = last.cell.i + DELTA[secondary].di;
        const sj = last.cell.j + DELTA[secondary].dj;
        if (isFreeCell(si, sj)) newDir = secondary;
      }

      if (newDir === null) {
        if (!anyMoved) break;
        turnParity = 1 - turnParity;
        continue;
      }

      dir = newDir;
      turnParity = 1 - turnParity;
    }

    // ── Backtrack: если у последней клетки нет свободного соседа ──
    while (cells.length > 1) {
      const last = cells[cells.length - 1];
      if (last.exitTo !== null) break;

      let hasFree = false;
      for (const d of DIRS) {
        if (last.arriveFrom !== null && d === opposite(last.arriveFrom)) continue;
        const ni = last.cell.i + DELTA[d].di;
        const nj = last.cell.j + DELTA[d].dj;
        if (isFreeCell(ni, nj)) { hasFree = true; break; }
      }
      if (hasFree) break;

      cells.pop();
      inPath.delete(`${last.cell.i},${last.cell.j}`);
    }

    // ═════════════════════════════════════════════════════════
    //  ФАЗА 2: blueprint'ы
    // ═════════════════════════════════════════════════════════

    const weightedPick = (list: RoomBlueprint[]): RoomBlueprint => {
      const total = list.reduce((s, b) => s + b.weight, 0);
      let r = rng() * total;
      let chosen: RoomBlueprint = list[0];
      for (const b of list) {
        r -= b.weight;
        if (r <= 0) { chosen = b; break; }
      }
      return chosen;
    };

    interface WalkStep {
      cell: { i: number; j: number };
      bp: RoomBlueprint;
      arriveFrom: Dir | null;
      exitTo: Dir | null;
    }

    const steps: WalkStep[] = [];

    for (let k = 0; k < cells.length; k++) {
      const c = cells[k];

      if (k === 0) {
        steps.push({ cell: c.cell, bp: startBp, arriveFrom: null, exitTo: c.exitTo });
        continue;
      }

      const arriveFrom: Dir = c.arriveFrom ?? "n";
      const entryDoor: Dir = opposite(arriveFrom);

      let exitDoor: Dir | null = c.exitTo;
      if (exitDoor === null) {
        const freeDirs: Dir[] = [];
        for (const d of DIRS) {
          if (d === entryDoor) continue;
          const ni = c.cell.i + DELTA[d].di;
          const nj = c.cell.j + DELTA[d].dj;
          if (isFreeCell(ni, nj)) freeDirs.push(d);
        }
        if (freeDirs.length > 0) {
          exitDoor = freeDirs[Math.floor(rng() * freeDirs.length)];
        }
      }

      let bp: RoomBlueprint | null = null;

      if (exitDoor !== null) {
        const wanted: Dir = exitDoor;
        const candidates = ALL_BLUEPRINTS.filter((b) => {
          if (b.weight <= 0) return false;
          if (b.footprint.w !== 1 || b.footprint.h !== 1) return false;
          if (!b.exits[entryDoor]) return false;
          if (!b.exits[wanted]) return false;
          for (const d of DIRS) {
            if (d === entryDoor || d === wanted) continue;
            if (b.exits[d]) return false;
          }
          return true;
        });
        if (candidates.length > 0) bp = weightedPick(candidates);
      }

      if (bp === null) {
        const fallback = ALL_BLUEPRINTS.filter((b) => {
          if (b.weight <= 0) return false;
          if (b.footprint.w !== 1 || b.footprint.h !== 1) return false;
          if (!b.exits[entryDoor]) return false;
          const doors = DIRS.reduce((n, d) => n + (b.exits[d] ? 1 : 0), 0);
          return doors === 2;
        });
        if (fallback.length > 0) {
          bp = weightedPick(fallback);
          const bpDoors = DIRS.filter((d) => bp !== null && bp.exits[d]);
          exitDoor = bpDoors.find((d) => d !== entryDoor) ?? null;
        }
      }

      if (bp === null) {
        console.warn(`[walkFloor] нет blueprint для entry=${entryDoor}, exit=${exitDoor}`);
        break;
      }

      steps.push({
        cell: c.cell,
        bp,
        arriveFrom: c.arriveFrom,
        exitTo: exitDoor,
      });
    }

    // ── Коммит в planned / globalOccupied (кроме старта) ─────
    for (let k = 1; k < steps.length; k++) {
      const s = steps[k];
      planned.set(pk(s.cell.i, s.cell.j, floor), {
        cell: { i: s.cell.i, j: s.cell.j, floor },
        blueprint: s.bp,
      });
      globalOccupied.add(`${s.cell.i},${s.cell.j}`);
    }

    const last = steps[steps.length - 1];
    if (!last) {
      return {
        lastCell: { ...startCell }, lastBp: startBp,
        lastExitDir: null, placed: 1, lastArriveFrom: null,
      };
    }

    return {
      lastCell: { i: last.cell.i, j: last.cell.j },
      lastBp: last.bp,
      lastExitDir: last.exitTo,
      placed: steps.length,
      lastArriveFrom: last.arriveFrom,
    };
  }

  // ============================================================
  //  ЛЕСТНИЦА
  // ============================================================

  /**
   * Ставит stair_up в соседнюю клетку.
   * Возвращает { cell, T }, где T — направление движения игрока
   * через лестницу. Landing на этаже выше получит exit по T.
   */
    /**
   * Ставит stair_up в свободного соседа последней комнаты walk'а.
   * Использует её lastExitDir — туда, где реально стоит открытая дверь.
   */
  private placeStair(
    fromCell: { i: number; j: number },
    fromBp: RoomBlueprint,
    fromArriveFrom: Dir | null,
    fromExitDir: Dir | null,
    ctx: {
      gridW: number; gridD: number;
      globalOccupied: Set<string>;
      stairCells: Set<string>;
      planned: Map<string, PlannedRoom>;
      pk: (i: number, j: number, f: number) => string;
      floor: number;
    }
  ): { cell: { i: number; j: number }; T: Dir } | null {
    const tryDirs: Dir[] = [];
    if (fromExitDir) tryDirs.push(fromExitDir);
    for (const d of DIRS) {
      if (tryDirs.includes(d)) continue;
      if (fromArriveFrom !== null && d === opposite(fromArriveFrom)) continue;
      if (!fromBp.exits[d]) continue;
      tryDirs.push(d);
    }

    for (const d of tryDirs) {
      const delta = DELTA[d];
      const ni = fromCell.i + delta.di;
      const nj = fromCell.j + delta.dj;
      if (ni < 0 || nj < 0 || ni >= ctx.gridW || nj >= ctx.gridD) continue;
      if (ctx.globalOccupied.has(`${ni},${nj}`)) continue;
      if (ctx.planned.has(ctx.pk(ni, nj, ctx.floor))) continue;

      const T = d;
      const stairExits: RoomExits = {
        n: false, s: false, w: false, e: false,
        up: true, down: false,
      };
      stairExits[opposite(T)] = true;

      ctx.planned.set(ctx.pk(ni, nj, ctx.floor), {
        cell: { i: ni, j: nj, floor: ctx.floor },
        blueprint: findBlueprint("stair_up")!,
        exitsOverride: stairExits,
      });
      ctx.stairCells.add(`${ni},${nj}`);
      return { cell: { i: ni, j: nj }, T };
    }

    return null;
  }

    /**
   * Ищет путь от fromCell до approach через BFS.
   * BFS обходит только свободные клетки (не занятые globalOccupied
   * и не запланированные). Approach-клетка разрешена, хотя она
   * помечена в globalOccupied — она наша цель.
   */
    /**
   * Ищет путь от fromCell до approach через BFS.
   * BFS обходит только свободные клетки (не занятые globalOccupied
   * и не запланированные). Approach-клетка разрешена — она наша цель.
   */
  private extendToApproach(
    fromCell: { i: number; j: number },
    fromBp: RoomBlueprint,
    approach: { i: number; j: number },
    ctx: {
      gridW: number; gridD: number;
      globalOccupied: Set<string>;
      planned: Map<string, PlannedRoom>;
      pk: (i: number, j: number, f: number) => string;
      floor: number;
    }
  ): boolean {
    const isFree = (i: number, j: number): boolean => {
      if (i < 0 || j < 0 || i >= ctx.gridW || j >= ctx.gridD) return false;
      if (i === approach.i && j === approach.j) return true;
      if (ctx.globalOccupied.has(`${i},${j}`)) return false;
      if (ctx.planned.has(ctx.pk(i, j, ctx.floor))) return false;
      return true;
    };

    interface BfsEntry {
      i: number;
      j: number;
      cameFrom: string | null;
      arriveDir: Dir;
    }

    const visited = new Map<string, BfsEntry>();
    const queue: string[] = [];

    // ── Стартовые клетки: соседи fromCell по его выходам ────
    for (const d of DIRS) {
      if (!fromBp.exits[d]) continue;
      const ni = fromCell.i + DELTA[d].di;
      const nj = fromCell.j + DELTA[d].dj;
      if (!isFree(ni, nj)) continue;
      const key = `${ni},${nj}`;
      if (visited.has(key)) continue;
      visited.set(key, { i: ni, j: nj, cameFrom: null, arriveDir: d });
      queue.push(key);
    }

    if (queue.length === 0) {
      console.warn("[GridLevelGenerator] нет стартовой клетки для BFS");
      return false;
    }

    // ── BFS ─────────────────────────────────────────────────
    let endKey: string | null = null;

    while (queue.length > 0) {
      const curKey = queue.shift();
      if (curKey === undefined) break;
      const entry = visited.get(curKey);
      if (!entry) continue;

      if (entry.i === approach.i && entry.j === approach.j) {
        endKey = curKey;
        break;
      }

      for (const d of DIRS) {
        if (d === opposite(entry.arriveDir)) continue;

        const ni = entry.i + DELTA[d].di;
        const nj = entry.j + DELTA[d].dj;
        if (!isFree(ni, nj)) continue;

        const nk = `${ni},${nj}`;
        if (visited.has(nk)) continue;

        visited.set(nk, { i: ni, j: nj, cameFrom: curKey, arriveDir: d });
        queue.push(nk);
      }
    }

    if (endKey === null) {
      console.warn(
        `[GridLevelGenerator] BFS не нашёл путь от (${fromCell.i},${fromCell.j}) ` +
        `до approach (${approach.i},${approach.j})`
      );
      return false;
    }

    // ── Восстанавливаем путь ────────────────────────────────
    const path: Array<{ i: number; j: number; arriveDir: Dir }> = [];
    let walkKey: string | null = endKey;
    while (walkKey !== null) {
      const entry = visited.get(walkKey);
      if (!entry) break;
      path.unshift({ i: entry.i, j: entry.j, arriveDir: entry.arriveDir });
      walkKey = entry.cameFrom;
    }

    // ── Кладём blueprint'ы ─────────────────────────────────
    for (let idx = 0; idx < path.length; idx++) {
      const step = path[idx];
      const entryDir = opposite(step.arriveDir);

      const nextArriveDir = idx + 1 < path.length
        ? path[idx + 1].arriveDir
        : ("e" as Dir);  // последняя клетка = approach, выходим в бур на восток

      let bp: RoomBlueprint;
      const isWE =
        (entryDir === "w" && nextArriveDir === "e") ||
        (entryDir === "e" && nextArriveDir === "w");
      const isNS =
        (entryDir === "n" && nextArriveDir === "s") ||
        (entryDir === "s" && nextArriveDir === "n");

      if (isWE) {
        bp = findBlueprint("dark_corridor_we")!;
      } else if (isNS) {
        bp = findBlueprint("dark_corridor_ns")!;
      } else {
        bp = findBlueprint(cornerIdFor(entryDir, nextArriveDir))!;
      }

      // Approach-клетку ставит build() отдельно, не перезаписываем.
      if (step.i === approach.i && step.j === approach.j) continue;

      ctx.planned.set(ctx.pk(step.i, step.j, ctx.floor), {
        cell: { i: step.i, j: step.j, floor: ctx.floor },
        blueprint: bp,
      });
      ctx.globalOccupied.add(`${step.i},${step.j}`);
    }

    return true;
  }
}