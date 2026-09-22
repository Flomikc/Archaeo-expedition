import {
  AbstractMesh,
  Scene,
  TransformNode,
  Vector3,
} from "@babylonjs/core";

import { createAnomalyPlaceholder } from "./placeholders";

export type AnomalyState = "patrol" | "chase";

export interface AnomalyOptions {
  scene: Scene;
  position: Vector3;
  pickPatrolPoint: () => Vector3;
}

/**
 * Аномалия «кошко-призрак».
 * Визуал — createAnomalyPlaceholder() в placeholders.ts.
 */
export class Anomaly {
  private static readonly SPEED = 2.8;
  private static readonly CHASE_RADIUS = 9;
  private static readonly LOSE_RADIUS = 13;
  private static readonly ATTACK_RADIUS = 1.7;
  private static readonly ATTACK_DAMAGE = 10;
  private static readonly ATTACK_COOLDOWN = 2;

  readonly root: TransformNode;
  readonly meshes: AbstractMesh[];

  private readonly scene: Scene;
  private readonly pickPatrolPoint: () => Vector3;

  private state: AnomalyState = "patrol";
  private patrolTarget: Vector3;
  private attackCooldown = 0;
  private time = 0;
  private disposed = false;

  constructor(options: AnomalyOptions) {
    this.scene = options.scene;
    this.pickPatrolPoint = options.pickPatrolPoint;

    const placeholder = createAnomalyPlaceholder(this.scene);
    this.root = placeholder.root;
    this.root.position.copyFrom(options.position);
    this.meshes = placeholder.meshes;

    this.patrolTarget = this.pickPatrolPoint();
  }

  update(dt: number, playerPosition: Vector3): number {
    if (this.disposed) return 0;

    this.time += dt;
    if (this.attackCooldown > 0) this.attackCooldown -= dt;

    const position = this.root.position;
    const toPlayer = playerPosition.subtract(position);
    toPlayer.y = 0;
    const distanceToPlayer = toPlayer.length();

    if (this.state === "patrol" && distanceToPlayer < Anomaly.CHASE_RADIUS) {
      this.state = "chase";
    } else if (this.state === "chase" && distanceToPlayer > Anomaly.LOSE_RADIUS) {
      this.state = "patrol";
      this.patrolTarget = this.pickPatrolPoint();
    }

    let damage = 0;

    if (this.state === "chase") {
      if (distanceToPlayer > 0.001) {
        const dir = toPlayer.scale(1 / distanceToPlayer);
        this.move(dir, Anomaly.SPEED * dt);
      }
      if (distanceToPlayer < Anomaly.ATTACK_RADIUS && this.attackCooldown <= 0) {
        damage = Anomaly.ATTACK_DAMAGE;
        this.attackCooldown = Anomaly.ATTACK_COOLDOWN;
        this.state = "patrol";
        this.patrolTarget = this.pickPatrolPoint();
      }
    } else {
      const toTarget = this.patrolTarget.subtract(position);
      toTarget.y = 0;
      const distance = toTarget.length();

      if (distance < 0.9) {
        this.patrolTarget = this.pickPatrolPoint();
      } else {
        const dir = toTarget.scale(1 / distance);
        this.move(dir, Anomaly.SPEED * 0.6 * dt);
      }
    }

    this.root.position.y = 0.15 + Math.sin(this.time * 2.2) * 0.12;
    return damage;
  }

  private move(direction: Vector3, amount: number): void {
    this.root.position.addInPlace(direction.scale(amount));
    this.root.position.y = 0;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.dispose();
  }
}