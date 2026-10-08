import { RoomBlueprint } from "../RoomBlueprint";

import { START_ROOM } from "./start";
import { CORNER_NE, CORNER_NW, CORNER_SE, CORNER_SW } from "./corners";
import {
  CORNER_STREAM_NE, CORNER_STREAM_NW,
  CORNER_STREAM_SE, CORNER_STREAM_SW,
} from "./corner-stream";
import {
  CORNER_ARTIFACT_NE, CORNER_ARTIFACT_NW,
  CORNER_ARTIFACT_SE, CORNER_ARTIFACT_SW,
} from "./corner-artifact";
import {
  CORNER_PIT_NE, CORNER_PIT_NW,
  CORNER_PIT_SE, CORNER_PIT_SW,
} from "./corner-pit";
import { DARK_CORRIDOR_NS, DARK_CORRIDOR_WE } from "./dark-corridor";
import { PILLAR_HALL_NS, PILLAR_HALL_WE } from "./pillar-hall";
import { PIT_CORRIDOR_NS, PIT_CORRIDOR_WE } from "./pit-corridor";
import { STAIR_UP, STAIR_LANDING } from "./stair";
import { DRILL_ROOM } from "./drill";

/**
 * ВСЕ доступные blueprint'ы уровня.
 *
 * Генератор фильтрует этот список по совместимости
 * (нужна дверь на конкретной стороне) и взвешенно рандомит.
 */
export const ALL_BLUEPRINTS: RoomBlueprint[] = [
  // Специальные (не в рандом, ставятся вручную)
  START_ROOM,
  STAIR_UP,
  STAIR_LANDING,
  DRILL_ROOM,

  // Повороты (4 чистых + 4 ручей + 4 артефакт + 4 яма = 16)
  CORNER_NE, CORNER_NW, CORNER_SE, CORNER_SW,
  CORNER_STREAM_NE, CORNER_STREAM_NW, CORNER_STREAM_SE, CORNER_STREAM_SW,
  CORNER_ARTIFACT_NE, CORNER_ARTIFACT_NW, CORNER_ARTIFACT_SE, CORNER_ARTIFACT_SW,
  CORNER_PIT_NE, CORNER_PIT_NW, CORNER_PIT_SE, CORNER_PIT_SW,

  // Коридоры и залы
  DARK_CORRIDOR_NS, DARK_CORRIDOR_WE,
  PILLAR_HALL_NS, PILLAR_HALL_WE,
  PIT_CORRIDOR_NS, PIT_CORRIDOR_WE,
];

/** Найти blueprint по id (для отладки/песочницы). */
export function findBlueprint(id: string): RoomBlueprint | undefined {
  return ALL_BLUEPRINTS.find((b) => b.id === id);
}

/**
 * Отфильтровать blueprint'ы, которые МОГУТ иметь дверь на стороне `side`
 * и при этом не иметь дверей там, где их быть не должно.
 *
 * Генератор использует это на каждом шаге walk'а.
 */
export function candidatesFor(
  side: "n" | "s" | "w" | "e",
  forbidden: Array<"n" | "s" | "w" | "e"> = []
): RoomBlueprint[] {
  return ALL_BLUEPRINTS.filter((bp) => {
    // нужна дверь на `side`
    if (!bp.exits[side]) return false;
    // не должно быть дверей на "запрещённых" сторонах
    for (const f of forbidden) if (bp.exits[f]) return false;
    // служебные комнаты (вес 0) в рандом не попадают
    if (bp.weight <= 0) return false;
    return true;
  });
}