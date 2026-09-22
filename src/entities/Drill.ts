import {
    Color3,
    Mesh,
    MeshBuilder,
    Scene,
    StandardMaterial,
    TransformNode,
    Vector3,
  } from "@babylonjs/core";
  
  /**
   * Бур для раскопок. Прогресс заполняется за DURATION секунд.
   */
  export class Drill {
    static readonly DURATION = 180; // 3 минуты
  
    readonly root: TransformNode;
    /** Меш, по которому ловим наведение игрока. */
    readonly interactionMesh: Mesh;
  
    private readonly column: Mesh;
    private elapsed = 0;
    private active = false;
    private spin = 0;
  
    constructor(scene: Scene, position: Vector3) {
      this.root = new TransformNode("drill", scene);
      this.root.position.copyFrom(position);
  
      const metal = new StandardMaterial("drillMetal", scene);
      metal.diffuseColor = new Color3(0.45, 0.47, 0.5);
      metal.specularColor = new Color3(0.5, 0.5, 0.5);
  
      const accent = new StandardMaterial("drillAccent", scene);
      accent.diffuseColor = new Color3(0.8, 0.6, 0.18);
      accent.emissiveColor = new Color3(0.18, 0.12, 0.02);
  
      // Основание
      const base = MeshBuilder.CreateCylinder(
        "drillBase",
        { height: 0.5, diameter: 2.6, tessellation: 20 },
        scene
      );
      base.position.set(0, 0.25, 0);
      base.material = metal;
      base.parent = this.root;
      base.checkCollisions = true;
  
      // Вращающаяся штанга — по ней и ловим наведение
      this.column = MeshBuilder.CreateCylinder(
        "drillColumn",
        { height: 2.4, diameter: 0.9, tessellation: 16 },
        scene
      );
      this.column.position.set(0, 1.7, 0);
      this.column.material = accent;
      this.column.parent = this.root;
  
      // Головка
      const head = MeshBuilder.CreateBox(
        "drillHead",
        { width: 1.7, height: 0.9, depth: 1.7 },
        scene
      );
      head.position.set(0, 3.35, 0);
      head.material = metal;
      head.parent = this.root;
  
      this.interactionMesh = this.column;
    }
  
    get isActive(): boolean {
      return this.active;
    }
  
    get isComplete(): boolean {
      return this.elapsed >= Drill.DURATION;
    }
  
    get progress(): number {
      return Math.min(1, this.elapsed / Drill.DURATION);
    }
  
    activate(): void {
      if (this.active || this.isComplete) return;
      this.active = true;
    }
  
    update(dt: number): void {
      if (!this.active || this.isComplete) return;
  
      this.elapsed += dt;
      this.spin += dt * 14;
      this.column.rotation.y = this.spin;
  
      // Небольшая вибрация установки
      this.root.position.y = Math.sin(this.spin * 1.4) * 0.03;
  
      if (this.isComplete) this.root.position.y = 0;
    }
  
    dispose(): void {
      this.root.dispose();
    }
  }