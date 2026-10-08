import {
  Color3,
  Color4,
  LinesMesh,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core";

import { RoomBlueprint } from "../src/data/RoomBlueprint";

const DIRS = ["n", "s", "w", "e"] as const;
type Dir = typeof DIRS[number];

/**
 * Визуальные помощники поверх комнаты.
 * Создаются в отдельной «служебной» группе и легко удаляются.
 */
export class GridOverlay {
  private readonly scene: Scene;
  private meshes: Array<Mesh | LinesMesh> = [];

  // Тумблеры — вызываются из main.ts
  private gridVisible = true;
  private axesVisible = true;
  private boundsVisible = true;
  private doorsVisible = true;

  private gridMesh: Mesh | null = null;
  private axesMeshes: LinesMesh[] = [];
  private boundsMeshes: Mesh[] = [];
  private doorMeshes: Mesh[] = [];

  constructor(scene: Scene) {
    this.scene = scene;
  }

  /** Строит разметку под одну комнату. */
  buildForRoom(
    blueprint: RoomBlueprint,
    sizeX: number,
    sizeZ: number,
    wallHeight = 4.5,
    centerX = 0,
    centerZ = 0,
    floorY = 0
  ): void {
    this.clear();

    // ── Сетка земли ────────────────────────────────────────────
    const gridSize = Math.max(sizeX, sizeZ, 40) * 2;
    const ground = MeshBuilder.CreateGround(
      "overlayGrid",
      { width: gridSize, height: gridSize, subdivisions: gridSize / 2 },
      this.scene
    );
    const gm = new StandardMaterial("overlayGridMat", this.scene);
    gm.wireframe = true;
    gm.diffuseColor = new Color3(0.4, 0.35, 0.2);
    gm.emissiveColor = new Color3(0.1, 0.08, 0.03);
    gm.alpha = 0.35;
    gm.disableLighting = true;
    ground.material = gm;
    ground.position.y = -0.01;
    ground.isPickable = false;
    ground.setEnabled(this.gridVisible);
    this.gridMesh = ground;

    // ── Оси ────────────────────────────────────────────────────
    this.axesMeshes.push(
      this.makeAxisLine("axisX", new Vector3(-sizeX, 0.02, 0), new Vector3(sizeX, 0.02, 0), new Color3(0.8, 0.2, 0.2)),
      this.makeAxisLine("axisZ", new Vector3(0, 0.02, -sizeZ), new Vector3(0, 0.02, sizeZ), new Color3(0.2, 0.4, 0.8)),
      this.makeAxisLine("axisY", new Vector3(0, 0, 0), new Vector3(0, wallHeight + 1, 0), new Color3(0.2, 0.8, 0.3))
    );
    for (const a of this.axesMeshes) a.setEnabled(this.axesVisible);

    // ── Wireframe границ комнаты ───────────────────────────────
    this.boundsMeshes = this.makeBoundsBox(
      sizeX, wallHeight, sizeZ, centerX, floorY, centerZ
    );
    for (const m of this.boundsMeshes) m.setEnabled(this.boundsVisible);

    // ── Стрелки дверей ─────────────────────────────────────────
    for (const d of DIRS) {
      const hasDoor = blueprint.exits[d];
      const arrow = this.makeDoorMarker(d, hasDoor, sizeX, sizeZ, centerX, centerZ, floorY);
      this.doorMeshes.push(arrow);
      arrow.setEnabled(this.doorsVisible);
    }
  }

  /** Тумблеры. */
  setGridVisible(v: boolean): void {
    this.gridVisible = v;
    this.gridMesh?.setEnabled(v);
  }
  setAxesVisible(v: boolean): void {
    this.axesVisible = v;
    for (const a of this.axesMeshes) a.setEnabled(v);
  }
  setBoundsVisible(v: boolean): void {
    this.boundsVisible = v;
    for (const b of this.boundsMeshes) b.setEnabled(v);
  }
  setDoorsVisible(v: boolean): void {
    this.doorsVisible = v;
    for (const d of this.doorMeshes) d.setEnabled(v);
  }

  clear(): void {
    for (const m of this.meshes) m.dispose();
    this.meshes = [];
    this.gridMesh = null;
    this.axesMeshes = [];
    this.boundsMeshes = [];
    this.doorMeshes = [];
  }

  dispose(): void {
    this.clear();
  }

  // ────────────────────────────────────────────────────────────

  private makeAxisLine(name: string, from: Vector3, to: Vector3, color: Color3): LinesMesh {
    const line = MeshBuilder.CreateLines(name, { points: [from, to] }, this.scene);
    line.color = color;
    line.isPickable = false;
    this.meshes.push(line);
    return line;
  }

  private makeBoundsBox(
    sizeX: number, wallHeight: number, sizeZ: number,
    centerX: number, floorY: number, centerZ: number
  ): Mesh[] {
    const mat = new StandardMaterial("boundsMat", this.scene);
    mat.wireframe = true;
    mat.diffuseColor = new Color3(1, 0.8, 0.4);
    mat.emissiveColor = new Color3(0.4, 0.3, 0.1);
    mat.alpha = 0.6;
    mat.disableLighting = true;

    const box = MeshBuilder.CreateBox("overlayBounds", {
      width: sizeX,
      height: wallHeight,
      depth: sizeZ,
    }, this.scene);
    box.position.set(centerX, floorY + wallHeight / 2, centerZ);
    box.material = mat;
    box.isPickable = false;
    this.meshes.push(box);
    return [box];
  }

  private makeDoorMarker(
    side: Dir, hasDoor: boolean,
    sizeX: number, sizeZ: number,
    centerX: number, centerZ: number,
    floorY: number
  ): Mesh {
    // Позиция маркера — центр соответствующей стены,
    // на 1 м выше пола.
    let dx = 0, dz = 0;
    if (side === "n") dz = -sizeZ / 2;
    if (side === "s") dz = +sizeZ / 2;
    if (side === "w") dx = -sizeX / 2;
    if (side === "e") dx = +sizeX / 2;

    const marker = MeshBuilder.CreateBox("doorMarker", {
      width: side === "n" || side === "s" ? 3 : 0.3,
      height: hasDoor ? 2.2 : 1.0,
      depth: side === "n" || side === "s" ? 0.3 : 3,
    }, this.scene);

    marker.position.set(
      centerX + dx,
      floorY + (hasDoor ? 1.1 : 0.5),
      centerZ + dz
    );

    const mat = new StandardMaterial("doorMat", this.scene);
    if (hasDoor) {
      mat.diffuseColor = new Color3(0.2, 0.9, 0.3);
      mat.emissiveColor = new Color3(0.1, 0.5, 0.15);
    } else {
      mat.diffuseColor = new Color3(0.9, 0.2, 0.2);
      mat.emissiveColor = new Color3(0.5, 0.1, 0.1);
    }
    mat.alpha = 0.7;
    mat.disableLighting = true;
    marker.material = mat;
    marker.isPickable = false;

    this.meshes.push(marker);
    return marker;
  }
}