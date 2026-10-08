/**
 * Реестр текстур.
 *
 * КАК ДОБАВИТЬ НОВУЮ:
 *   1. Положи файл в public/textures/, например brick_red.jpg
 *   2. Добавь строку в TEXTURES:
 *        { id: "brick_red", path: "/textures/brick_red.jpg", uScale: 6, vScale: 2,
 *          fallbackColor: [0.6, 0.3, 0.2] }
 *   3. Используй в редакторе и blueprint'ах.
 *
 * uScale/vScale — сколько раз текстура повторяется по X и Y.
 *   Для пола 18×18 м: uScale = 6 → плитка повторяется 6 раз (по 3 м).
 *   Для стены 18×4.5 м: uScale = 6, vScale = 1.5.
 */

export interface TextureDef {
  id: string;
  path: string;
  uScale: number;
  vScale: number;
  /** Базовый цвет, если файл не загрузится. RGB 0..1. */
  fallbackColor: [number, number, number];
  /** Прозрачность 0..1 (для воды). */
  alpha?: number;
}

export const TEXTURES: TextureDef[] = [
  // ── Полы ────────────────────────────────────────────────
  {
    id: "sand",
    path: "/textures/sand.jpg",
    uScale: 6, vScale: 6,
    fallbackColor: [0.85, 0.70, 0.45],
  },

  // ── Стены ───────────────────────────────────────────────
  {
    id: "stone",
    path: "/textures/stone.jpg",
    uScale: 6, vScale: 2,
    fallbackColor: [0.55, 0.46, 0.33],
  },
  {
    id: "darkStone",
    path: "/textures/stone_dark.jpg",
    uScale: 6, vScale: 2,
    fallbackColor: [0.28, 0.22, 0.16],
  },

  // ── Металл ──────────────────────────────────────────────
  {
    id: "metal",
    path: "/textures/metal.jpg",
    uScale: 2, vScale: 2,
    fallbackColor: [0.50, 0.52, 0.55],
  },

  // ── Дерево ──────────────────────────────────────────────
  {
    id: "wood",
    path: "/textures/wood.jpg",
    uScale: 1, vScale: 1,
    fallbackColor: [0.36, 0.24, 0.14],
  },

  // ── Вода ────────────────────────────────────────────────
  {
    id: "water",
    path: "/textures/water.jpg",
    uScale: 4, vScale: 4,
    fallbackColor: [0.15, 0.40, 0.65],
    alpha: 0.65,
  },
];

/** Найти текстуру по id. */
export function getTexture(id: string): TextureDef | undefined {
  return TEXTURES.find((t) => t.id === id);
}