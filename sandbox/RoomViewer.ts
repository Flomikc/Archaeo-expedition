import {
  AbstractMesh,
  Scene,
  Vector3,
} from "@babylonjs/core";

import {
  RoomBlueprint,
  RoomContext,
  RoomInstance,
  RoomMaterials,
} from "../src/data/RoomBlueprint";
import { createRoomMaterials } from "../src/data/room-materials";
import type { GridLevelData } from "../src/systems/GridLevelGenerator";

export type MeshCategory = "floor" | "ceiling" | "walls" | "decor";

/**
 * Строит комнаты в сцене. Управляет их жизненным циклом
 * и группирует по категориям для тумблеров видимости.
 */
export class RoomViewer {
  private readonly scene: Scene;
  private readonly materials: RoomMaterials;

  private currentMeshes: AbstractMesh[] = [];
  private byCategory: Record<MeshCategory, AbstractMesh[]> = {
    floor: [],
    ceiling: [],
    walls: [],
    decor: [],
  };

  constructor(scene: Scene) {
    this.scene = scene;
    // Материалы создаём ОДИН РАЗ — иначе будут утечки текстур
    // при пересборке комнат.
    this.materials = createRoomMaterials(scene);
  }

  /** Одна комната по blueprint'у. */
  buildSingle(blueprint: RoomBlueprint, sizeX: number, sizeZ: number): void {
    this.clear();

    const ctx: RoomContext = {
      scene: this.scene,
      rng: () => Math.random(),
      cell: { i: 0, j: 0, floor: 0 },
      centerX: 0,
      centerZ: 0,
      floorY: 0,
      sizeX,
      sizeZ,
      wallHeight: 4.5,
      ceilingY: 4.5,
      doors: { ...blueprint.exits },
      materials: this.materials,
    };

    const meshes = blueprint.build(ctx);
    this.register(meshes);
  }

  /** Целый уровень из GridLevelData. */
  buildGrid(data: GridLevelData): void {
    this.clear();

    for (const room of data.rooms) {
      const ctx: RoomContext = {
        scene: this.scene,
        rng: () => Math.random(),
        cell: room.cell,
        centerX: room.centerX,
        centerZ: room.centerZ,
        floorY: room.floorY,
        sizeX: room.sizeX,
        sizeZ: room.sizeZ,
        wallHeight: data.wallHeight,
        ceilingY: room.floorY + data.wallHeight,
        doors: { ...room.exits },
        materials: this.materials,
      };
      const meshes = room.blueprint.build(ctx);
      this.register(meshes);
    }
  }

  /** Включить/выключить категорию. */
  setCategoryVisible(cat: MeshCategory, visible: boolean): void {
    for (const m of this.byCategory[cat]) {
      m.setEnabled(visible);
    }
  }

  /** Все текущие меши (для overlay/инспектора). */
  getMeshes(): AbstractMesh[] {
    return this.currentMeshes;
  }

  /** Полный сброс. */
  clear(): void {
    for (const m of this.currentMeshes) m.dispose();
    this.currentMeshes = [];
    this.byCategory = { floor: [], ceiling: [], walls: [], decor: [] };
  }

  dispose(): void {
    this.clear();
  }

  // ────────────────────────────────────────────────────────────

  private register(meshes: AbstractMesh[]): void {
    for (const m of meshes) {
      this.currentMeshes.push(m);
      const cat = this.categorize(m.name);
      this.byCategory[cat].push(m);
    }
  }

  /**
   * Классификация меша по имени. Хелперы из room-kit
   * дают предсказуемые имена, поэтому работает надёжно.
   *
   * Если добавишь новый хелпер — допиши его в нужную категорию.
   */
  private categorize(name: string): MeshCategory {
    const n = name.toLowerCase();

    if (/^(floor|floorstrip|drillrim|drillpitfloor|stream|rail)/.test(n)) return "floor";
    if (/^(ceiling|ceilstrip)/.test(n)) return "ceiling";
    if (/^(wall|drillpit|ramp|drillramp|arch)/.test(n)) return "walls";
    return "decor";
  }
}