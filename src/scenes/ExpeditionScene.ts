import {
  Color3,
  Color4,
  Engine,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  PointLight,
  Ray,
  Scene,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core";

import { Anomaly } from "../entities/Anomaly";
import { CameraItem } from "../entities/CameraItem";
import { Drill } from "../entities/Drill";
import { Player } from "../entities/Player";
import { Atmosphere } from "../systems/Atmosphere";
import { InteractionSystem } from "../systems/InteractionSystem";
import { LevelData, LevelGenerator, PathNode } from "../systems/LevelGenerator";
import { SaveSystem } from "../systems/SaveSystem";
import { ShopSystem } from "../systems/ShopSystem";
import { HUD } from "../ui/HUD";

export interface ExpeditionSceneOptions {
  engine: Engine;
  canvas: HTMLCanvasElement;
  hud: HUD;
  onReturnToHub: () => void;
  onRestart: () => void;
}

const MISSION_TIME = 420;
const SPAWN_INTERVAL = 25;
const MAX_ANOMALIES = 4;
const PHOTO_RANGE = 12;
const START_PHOTOS = 8;
const PIT_DEPTH = 2.5;

export class ExpeditionScene {
  readonly scene: Scene;

  private readonly options: ExpeditionSceneOptions;
  private readonly hud: HUD;
  private readonly canvas: HTMLCanvasElement;
  private readonly engine: Engine;

  private readonly level: LevelData;
  private readonly player: Player;
  private readonly drill: Drill;
  private readonly interaction: InteractionSystem;
  private readonly exitMarker: Mesh;
  private readonly atmosphere: Atmosphere;

  private cameraItem: CameraItem | null = null;
  private anomalies: Anomaly[] = [];
  private torches: PointLight[] = [];

  private hp = 100;
  private photos = START_PHOTOS;
  private medkits = 0;
  private timeLeft = MISSION_TIME;
  private spawnTimer = 0;
  private shotCooldown = 0;
  private drillCompleted = false;
  private finished = false;
  private hasCamera = false;

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (this.finished) return;
    if (e.code === "KeyE") {
      this.interaction.interact();
    } else if (e.code === "KeyF") {
      this.tryPhoto();
    } else if (e.code === "KeyH") {
      this.tryMedkit();
    }
  };

  private readonly onPointerDown = (e: PointerEvent): void => {
    if (this.finished || e.button !== 0) return;
    this.tryPhoto();
  };

  constructor(options: ExpeditionSceneOptions) {
    this.options = options;
    this.hud = options.hud;
    this.canvas = options.canvas;
    this.engine = options.engine;

    this.scene = new Scene(options.engine);
    this.scene.clearColor = new Color4(0.01, 0.01, 0.015, 1);
    this.scene.collisionsEnabled = true;

    this.atmosphere = new Atmosphere(this.scene);
    this.atmosphere.apply("pyramid");

    const ambient = new HemisphericLight("expAmbient", new Vector3(0, 1, 0), this.scene);
    ambient.intensity = 0.18;
    ambient.diffuse = new Color3(0.55, 0.45, 0.32);
    ambient.groundColor = new Color3(0.08, 0.06, 0.04);

    // Бонусы магазина
    const bonuses = ShopSystem.getRuntimeBonuses();
    this.hasCamera = SaveSystem.get().hasCamera;
    this.photos = START_PHOTOS + bonuses.startPhotosBonus;
    this.medkits = bonuses.medkitCount;

    // Генерация уровня
    const save = SaveSystem.get();
    const seed = save.levelSeed ?? (Date.now() & 0xffffffff);
    SaveSystem.setLevelSeed(seed);
    this.level = new LevelGenerator().build(this.scene, seed);

    // Игрок
    const startNode = this.level.start;
    const startFloorY = startNode.cell.floor * LevelGenerator.FLOOR_HEIGHT;
    this.player = new Player({
      scene: this.scene,
      canvas: this.canvas,
      position: new Vector3(startNode.centerX, startFloorY + 1.7, startNode.centerZ),
    });
    this.player.enableFlashlight();

    // Фотоаппарат — если он есть в сохранении
    if (this.hasCamera) {
      this.cameraItem = new CameraItem(this.scene, new Vector3(0, -10, 0));
      this.cameraItem.pickup(this.player.camera);
    }

    // Бур — с апгрейдом скорости
    const goalNode = this.level.goal;
    const goalFloorY = goalNode.cell.floor * LevelGenerator.FLOOR_HEIGHT;
    this.drill = new Drill(
      this.scene,
      new Vector3(goalNode.centerX, goalFloorY - PIT_DEPTH + 0.5, goalNode.centerZ),
      bonuses.drillSpeedMultiplier
    );

    // Маркер выхода
    this.exitMarker = this.createExitMarker(
      new Vector3(startNode.centerX, startFloorY, startNode.centerZ)
    );
    this.exitMarker.setEnabled(false);

    this.placeTorches();

    this.interaction = new InteractionSystem(this.scene, this.player.camera);
    this.interaction.register({
      mesh: this.drill.interactionMesh,
      hint: "E — начать раскопки",
      range: 5,
      enabled: () => !this.drill.isActive && !this.drill.isComplete && !this.finished,
      onInteract: () => this.startDrilling(),
    });
    this.interaction.register({
      mesh: this.exitMarker,
      hint: "E — вернуться наружу",
      range: 5,
      enabled: () => this.drill.isComplete && !this.finished,
      onInteract: () => this.finishMission(true),
    });

    this.hud.setHudMode("expedition");
    this.hud.showHud(true);
    this.hud.setHp(this.hp);
    this.hud.setPhotos(this.photos);
    this.hud.setTimer(this.timeLeft);
    this.hud.setDrillProgress(false, 0);
    this.hud.setHint(null);

    if (!this.hasCamera) {
      this.hud.showToast("Фотоаппарат не взят в фуре", 3500);
    }
    if (this.medkits > 0) {
      this.hud.showToast(`Аптечек: ${this.medkits} (клавиша H)`, 2500);
    }

    window.addEventListener("keydown", this.onKeyDown);
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
  }

  setEnabled(value: boolean): void {
    this.player.setEnabled(value);
  }

  shouldSuppressPause(): boolean {
    return this.finished;
  }

  update(dt: number): void {
    if (this.finished) return;

    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.hud.setTimer(0);
      this.finishMission(false);
      return;
    }
    this.hud.setTimer(this.timeLeft);

    if (this.shotCooldown > 0) this.shotCooldown -= dt;

    this.player.update(dt);
    this.cameraItem?.update(dt);
    this.interaction.update();
    this.hud.setHint(this.interaction.getHint());
    this.atmosphere.update(dt);

    this.drill.update(dt);
    if (this.drill.isActive) {
      this.hud.setDrillProgress(true, this.drill.progress);
      if (this.drill.isComplete && !this.drillCompleted) {
        this.drillCompleted = true;
        this.onDrillComplete();
      }
    }

    if (this.drill.isActive && !this.drill.isComplete) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0 && this.anomalies.length < MAX_ANOMALIES) {
        this.spawnAnomaly();
        this.spawnTimer = SPAWN_INTERVAL;
      }
    }

    const t = performance.now() / 1000;
    for (let i = 0; i < this.torches.length; i++) {
      this.torches[i].intensity = 0.7 + Math.sin(t * 3.1 + i * 1.7) * 0.2;
    }

    this.checkTrapDamage(dt);

    const playerPosition = this.player.camera.position;
    for (const anomaly of [...this.anomalies]) {
      const damage = anomaly.update(dt, playerPosition);
      if (damage > 0) {
        this.hp = Math.max(0, this.hp - damage);
        this.hud.setHp(this.hp);
        this.hud.showToast("Аномалия атакует! −10 HP");
        if (this.hp <= 0) {
          this.finishMission(false);
          return;
        }
      }
    }
  }

  dispose(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    for (const anomaly of this.anomalies) anomaly.dispose();
    this.anomalies = [];
    this.cameraItem?.dispose();
    this.atmosphere.dispose();
    this.player.dispose();
    this.scene.dispose();
  }

  // ============================================================= helpers

  private tryPhoto(): void {
    if (this.finished) return;
    if (!this.hasCamera) {
      this.hud.showToast("Нет фотоаппарата!");
      return;
    }
    if (this.shotCooldown > 0) return;
    this.shotCooldown = 0.35;
    this.takePhoto();
  }

  private tryMedkit(): void {
    if (this.finished) return;
    if (this.medkits <= 0) {
      this.hud.showToast("Аптечек нет");
      return;
    }
    if (this.hp >= 100) {
      this.hud.showToast("Здоровье полное");
      return;
    }
    if (!ShopSystem.consume("medkit")) {
      this.hud.showToast("Аптечек нет");
      return;
    }
    this.medkits -= 1;
    this.hp = Math.min(100, this.hp + 50);
    this.hud.setHp(this.hp);
    this.hud.showToast(`+50 HP · осталось аптечек: ${this.medkits}`, 2200);
  }

  private placeTorches(): void {
    const mat = new StandardMaterial("torchMat", this.scene);
    mat.diffuseColor = new Color3(0.3, 0.15, 0.05);
    mat.emissiveColor = new Color3(0.6, 0.3, 0.05);

    const nodes = this.level.nodes;
    for (let idx = 2; idx < nodes.length - 1; idx += 3) {
      const node = nodes[idx];
      const floorY = node.cell.floor * LevelGenerator.FLOOR_HEIGHT;
      const pos = new Vector3(node.centerX, floorY + 2.7, node.centerZ);

      const light = new PointLight(`torch${idx}`, pos, this.scene);
      light.diffuse = new Color3(1, 0.55, 0.2);
      light.intensity = 0.85;
      light.range = 12;
      this.torches.push(light);

      const flame = MeshBuilder.CreateSphere(`flame${idx}`, { diameter: 0.28 }, this.scene);
      flame.position.copyFrom(pos);
      flame.material = mat;
      flame.isPickable = false;
    }
  }

  private checkTrapDamage(dt: number): void {
    const pos = this.player.camera.position;
    for (const node of this.level.nodes) {
      if (node.type !== "trap") continue;

      const floorY = node.cell.floor * LevelGenerator.FLOOR_HEIGHT;
      const offset = Math.min(node.sizeX, node.sizeZ) * 0.3;
      const pitX = (node.doors.n || node.doors.s) ? node.centerX + offset : node.centerX;
      const pitZ = (node.doors.w || node.doors.e) ? node.centerZ + offset : node.centerZ;

      const dx = pos.x - pitX;
      const dz = pos.z - pitZ;
      const inX = Math.abs(dx) < 1.6;
      const inZ = Math.abs(dz) < 1.6;
      const lowEnough = pos.y < floorY + 0.6;

      if (inX && inZ && lowEnough) {
        this.hp = Math.max(0, this.hp - 8 * dt);
        this.hud.setHp(this.hp);
        if (this.hp <= 0) this.finishMission(false);
        return;
      }
    }
  }

  private createExitMarker(position: Vector3): Mesh {
    const marker = MeshBuilder.CreateCylinder(
      "exitMarker",
      { height: 4, diameter: 1.3, tessellation: 18 },
      this.scene
    );
    marker.position = position.add(new Vector3(0, 2, 0));
    const mat = new StandardMaterial("exitMat", this.scene);
    mat.diffuseColor = new Color3(0.9, 0.12, 0.12);
    mat.emissiveColor = new Color3(0.55, 0.05, 0.05);
    mat.alpha = 0.65;
    marker.material = mat;
    marker.isPickable = true;
    marker.checkCollisions = false;
    return marker;
  }

  private startDrilling(): void {
    this.drill.activate();
    this.spawnTimer = 0;
    this.hud.setDrillProgress(true, 0);
    this.hud.showToast("Бур запущен! Защищайте раскопки.", 3500);
  }

  private onDrillComplete(): void {
    for (const anomaly of this.anomalies) anomaly.dispose();
    this.anomalies = [];
    this.exitMarker.setEnabled(true);
    this.hud.setDrillProgress(false, 0);
    this.hud.showToast("Артефакт найден! Вернитесь ко входу.", 6000);
  }

  private spawnAnomaly(): void {
    const playerPosition = this.player.camera.position;
    const nodes = this.level.nodes;

    let bestNode: PathNode = nodes[Math.floor(nodes.length / 2)];
    let bestDist = 0;
    for (const node of nodes) {
      if (node.isStart || node.isGoal) continue;
      const floorY = node.cell.floor * LevelGenerator.FLOOR_HEIGHT;
      const dx = node.centerX - playerPosition.x;
      const dz = node.centerZ - playerPosition.z;
      const dy = floorY - playerPosition.y;
      const dist = Math.sqrt(dx * dx + dz * dz + dy * dy);
      if (dist > 15 && dist > bestDist) {
        bestDist = dist;
        bestNode = node;
      }
    }

    const floorY = bestNode.cell.floor * LevelGenerator.FLOOR_HEIGHT;
    const position = new Vector3(bestNode.centerX, floorY, bestNode.centerZ);

    this.anomalies.push(
      new Anomaly({
        scene: this.scene,
        position,
        pickPatrolPoint: () => this.pickPatrolPoint(),
      })
    );
  }

  private pickPatrolPoint(): Vector3 {
    const nodes = this.level.nodes;
    const node = nodes[Math.floor(Math.random() * nodes.length)];
    const floorY = node.cell.floor * LevelGenerator.FLOOR_HEIGHT;
    return new Vector3(node.centerX, floorY, node.centerZ);
  }

  private takePhoto(): void {
    if (this.photos <= 0) {
      this.hud.showToast("Плёнка закончилась!");
      return;
    }
    this.photos -= 1;
    this.hud.setPhotos(this.photos);
    this.cameraItem?.shootKick();

    const target = this.findAnomalyInSight();
    if (target) {
      target.dispose();
      this.anomalies = this.anomalies.filter((a) => a !== target);
      this.hud.showToast("Аномалия запечатлена!");
    } else {
      this.hud.showToast("Промах…");
    }
  }

  private findAnomalyInSight(): Anomaly | null {
    if (this.anomalies.length === 0) return null;
    const origin = this.player.camera.position.clone();
    const direction = this.player.camera.getDirection(Vector3.Forward());

    const ray = new Ray(origin, direction, PHOTO_RANGE);
    const anomalyMeshes = new Set(this.anomalies.flatMap((a) => a.meshes));
    const pick = this.scene.pickWithRay(ray, (mesh) => anomalyMeshes.has(mesh));
    if (pick && pick.hit && pick.pickedMesh) {
      const hit = this.anomalies.find((a) => a.meshes.includes(pick.pickedMesh!));
      if (hit) return hit;
    }

    const cosLimit = Math.cos(0.35);
    let best: Anomaly | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const anomaly of this.anomalies) {
      const toAnomaly = anomaly.root.position.add(new Vector3(0, 1, 0)).subtract(origin);
      const distance = toAnomaly.length();
      if (distance > PHOTO_RANGE || distance < 0.001) continue;
      toAnomaly.normalize();
      if (Vector3.Dot(toAnomaly, direction) < cosLimit) continue;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = anomaly;
      }
    }
    return best;
  }

  private finishMission(success: boolean): void {
    if (this.finished) return;
    this.finished = true;
    this.player.setEnabled(false);
    this.engine.exitPointerlock();
    this.hud.setHint(null);
    this.hud.setDrillProgress(false, 0);
    for (const anomaly of this.anomalies) anomaly.dispose();
    this.anomalies = [];

    const spent = Math.max(0, MISSION_TIME - this.timeLeft);

    if (success) {
      // Рассчитываем награду
      const baseReward = 100;
      const speedBonus = Math.max(0, Math.floor((MISSION_TIME / 2 - spent) / 5));
      const photosBonus = this.photos * 5;
      const totalReward = baseReward + speedBonus + photosBonus;

      SaveSystem.addCoins(totalReward);

      // Артефакт в инвентарь
      const quality = Math.min(1, 0.6 + this.hp / 500);
      SaveSystem.addArtifact("Скарабей", "egypt", quality);

      this.hud.showResult(
        "Вердикт миссии",
        [
          "Статус: успех",
          `Время экспедиции: ${this.formatDuration(spent)}`,
          `Осталось снимков: ${this.photos}`,
          `Здоровье: ${Math.round(this.hp)}%`,
          `Артефакт: Скарабей (${Math.round(quality * 100)}%)`,
          `Награда: ${totalReward} монет`,
        ],
        [{ label: "Вернуться в фуру", primary: true, action: () => this.options.onReturnToHub() }]
      );
    } else {
      const reason = this.hp <= 0 ? "Вы потеряли сознание" : "Время вышло";
      this.hud.showResult(
        "Провал",
        [
          `Причина: ${reason}`,
          `Время в пирамиде: ${this.formatDuration(spent)}`,
          `Осталось снимков: ${this.photos}`,
        ],
        [
          { label: "Повторить", primary: true, action: () => this.options.onRestart() },
          { label: "Вернуться в фуру", action: () => this.options.onReturnToHub() },
        ]
      );
    }
  }

  private formatDuration(seconds: number): string {
    const total = Math.max(0, Math.round(seconds));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }
}