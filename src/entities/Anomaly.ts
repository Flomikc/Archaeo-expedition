import {
    AbstractMesh,
    Color3,
    Mesh,
    MeshBuilder,
    Scene,
    StandardMaterial,
    TransformNode,
    Vector3,
  } from "@babylonjs/core";
  
  export type AnomalyState = "patrol" | "chase";
  
  export interface AnomalyOptions {
    scene: Scene;
    position: Vector3;
    /** Колбэк, возвращающий случайную точку маршрута в пределах локации. */
    pickPatrolPoint: () => Vector3;
  }
  
  /**
   * Аномалия «Кошко-призрак».
   * State machine: Patrol → Chase → Attack → Patrol.
   */
  export class Anomaly {
    private static readonly SPEED = 2.8;
    private static readonly CHASE_RADIUS = 9;
    private static readonly LOSE_RADIUS = 13;
    private static readonly ATTACK_RADIUS = 1.7;
    private static readonly ATTACK_DAMAGE = 10;
    private static readonly ATTACK_COOLDOWN = 2;
  
    readonly root: TransformNode;
    /** Меши, участвующие в raycast'е камеры игрока. */
    readonly meshes: AbstractMesh[] = [];
  
    private readonly scene: Scene;
    private readonly pickPatrolPoint: () => Vector3;
    private readonly material: StandardMaterial;
  
    private state: AnomalyState = "patrol";
    private patrolTarget: Vector3;
    private attackCooldown = 0;
    private time = 0;
    private disposed = false;
  
    constructor(options: AnomalyOptions) {
      this.scene = options.scene;
      this.pickPatrolPoint = options.pickPatrolPoint;
  
      this.root = new TransformNode("anomaly", this.scene);
      this.root.position.copyFrom(options.position);
      this.patrolTarget = this.pickPatrolPoint();
  
      this.material = new StandardMaterial("anomalyMat", this.scene);
      this.material.diffuseColor = new Color3(0.55, 0.85, 1);
      this.material.emissiveColor = new Color3(0.25, 0.55, 0.85);
      this.material.specularColor = new Color3(0.1, 0.1, 0.1);
      this.material.alpha = 0.6;
      this.material.backFaceCulling = false;
  
      // Тело
      const body = MeshBuilder.CreateSphere(
        "anomalyBody",
        { diameter: 1.1, segments: 12 },
        this.scene
      );
      body.position.set(0, 1.0, 0);
      body.material = this.material;
      body.parent = this.root;
      body.isPickable = true;
      body.checkCollisions = false;
      this.meshes.push(body);
  
      // Уши
      const earLeft = this.createEar("anomalyEarL", -0.28);
      const earRight = this.createEar("anomalyEarR", 0.28);
      this.meshes.push(earLeft, earRight);
    }
  
    private createEar(name: string, offsetX: number): Mesh {
      const ear = MeshBuilder.CreateCylinder(
        name,
        { height: 0.45, diameterTop: 0.02, diameterBottom: 0.26, tessellation: 10 },
        this.scene
      );
      ear.position.set(offsetX, 1.62, 0);
      ear.material = this.material;
      ear.parent = this.root;
      ear.isPickable = true;
      ear.checkCollisions = false;
      return ear;
    }
  
    /**
     * Обновляет аномалию. Возвращает нанесённый игроку урон (0, если урона нет).
     */
    update(dt: number, playerPosition: Vector3): number {
      if (this.disposed) return 0;
  
      this.time += dt;
      if (this.attackCooldown > 0) this.attackCooldown -= dt;
  
      const position = this.root.position;
  
      const toPlayer = playerPosition.subtract(position);
      toPlayer.y = 0;
      const distanceToPlayer = toPlayer.length();
  
      // --- Смена состояния ---
      if (this.state === "patrol" && distanceToPlayer < Anomaly.CHASE_RADIUS) {
        this.state = "chase";
      } else if (this.state === "chase" && distanceToPlayer > Anomaly.LOSE_RADIUS) {
        this.state = "patrol";
        this.patrolTarget = this.pickPatrolPoint();
      }
  
      let damage = 0;
  
      // --- Поведение ---
      if (this.state === "chase") {
        if (distanceToPlayer > 0.001) {
          const direction = toPlayer.scale(1 / distanceToPlayer);
          this.move(direction, Anomaly.SPEED * dt);
        }
  
        // Attack
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
          const direction = toTarget.scale(1 / distance);
          this.move(direction, Anomaly.SPEED * 0.6 * dt);
        }
      }
  
      // Парение
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
  
      for (const mesh of this.meshes) mesh.dispose();
      this.material.dispose();
      this.root.dispose();
    }
  }