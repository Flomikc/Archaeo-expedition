import {
  AbstractMesh,
  Scene,
  TransformNode,
  Vector3,
} from "@babylonjs/core";

import { createDrillPlaceholder } from "./placeholders";

/**
 * Бур для раскопок. Прогресс заполняется за DURATION секунд
 * (умножается на drillSpeedMultiplier из магазина).
 *
 * Вся визуальная часть — в placeholders.createDrillPlaceholder().
 * Чтобы заменить модель — правь только её.
 */
export class Drill {
  static readonly BASE_DURATION = 180;

  readonly root: TransformNode;
  readonly interactionMesh: AbstractMesh;

  private readonly rotatingParts: TransformNode[] = [];
  private readonly duration: number;

  private elapsed = 0;
  private active = false;
  private spin = 0;

  constructor(
    scene: Scene,
    position: Vector3,
    speedMultiplier = 1.0
  ) {
    const placeholder = createDrillPlaceholder(scene);
    this.root = placeholder.root;
    this.root.position.copyFrom(position);

    this.interactionMesh = placeholder.meshes[0];
    this.rotatingParts.push(placeholder.root);

    this.duration = Drill.BASE_DURATION / speedMultiplier;
  }

  get isActive(): boolean {
    return this.active;
  }

  get isComplete(): boolean {
    return this.elapsed >= this.duration;
  }

  get progress(): number {
    return Math.min(1, this.elapsed / this.duration);
  }

  activate(): void {
    if (this.active || this.isComplete) return;
    this.active = true;
  }

  update(dt: number): void {
    if (!this.active || this.isComplete) return;

    this.elapsed += dt;
    this.spin += dt * 14;

    // Крутим штангу (второй меш болванки)
    const column = this.root.getChildMeshes().find((m) => m.name === "drillColumn");
    if (column) column.rotation.y = this.spin;

    // Вибрация установки
    this.root.position.y += Math.sin(this.spin * 1.4) * 0.002;
    if (this.isComplete) this.root.position.y = Math.round(this.root.position.y);
  }

  dispose(): void {
    this.root.dispose();
  }
}