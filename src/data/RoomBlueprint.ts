import type {
  AbstractMesh,
  Scene,
  StandardMaterial,
} from "@babylonjs/core";

// ============================================================
// ВЫХОДЫ КОМНАТЫ
// ============================================================
// Какие двери есть у комнаты. Генератор использует это,
// чтобы понять, куда можно идти дальше.

export interface RoomExits {
  n: boolean;    // север (-Z)
  s: boolean;    // юг (+Z)
  w: boolean;    // запад (-X)
  e: boolean;    // восток (+X)
  up: boolean;   // дыра в потолке (лестница вверх)
  down: boolean; // дыра в полу (вид на лестницу снизу)
}

export const NO_EXITS: RoomExits = {
  n: false, s: false, w: false, e: false, up: false, down: false,
};

// ============================================================
// КАТЕГОРИИ (для UI и группировки)
// ============================================================

export type RoomCategory =
  | "start"       // стартовая
  | "corridor"    // коридор / проход
  | "corner"      // поворот
  | "hall"        // зал с колоннами
  | "special"     // с артефактом / ручьём
  | "trap"        // с ловушками / ямой
  | "stair"       // лестница между этажами
  | "drill";      // финальная (бур)

// ============================================================
// КОНТЕКСТ — что blueprint знает о мире в момент сборки
// ============================================================
//
// Все координаты МИРОВЫЕ. Но хелперы из room-kit принимают
// ОТНОСИТЕЛЬНЫЕ dx/dz от центра — так удобнее тебе писать.

export interface RoomContext {
  scene: Scene;
  rng: () => number;               // детерминированный random от seed

  // Позиция на сетке
  cell: { i: number; j: number; floor: number };

  // Мировая геометрия комнаты
  centerX: number;                 // центр по X
  centerZ: number;                 // центр по Z
  floorY: number;                  // Y пола
  sizeX: number;                   // габарит по X (обычно 14)
  sizeZ: number;                   // габарит по Z (обычно 14)
  wallHeight: number;              // высота стен/потолка (обычно 4.5)
  ceilingY: number;                // floorY + wallHeight

  // Итоговые двери (генератор их уже вычислил)
  doors: RoomExits;

  // Общие материалы уровня
  materials: RoomMaterials;
}

export interface RoomMaterials {
  stone: StandardMaterial;
  darkStone: StandardMaterial;
  sand: StandardMaterial;
  metal: StandardMaterial;
  wood: StandardMaterial;
  water: StandardMaterial;
}

// ============================================================
// BLUEPRINT — «класс» комнаты
// ============================================================

export interface RoomBlueprint {
  /** Уникальный ID, например "corner_ne" */
  id: string;

  /** Группа для UI */
  category: RoomCategory;

  /** Отображаемое имя */
  label: string;

  /** ОБЯЗАТЕЛЬНЫЕ двери (сигнатура) */
  exits: RoomExits;

  /** Вес для случайного выбора среди подходящих */
  weight: number;

  /**
   * Сколько клеток занимает по (X, Z).
   * 1x1 — обычные. 2x2 — только drill.
   */
  footprint: { w: number; h: number };

  /**
   * Собрать комнату. Все координаты — в ctx (мировые).
   * Возвращает все меши, чтобы их можно было удалить одной операцией.
   */
  build(ctx: RoomContext): AbstractMesh[];
}

// ============================================================
// ЭКЗЕМПЛЯР — конкретная комната на конкретной клетке
// ============================================================

export interface RoomInstance {
  blueprint: RoomBlueprint;
  cell: { i: number; j: number; floor: number };
  exits: RoomExits;                // итог (может отличаться от blueprint.exits,
                                   // если часть выходов ведёт в занятые клетки)
  centerX: number;
  centerZ: number;
  sizeX: number;
  sizeZ: number;
  floorY: number;
  meshes: AbstractMesh[];
  isStart: boolean;
  isGoal: boolean;
}