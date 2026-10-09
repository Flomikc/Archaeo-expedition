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
  /** МИНИМАЛЬНЫЙ размер сетки. Если уровень шире — сетка подрастёт сама. */
  minGridW: number;
  minGridD: number;
  floors: number;
  /** Максимум прямых комнат между поворотами (0..straightMax). */
  straightMax: number;
}

const SIZE_CONFIG: Record<"small" | "large", SizeConfig> = {
  small: { minGridW: 12, minGridD: 12, floors: 2, straightMax: 2 },
  large: { minGridW: 16, minGridD: 16, floors: 3, straightMax: 2 },
};

/**
 * Правила прямых проходов (количество прямых комнат между «событиями»).
 * Меняются здесь, остальной код трогать не нужно.
 */
const GAP_AFTER_START_MIN = 0;     // старт → первый угол: 0..straightMax
const GAP_AFTER_LANDING_MIN = 1;   // лестничная площадка → первый угол: 1..straightMax
const GAP_BETWEEN_TURNS_MIN = 0;   // между углами паттерна: 0..straightMax
const GAP_BEFORE_STAIR = 0;        // последний угол → лестница: ровно 0
const GAP_BEFORE_DRILL = 1;        // последний угол → бур: ровно 1

// ============================================================
//  НАПРАВЛЕНИЯ
// ============================================================

const DIRS = ["n", "s", "w", "e"] as const;
export type Dir = typeof DIRS[number];

const DELTA: Record<Dir, { di: number; dj: number }> = {
  n: { di: 0, dj: -1 },
  s: { di: 0, dj: +1 },
  w: { di: -1, dj: 0 },
  e: { di: +1, dj: 0 },
};

function opposite(d: Dir): Dir {
  return d === "n" ? "s" : d === "s" ? "n" : d === "w" ? "e" : "w";
}

function turnLeft(d: Dir): Dir {
  return d === "n" ? "w" : d === "w" ? "s" : d === "s" ? "e" : "n";
}

function turnRight(d: Dir): Dir {
  return d === "n" ? "e" : d === "e" ? "s" : d === "s" ? "w" : "n";
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

function randInt(rng: () => number, lo: number, hi: number): number {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

// ============================================================
//  ПЛАН ПУТИ (чистая логика, без Babylon)
// ============================================================
//
//  Весь уровень — ОДНА цепочка клеток. Игрок всё время движется
//  в одном и том же направлении `heading`, потому что каждый
//  паттерн R L L R / L R R L возвращает курс в исходный.
//
//  Этаж 0:   START → [0..2 прямых] → R → [0..2] → L → [0..2] → L → [0..2] → R → STAIR
//  Этаж 1:   LANDING → [1..2 прямых] → паттерн → ...
//  Последний: ... → последний поворот → 1 прямая → DRILL
//
//  Путь монотонен вдоль heading (никогда не идёт назад), поэтому
//  самопересечений на этаже быть не может по построению.
//  validatePlan() всё равно это проверяет.

export type CellKind =
  | "start"
  | "straight"
  | "corner"
  | "stair"
  | "landing"
  | "drill";

export interface PathCell {
  kind: CellKind;
  floor: number;
  /** Для drill — якорь (северо-западная клетка footprint). */
  i: number;
  j: number;
  /** Направление движения при входе в клетку (null для start/landing). */
  inDir: Dir | null;
  /** Направление движения при выходе (null для stair/drill). */
  outDir: Dir | null;
}

export interface LevelPlan {
  heading: Dir;
  gridW: number;
  gridD: number;
  cells: PathCell[];
}

interface DrillShape {
  exits: RoomExits;
  footprint: { w: number; h: number };
}

function footprintOf(c: PathCell, fw: number, fh: number): Array<{ i: number; j: number }> {
  if (c.kind !== "drill") return [{ i: c.i, j: c.j }];
  const out: Array<{ i: number; j: number }> = [];
  for (let dj = 0; dj < fh; dj++) {
    for (let di = 0; di < fw; di++) out.push({ i: c.i + di, j: c.j + dj });
  }
  return out;
}

export function planLevel(
  rng: () => number,
  floors: number,
  cfg: SizeConfig,
  drill: DrillShape
): LevelPlan {
  const fw = drill.footprint.w;
  const fh = drill.footprint.h;

  // ── Курс выбираем так, чтобы бур можно было войти через его дверь.
  //    Если у бура дверь только на запад — курс будет «e» всегда.
  const compatible = DIRS.filter((d) => drill.exits[opposite(d)]);
  const headings: readonly Dir[] = compatible.length > 0 ? compatible : DIRS;
  const heading0: Dir = headings[Math.floor(rng() * headings.length)];

  // ── Строим цепочку в локальных координатах (старт = 0,0) ───
  const cells: PathCell[] = [];
  let heading: Dir = heading0;
  let ci = 0; // позиция СЛЕДУЮЩЕЙ клетки
  let cj = 0;

  const place = (kind: CellKind, floor: number, out: Dir | null): void => {
    const inDir = kind === "start" || kind === "landing" ? null : heading;
    cells.push({ kind, floor, i: ci, j: cj, inDir, outDir: out });
    if (out !== null) {
      heading = out;
      ci += DELTA[out].di;
      cj += DELTA[out].dj;
    }
  };

  for (let floor = 0; floor < floors; floor++) {
    const isLast = floor === floors - 1;

    // Вход этажа. Landing стоит в той же клетке, что и stair этажом ниже
    // (place("stair") позицию не двигает).
    if (floor === 0) place("start", floor, heading);
    else place("landing", floor, heading);

    const entryGapMin = floor === 0 ? GAP_AFTER_START_MIN : GAP_AFTER_LANDING_MIN;
    const turns: Array<"L" | "R"> =
      rng() < 0.5 ? ["L", "R", "R", "L"] : ["R", "L", "L", "R"];

    for (let t = 0; t < turns.length; t++) {
      const gapMin = t === 0 ? entryGapMin : GAP_BETWEEN_TURNS_MIN;
      const gap = randInt(rng, gapMin, cfg.straightMax);
      for (let g = 0; g < gap; g++) place("straight", floor, heading);

      const newDir = turns[t] === "L" ? turnLeft(heading) : turnRight(heading);
      place("corner", floor, newDir);
    }

    if (!isLast) {
      for (let g = 0; g < GAP_BEFORE_STAIR; g++) place("straight", floor, heading);
      place("stair", floor, null);
    } else {
      for (let g = 0; g < GAP_BEFORE_DRILL; g++) place("straight", floor, heading);
      // ci,cj — клетка, в которую входим в бур. Footprint растёт «вперёд»
      // по курсу, поэтому для w и n якорь сдвигается.
      cells.push({
        kind: "drill",
        floor,
        i: heading === "w" ? ci - fw + 1 : ci,
        j: heading === "n" ? cj - fh + 1 : cj,
        inDir: heading,
        outDir: null,
      });
    }
  }

  // ── Габариты и центрирование в сетке ───────────────────────
  let minI = Infinity, maxI = -Infinity, minJ = Infinity, maxJ = -Infinity;
  for (const c of cells) {
    for (const p of footprintOf(c, fw, fh)) {
      if (p.i < minI) minI = p.i;
      if (p.i > maxI) maxI = p.i;
      if (p.j < minJ) minJ = p.j;
      if (p.j > maxJ) maxJ = p.j;
    }
  }
  const spanI = maxI - minI + 1;
  const spanJ = maxJ - minJ + 1;

  // +2 — по клетке запаса с каждой стороны.
  const gridW = Math.max(cfg.minGridW, spanI + 2);
  const gridD = Math.max(cfg.minGridD, spanJ + 2);

  const offI = Math.floor((gridW - spanI) / 2) - minI;
  const offJ = Math.floor((gridD - spanJ) / 2) - minJ;
  for (const c of cells) {
    c.i += offI;
    c.j += offJ;
  }

  const plan: LevelPlan = { heading: heading0, gridW, gridD, cells };
  validatePlan(plan, floors, cfg.straightMax, fw, fh);
  return plan;
}

/**
 * Страховка: если в плане что-то нарушает правила — падаем сразу
 * с понятным сообщением, а не рисуем сломанный уровень.
 */
function validatePlan(
  plan: LevelPlan,
  floors: number,
  straightMax: number,
  fw: number,
  fh: number
): void {
  const fail = (msg: string): never => {
    throw new Error(`[GridLevelGenerator] невалидный план: ${msg}`);
  };
  const { cells, gridW, gridD, heading } = plan;

  // 1. Границы и отсутствие наложений в пределах этажа.
  const occupied = new Set<string>();
  for (const c of cells) {
    for (const p of footprintOf(c, fw, fh)) {
      if (p.i < 0 || p.j < 0 || p.i >= gridW || p.j >= gridD) {
        fail(`клетка (${p.i},${p.j}) вне сетки ${gridW}x${gridD}`);
      }
      const key = `${c.floor},${p.i},${p.j}`;
      if (occupied.has(key)) fail(`клетка ${key} занята дважды`);
      occupied.add(key);
    }
  }

  // 2. Соседние клетки цепочки реально стыкуются.
  for (let k = 0; k < cells.length - 1; k++) {
    const a = cells[k];
    const b = cells[k + 1];
    if (a.kind === "stair") {
      if (b.kind !== "landing" || b.floor !== a.floor + 1 || b.i !== a.i || b.j !== a.j) {
        fail(`после stair (${a.i},${a.j}) нет landing в той же клетке`);
      }
      continue;
    }
    if (a.outDir === null) fail(`клетка ${k} (${a.kind}) без выхода, но не последняя`);
    const out = a.outDir as Dir;
    const ei = a.i + DELTA[out].di;
    const ej = a.j + DELTA[out].dj;
    const touches = footprintOf(b, fw, fh).some((p) => p.i === ei && p.j === ej);
    if (!touches || b.floor !== a.floor || b.inDir !== out) {
      fail(`разрыв цепочки между клетками ${k} и ${k + 1}`);
    }
  }

  // 3. Паттерн поворотов на каждом этаже.
  for (let f = 0; f < floors; f++) {
    const seq = cells
      .filter((c) => c.floor === f && c.kind === "corner")
      .map((c) => (turnLeft(c.inDir as Dir) === c.outDir ? "L" : "R"))
      .join("");
    if (seq !== "LRRL" && seq !== "RLLR") fail(`этаж ${f}: паттерн "${seq}"`);
  }

  // 4. Длины прямых и курс на выходе паттернов.
  let run = 0;
  for (let k = 0; k < cells.length; k++) {
    const c = cells[k];
    if (c.kind === "straight") { run++; continue; }
    const prev = k > 0 ? cells[k - 1] : null;

    if (c.kind === "corner") {
      if (run > straightMax) fail(`${run} прямых подряд перед углом (макс ${straightMax})`);
      if (prev?.kind === "landing" && run < GAP_AFTER_LANDING_MIN) {
        fail(`после лестницы меньше ${GAP_AFTER_LANDING_MIN} прямых`);
      }
    } else if (c.kind === "stair") {
      if (run !== GAP_BEFORE_STAIR) fail(`перед лестницей ${run} прямых`);
      if (c.inDir !== heading) fail("курс на лестнице не совпал со стартовым");
    } else if (c.kind === "drill") {
      if (run !== GAP_BEFORE_DRILL) fail(`перед буром ${run} прямых`);
      if (c.inDir !== heading) fail("курс на буре не совпал со стартовым");
    }
    run = 0;
  }
}

// ============================================================
//  ПОДБОР BLUEPRINT'ОВ
// ============================================================

const SPECIAL_IDS = new Set(["start", "drill", "stair_up", "stair_landing"]);

function weightedPick(rng: () => number, list: RoomBlueprint[]): RoomBlueprint {
  const total = list.reduce((s, b) => s + b.weight, 0);
  let r = rng() * total;
  for (const b of list) {
    r -= b.weight;
    if (r <= 0) return b;
  }
  return list[list.length - 1];
}

/**
 * Комната-проход строго с ДВУМЯ дверьми: entry и exit. Никаких «похожих» —
 * иначе дверь уедет не туда и уровень получит тупики.
 */
function pickPassageBlueprint(rng: () => number, entry: Dir, exit: Dir): RoomBlueprint {
  const strict = ALL_BLUEPRINTS.filter(
    (b) =>
      b.weight > 0 &&
      !SPECIAL_IDS.has(b.id) &&
      b.footprint.w === 1 &&
      b.footprint.h === 1 &&
      !b.exits.up &&
      !b.exits.down &&
      DIRS.every((d) => b.exits[d] === (d === entry || d === exit))
  );
  if (strict.length > 0) return weightedPick(rng, strict);

  // Запасной вариант — базовые коридоры и углы.
  const id =
    entry === opposite(exit)
      ? exit === "e" || exit === "w"
        ? "dark_corridor_we"
        : "dark_corridor_ns"
      : cornerIdFor(entry, exit);
  const bp = findBlueprint(id);
  if (!bp) throw new Error(`[GridLevelGenerator] нет blueprint "${id}" (двери ${entry}→${exit})`);
  return bp;
}

function requireBlueprint(id: string): RoomBlueprint {
  const bp = findBlueprint(id);
  if (!bp) throw new Error(`[GridLevelGenerator] blueprint "${id}" не найден`);
  return bp;
}

// ============================================================
//  ДАННЫЕ УРОВНЯ
// ============================================================

interface PlannedRoom {
  cell: { i: number; j: number; floor: number };
  blueprint: RoomBlueprint;
  exits: RoomExits;
  /** Направление входа (из плана). Нужно для позиционирования sizeOverride-комнат. */
  inDir: Dir | null;
  /** Направление выхода (из плана). */
  outDir: Dir | null;
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
    const floors = Math.max(1, options.floors ?? cfg.floors);

    const CELL_SIZE = GridLevelGenerator.CELL_SIZE;
    const FLOOR_HEIGHT = GridLevelGenerator.FLOOR_HEIGHT;
    const WALL_HEIGHT = GridLevelGenerator.WALL_HEIGHT;

    const pk = (i: number, j: number, f: number) => `${f},${i},${j}`;

    // ── ШАГ 1. План пути ───────────────────────────────────────
    const startBp = requireBlueprint("start");
    const stairBp = requireBlueprint("stair_up");
    const landingBp = requireBlueprint("stair_landing");
    const drillBp = requireBlueprint("drill");

    const plan = planLevel(rng, floors, cfg, drillBp);
    const { gridW, gridD } = plan;

    // ── ШАГ 2. Клетки плана → комнаты с точными дверями ────────
    const planned: PlannedRoom[] = plan.cells.map((c) => {
      const exits: RoomExits = { ...NO_EXITS };
      if (c.inDir !== null) exits[opposite(c.inDir)] = true;
      if (c.outDir !== null) exits[c.outDir] = true;

      let blueprint: RoomBlueprint;
      switch (c.kind) {
        case "start":
          blueprint = startBp;
          break;
        case "stair":
          exits.up = true;
          blueprint = stairBp;
          break;
        case "landing":
          exits.down = true;
          blueprint = landingBp;
          break;
        case "drill":
          blueprint = drillBp;
          break;
        default:
          blueprint = pickPassageBlueprint(
            rng,
            opposite(c.inDir as Dir),
            c.outDir as Dir
          );
      }

      return {
        cell: { i: c.i, j: c.j, floor: c.floor },
        blueprint,
        exits,
        inDir: c.inDir,
        outDir: c.outDir,
      };
    });

    // ── ШАГ 3. Постройка ───────────────────────────────────────
    const materials = createRoomMaterials(scene);
    const instances: RoomInstance[] = [];

    const STUB_GAP = 0.9;

    for (const r of planned) {
      const floorY = r.cell.floor * FLOOR_HEIGHT;
      const fw = r.blueprint.footprint.w;
      const fh = r.blueprint.footprint.h;

      let centerX: number;
      let centerZ: number;
      let sizeX: number;
      let sizeZ: number;

      const override = (r.blueprint as unknown as {
        sizeOverride?: { x: number; z: number };
      }).sizeOverride;

      if (override && r.inDir !== null) {
        // ── Кастомный размер: привязываемся к соседу approach ──
        // Так дверь sizeOverride-комнаты точно совпадёт с дверью соседа.
        const neighborCell = {
          i: r.cell.i - DELTA[r.inDir].di,
          j: r.cell.j - DELTA[r.inDir].dj,
          floor: r.cell.floor,
        };
        const neighbor = instances.find(
          (inst) =>
            inst.cell.i === neighborCell.i &&
            inst.cell.j === neighborCell.j &&
            inst.cell.floor === neighborCell.floor
        );

        sizeX = override.x;
        sizeZ = override.z;

        if (neighbor) {
          const nOffX = (neighbor.sizeX - STUB_GAP) / 2;
          const nOffZ = (neighbor.sizeZ - STUB_GAP) / 2;
          const myOffX = (sizeX - STUB_GAP) / 2;
          const myOffZ = (sizeZ - STUB_GAP) / 2;

          switch (r.inDir) {
            case "e":  // входим с запада
              centerX = neighbor.centerX + nOffX + STUB_GAP + myOffX;
              centerZ = neighbor.centerZ;
              break;
            case "w":  // входим с востока
              centerX = neighbor.centerX - nOffX - STUB_GAP - myOffX;
              centerZ = neighbor.centerZ;
              break;
            case "s":  // входим с севера
              centerZ = neighbor.centerZ + nOffZ + STUB_GAP + myOffZ;
              centerX = neighbor.centerX;
              break;
            case "n":  // входим с юга
              centerZ = neighbor.centerZ - nOffZ - STUB_GAP - myOffZ;
              centerX = neighbor.centerX;
              break;
          }
        } else {
          // Fallback: старое поведение (выравнивание по СЗ-углу якоря).
          const westEdge = (r.cell.i - gridW / 2) * CELL_SIZE;
          const northEdge = (r.cell.j - gridD / 2) * CELL_SIZE;
          centerX = westEdge + sizeX / 2;
          centerZ = northEdge + sizeZ / 2;
        }
      } else if (override) {
        // sizeOverride без inDir — тоже fallback.
        const westEdge = (r.cell.i - gridW / 2) * CELL_SIZE;
        const northEdge = (r.cell.j - gridD / 2) * CELL_SIZE;
        sizeX = override.x;
        sizeZ = override.z;
        centerX = westEdge + sizeX / 2;
        centerZ = northEdge + sizeZ / 2;
      } else {
        // Обычная комната 1×1.
        const cellCenterX = (r.cell.i - gridW / 2 + 0.5) * CELL_SIZE;
        const cellCenterZ = (r.cell.j - gridD / 2 + 0.5) * CELL_SIZE;
        centerX = cellCenterX + ((fw - 1) * CELL_SIZE) / 2;
        centerZ = cellCenterZ + ((fh - 1) * CELL_SIZE) / 2;
        sizeX = fw * CELL_SIZE;
        sizeZ = fh * CELL_SIZE;
      }

      const doors: RoomExits = { ...r.exits };

      const ctx: RoomContext = {
        scene,
        rng,
        cell: r.cell,
        centerX,
        centerZ,
        floorY,
        sizeX,
        sizeZ,
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
        centerX,
        centerZ,
        sizeX,
        sizeZ,
        floorY,
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
      seed,
      gridW,
      gridD,
      floors,
      cellSize: CELL_SIZE,
      floorHeight: FLOOR_HEIGHT,
      wallHeight: WALL_HEIGHT,
      materials,
      rooms: instances,
      start,
      goal,
      getAt: (i, j, floor) => byCell.get(pk(i, j, floor)),
    };
  }
}