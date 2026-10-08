import {
  ArcRotateCamera,
  Color3,
  Color4,
  DirectionalLight,
  Engine,
  GizmoManager,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Texture,          // ← обязательно
  Vector3,
} from "@babylonjs/core";

import {
  EditorMaterials,
  OBJECT_TYPES,
  ObjectTypeDef,
  placeAtCenter,
  spawnByType,
} from "./ObjectTypes";

import { ALL_BLUEPRINTS, findBlueprint } from "../../src/data/blueprints";
import { RoomContext, RoomMaterials } from "../../src/data/RoomBlueprint";
import { createRoomMaterials } from "../../src/data/room-materials";
import { getTexture } from "../../src/data/textures";

// ============================================================
//  ТИПЫ
// ============================================================

export interface TexParams {
  uScale: number;
  vScale: number;
  uOffset: number;
  vOffset: number;
  wAng: number;
}

export interface EditorEvents {
  onSelectionChanged: (mesh: Mesh | null) => void;
  onObjectsChanged: (meshes: Mesh[]) => void;
}

const DEFAULT_ROOM = { x: 18, z: 18, wallHeight: 4.5 };

// ============================================================
//  ГЛАВНЫЙ КЛАСС
// ============================================================

export class EditorScene {
  readonly engine: Engine;
  readonly scene: Scene;
  readonly camera: ArcRotateCamera;
  readonly materials: EditorMaterials;
  readonly gizmos: GizmoManager;

  private readonly canvas: HTMLCanvasElement;
  private readonly events: EditorEvents;

  private objects: Mesh[] = [];
  private selected: Mesh | null = null;
  private readonly helperMeshes = new Set<Mesh>();
  private roomMaterials: RoomMaterials | null = null;

  constructor(canvas: HTMLCanvasElement, events: EditorEvents) {
    this.canvas = canvas;
    this.events = events;

    this.engine = new Engine(canvas, true, { stencil: false }, true);
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.05, 0.05, 0.07, 1);
    this.scene.collisionsEnabled = false;

    const camera = new ArcRotateCamera(
      "editorCamera",
      -Math.PI / 2 + 0.5,
      Math.PI / 3,
      35,
      new Vector3(0, 2, 0),
      this.scene
    );
    camera.lowerRadiusLimit = 4;
    camera.upperRadiusLimit = 120;
    camera.wheelPrecision = 25;
    camera.panningSensibility = 60;
    camera.attachControl(false, false, 2);
    this.camera = camera;

    const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), this.scene);
    hemi.intensity = 0.65;
    hemi.diffuse = new Color3(1, 0.95, 0.85);

    const dir = new DirectionalLight("dir", new Vector3(-0.5, -1, 0.4), this.scene);
    dir.intensity = 0.6;
    dir.diffuse = new Color3(1, 0.9, 0.75);

    this.materials = new EditorMaterials(this.scene);
    this.buildHelperGrid();

    const gizmos = new GizmoManager(this.scene);
    gizmos.positionGizmoEnabled = true;
    gizmos.rotationGizmoEnabled = true;
    gizmos.usePointerToAttachGizmos = false;
    this.gizmos = gizmos;

    this.scene.onPointerUp = (evt, pickInfo) => {
      if (evt.button !== 0) return;
      if (document.pointerLockElement) return;
      if (!pickInfo || !pickInfo.hit || !pickInfo.pickedMesh) {
        this.select(null);
        return;
      }
      const mesh = pickInfo.pickedMesh;
      if (!(mesh instanceof Mesh)) return;
      if (this.helperMeshes.has(mesh)) {
        this.select(null);
        return;
      }
      this.select(mesh);
    };

    this.engine.runRenderLoop(() => this.scene.render());
    window.addEventListener("resize", () => this.engine.resize());
  }

  // ============================================================
  //  API — работа с объектами
  // ============================================================

  addObject(typeId: string): Mesh | null {
    const def = OBJECT_TYPES.find((d) => d.type === typeId);
    if (!def) return null;

    const mesh = spawnByType(this.scene, def, this.materials);
    placeAtCenter(mesh);
    mesh.name = `${def.type}_${this.objects.filter((o) => o.metadata.type === def.type).length + 1}`;

    this.objects.push(mesh);
    this.select(mesh);
    this.events.onObjectsChanged(this.objects);
    return mesh;
  }

  deleteSelected(): void {
    if (!this.selected) return;
    const mesh = this.selected;
    this.select(null);
    this.objects = this.objects.filter((o) => o !== mesh);
    mesh.dispose();
    this.events.onObjectsChanged(this.objects);
  }

  duplicateSelected(): void {
    if (!this.selected) return;
    const src = this.selected;
    const meta = src.metadata as {
      type: string; w: number; h: number; d: number; material: string;
      tex?: TexParams;
    };
    const def = OBJECT_TYPES.find((d) => d.type === meta.type);
    if (!def) return;

    const sizedDef: ObjectTypeDef = {
      ...def,
      defaultW: meta.w,
      defaultH: meta.h,
      defaultD: meta.d,
      defaultMaterial: meta.material,
    };

    const copy = spawnByType(this.scene, sizedDef, this.materials);
    copy.position.copyFrom(src.position);
    copy.position.x += 1;
    copy.rotation.copyFrom(src.rotation);
    copy.scaling.copyFrom(src.scaling);
    copy.name = `${meta.type}_${this.objects.filter((o) => o.metadata.type === meta.type).length + 1}`;

    // Переносим tex-настройки
    const srcTex = (src.material as StandardMaterial).diffuseTexture as Texture | null;
    const copyTex = (copy.material as StandardMaterial).diffuseTexture as Texture | null;
    if (srcTex && copyTex) {
      copyTex.uScale = srcTex.uScale;
      copyTex.vScale = srcTex.vScale;
      copyTex.uOffset = srcTex.uOffset;
      copyTex.vOffset = srcTex.vOffset;
      copyTex.wAng = srcTex.wAng;
    }
    const copyMeta = copy.metadata as { tex?: TexParams };
    copyMeta.tex = meta.tex ? { ...meta.tex } : undefined;

    this.objects.push(copy);
    this.select(copy);
    this.events.onObjectsChanged(this.objects);
  }

  select(mesh: Mesh | null, silent = false): void {
    this.selected = mesh;
    if (mesh) this.gizmos.attachToMesh(mesh);
    else this.gizmos.attachToMesh(null);
    if (!silent) this.events.onSelectionChanged(mesh);
  }

  // ============================================================
  //  ОБНОВЛЕНИЕ ТРАНСФОРМАЦИИ
  // ============================================================

  updateSelectedTransform(patch: {
    x?: number; y?: number; z?: number;
    rx?: number; ry?: number; rz?: number;
    w?: number; h?: number; d?: number;
    material?: string;
    tex?: Partial<TexParams>;
  }): void {
    const mesh = this.selected;
    if (!mesh) return;

    const meta = mesh.metadata as {
      type: string;
      shape: string;
      w: number; h: number; d: number;
      material: string;
      isCylinder: boolean;
      tex?: TexParams;
    };

    // ── Позиция ────────────────────────────────────────────
    if (patch.x !== undefined) mesh.position.x = patch.x;
    if (patch.y !== undefined) mesh.position.y = patch.y;
    if (patch.z !== undefined) mesh.position.z = patch.z;

    // ── Поворот ────────────────────────────────────────────
    if (patch.rx !== undefined) mesh.rotation.x = patch.rx;
    if (patch.ry !== undefined) mesh.rotation.y = patch.ry;
    if (patch.rz !== undefined) mesh.rotation.z = patch.rz;

    // ── Размер (пересоздание меша) ─────────────────────────
    const sizeChanged =
      patch.w !== undefined || patch.h !== undefined || patch.d !== undefined;

    if (sizeChanged) {
      const newW = patch.w ?? meta.w;
      const newH = patch.h ?? meta.h;
      const newD = patch.d ?? meta.d;

      const pos = mesh.position.clone();
      const rot = mesh.rotation.clone();
      const name = mesh.name;
      const savedTex = meta.tex ? { ...meta.tex } : undefined;

      this.gizmos.attachToMesh(null);
      mesh.dispose();

      const def = OBJECT_TYPES.find((d) => d.type === meta.type);
      if (!def) return;

      const newDef: ObjectTypeDef = {
        ...def,
        defaultW: newW,
        defaultH: newH,
        defaultD: newD,
        defaultMaterial: meta.material,
      };
      const newMesh = spawnByType(this.scene, newDef, this.materials);
      newMesh.position.copyFrom(pos);
      newMesh.rotation.copyFrom(rot);
      newMesh.name = name;

      // Переносим tex
      const newTex = (newMesh.material as StandardMaterial).diffuseTexture as Texture | null;
      if (newTex && savedTex) {
        newTex.uScale = savedTex.uScale;
        newTex.vScale = savedTex.vScale;
        newTex.uOffset = savedTex.uOffset;
        newTex.vOffset = savedTex.vOffset;
        newTex.wAng = savedTex.wAng;
      }
      const newMeta = newMesh.metadata as {
        w: number; h: number; d: number;
        tex?: TexParams;
      };
      newMeta.w = newW; newMeta.h = newH; newMeta.d = newD;
      newMeta.tex = savedTex;

      const idx = this.objects.indexOf(mesh);
      if (idx >= 0) this.objects[idx] = newMesh;

      this.select(newMesh, true);
      this.events.onObjectsChanged(this.objects);
      return;
    }

    // ── Материал ───────────────────────────────────────────
    if (patch.material !== undefined) {
      meta.material = patch.material;
      mesh.material = this.materials.getCloned(patch.material);

    const tex = (mesh.material as StandardMaterial).diffuseTexture as Texture | null;
        if (tex && meta.tex) {
        tex.uScale = meta.tex.uScale;
        tex.vScale = meta.tex.vScale;
        tex.uOffset = meta.tex.uOffset;
        tex.vOffset = meta.tex.vOffset;
        tex.wAng = meta.tex.wAng;
      }
    }

    // ── Tex-настройки ──────────────────────────────────────
    if (patch.tex) {
    const tex = (mesh.material as StandardMaterial).diffuseTexture as Texture | null;
      if (tex) {
        if (!meta.tex) {
          meta.tex = {
            uScale: tex.uScale ?? 1,
            vScale: tex.vScale ?? 1,
            uOffset: tex.uOffset ?? 0,
            vOffset: tex.vOffset ?? 0,
            wAng: tex.wAng ?? 0,
          };
        }
        if (patch.tex.uScale !== undefined) {
          meta.tex.uScale = patch.tex.uScale;
          tex.uScale = patch.tex.uScale;
        }
        if (patch.tex.vScale !== undefined) {
          meta.tex.vScale = patch.tex.vScale;
          tex.vScale = patch.tex.vScale;
        }
        if (patch.tex.uOffset !== undefined) {
          meta.tex.uOffset = patch.tex.uOffset;
          tex.uOffset = patch.tex.uOffset;
        }
        if (patch.tex.vOffset !== undefined) {
          meta.tex.vOffset = patch.tex.vOffset;
          tex.vOffset = patch.tex.vOffset;
        }
        if (patch.tex.wAng !== undefined) {
          meta.tex.wAng = patch.tex.wAng;
          tex.wAng = patch.tex.wAng;
        }
      }
    }
  }

  // ============================================================
  //  ОЧИСТКА
  // ============================================================

  clearAll(): void {
    this.gizmos.attachToMesh(null);
    for (const o of this.objects) o.dispose();
    this.objects = [];
    this.selected = null;
    this.events.onSelectionChanged(null);
    this.events.onObjectsChanged(this.objects);
  }

  getObjects(): Mesh[] {
    return this.objects;
  }

  resetCamera(): void {
    this.camera.setTarget(new Vector3(0, 2, 0));
    this.camera.alpha = -Math.PI / 2 + 0.5;
    this.camera.beta = Math.PI / 3;
    this.camera.radius = 35;
  }

  // ============================================================
  //  ЗАГРУЗКА BLUEPRINT'А
  // ============================================================

  loadBlueprint(bpId: string): boolean {
    const bp = findBlueprint(bpId);
    if (!bp) return false;

    this.clearAll();

    if (!this.roomMaterials) {
      this.roomMaterials = createRoomMaterials(this.scene);
    }

    const ctx: RoomContext = {
      scene: this.scene,
      rng: () => Math.random(),
      cell: { i: 0, j: 0, floor: 0 },
      centerX: 0, centerZ: 0, floorY: 0,
      sizeX: 18, sizeZ: 18,
      wallHeight: 4.5,
      ceilingY: 4.5,
      doors: { ...bp.exits },
      materials: this.roomMaterials,
    };

    const meshes = bp.build(ctx);

    for (const m of meshes) {
      if (m instanceof Mesh) {
        this.registerFromBlueprint(m);
      }
    }

    this.events.onObjectsChanged(this.objects);
    return true;
  }

  private registerFromBlueprint(mesh: Mesh): void {
    const meta = mesh.metadata as {
      type?: string;
      material?: string;
      tex?: TexParams;
    } | null;

    // ── Тип ─────────────────────────────────────────────────
    let type: string;
    if (meta?.type) {
      type = meta.type;
    } else if (/col/i.test(mesh.name)) type = "column";
    else if (/wall/i.test(mesh.name)) type = "wall";
    else if (/floor/i.test(mesh.name)) type = "floor";
    else if (/ceil/i.test(mesh.name)) type = "ceiling";
    else if (/stream/i.test(mesh.name)) type = "water";
    else if (/spike/i.test(mesh.name)) type = "spike";
    else if (/platform/i.test(mesh.name)) type = "platform";
    else if (/pedestal/i.test(mesh.name)) type = "pedestal";
    else if (/orb/i.test(mesh.name)) type = "sphere";
    else type = "box";

    // ── Материал ────────────────────────────────────────────
    let cleanMat = meta?.material ?? "";
    if (!cleanMat) {
      const matName = (mesh.material as { name?: string } | null)?.name ?? "";
      cleanMat =
        matName.replace(/^mat_/, "").replace(/Mat$/, "").replace(/^ph_/, "") ||
        "stone";
    }

    // ── Размер: локальный AABB ──────────────────────────────
    const bb = mesh.getBoundingInfo().boundingBox;
    const localSize = bb.extendSize.scale(2);

    let sizeX = Math.max(0.05, Math.abs(localSize.x));
    let sizeY = Math.max(0.05, Math.abs(localSize.y));
    let sizeZ = Math.max(0.05, Math.abs(localSize.z));

    const metaFull = mesh.metadata as
      | { w?: number; h?: number; d?: number }
      | null;
    if (metaFull?.w !== undefined) sizeX = metaFull.w;
    if (metaFull?.h !== undefined) sizeY = metaFull.h;
    if (metaFull?.d !== undefined) sizeZ = metaFull.d;

    // ── Создаём редактируемый объект ────────────────────────
    const baseDef =
      OBJECT_TYPES.find((d) => d.type === type) ?? OBJECT_TYPES[0];

    const editableDef: ObjectTypeDef = {
      ...baseDef,
      defaultW: sizeX,
      defaultH: sizeY,
      defaultD: sizeZ,
      defaultMaterial: cleanMat,
    };

    const editable = spawnByType(this.scene, editableDef, this.materials);

    editable.position.copyFrom(mesh.position);
    if (mesh.rotationQuaternion) {
      const e = mesh.rotationQuaternion.toEulerAngles();
      editable.rotation.set(e.x, e.y, e.z);
    } else {
      editable.rotation.copyFrom(mesh.rotation);
    }
    editable.name = `${type}_${this.objects.filter((o) => o.metadata.type === type).length + 1}`;

    const editMeta = editable.metadata as {
      w: number; h: number; d: number;
      material: string;
      tex?: TexParams;
    };
    editMeta.w = sizeX;
    editMeta.h = sizeY;
    editMeta.d = sizeZ;
    editMeta.material = cleanMat;

    // ── Tex ─────────────────────────────────────────────────
    const srcTex = meta?.tex;
    const regDef = getTexture(cleanMat);
    const defaultTex: TexParams = srcTex ?? {
      uScale: regDef?.uScale ?? 1,
      vScale: regDef?.vScale ?? 1,
      uOffset: 0,
      vOffset: 0,
      wAng: 0,
    };

    const editableTex = (editable.material as StandardMaterial).diffuseTexture as Texture | null;
    if (editableTex) {
      editableTex.uScale = defaultTex.uScale;
      editableTex.vScale = defaultTex.vScale;
      editableTex.uOffset = defaultTex.uOffset;
      editableTex.vOffset = defaultTex.vOffset;
      editableTex.wAng = defaultTex.wAng;
    }
    editMeta.tex = { ...defaultTex };

    mesh.dispose();
    this.objects.push(editable);
  }

  getAvailableBlueprints(): Array<{
    id: string;
    label: string;
    category: string;
  }> {
    return ALL_BLUEPRINTS.map((bp) => ({
      id: bp.id,
      label: bp.label,
      category: bp.category,
    }));
  }

  // ============================================================
  //  ЖИЗНЕННЫЙ ЦИКЛ
  // ============================================================

  dispose(): void {
    this.gizmos.dispose();
    this.materials.dispose();
    this.roomMaterials = null;
    this.scene.dispose();
    this.engine.dispose();
  }

  // ============================================================
  //  СЛУЖЕБНОЕ
  // ============================================================

  private buildHelperGrid(): void {
    const grid = MeshBuilder.CreateGround(
      "helperGrid",
      { width: 60, height: 60, subdivisions: 30 },
      this.scene
    );
    const gm = new StandardMaterial("helperGridMat", this.scene);
    gm.wireframe = true;
    gm.diffuseColor = new Color3(0.3, 0.28, 0.2);
    gm.emissiveColor = new Color3(0.08, 0.07, 0.04);
    gm.alpha = 0.4;
    gm.disableLighting = true;
    grid.material = gm;
    grid.position.y = 0;
    grid.isPickable = false;
    this.helperMeshes.add(grid);

    const lineX = MeshBuilder.CreateLines(
      "helperX",
      { points: [new Vector3(-30, 0.01, 0), new Vector3(30, 0.01, 0)] },
      this.scene
    );
    lineX.color = new Color3(0.8, 0.2, 0.2);
    lineX.isPickable = false;
    this.helperMeshes.add(lineX);

    const lineZ = MeshBuilder.CreateLines(
      "helperZ",
      { points: [new Vector3(0, 0.01, -30), new Vector3(0, 0.01, 30)] },
      this.scene
    );
    lineZ.color = new Color3(0.2, 0.4, 0.8);
    lineZ.isPickable = false;
    this.helperMeshes.add(lineZ);

    const lineY = MeshBuilder.CreateLines(
      "helperY",
      { points: [new Vector3(0, 0, 0), new Vector3(0, 6, 0)] },
      this.scene
    );
    lineY.color = new Color3(0.2, 0.8, 0.3);
    lineY.isPickable = false;
    this.helperMeshes.add(lineY);
  }
}

// ============================================================
//  ЭКСПОРТ В JSON
// ============================================================

export interface ExportedObject {
  type: string;
  x: number; y: number; z: number;
  rx: number; ry: number; rz: number;
  w: number; h: number; d: number;
  material: string;
  tex: {
    uScale: number;
    vScale: number;
    uOffset: number;
    vOffset: number;
    wAng: number;
  };
}

export interface ExportedRoom {
  roomId: string;
  size: { x: number; z: number; wallHeight: number };
  objects: ExportedObject[];
}

export function exportToJSON(
  meshes: Mesh[],
  roomId: string,
  size: { x: number; z: number; wallHeight: number } = DEFAULT_ROOM
): ExportedRoom {
  const objects: ExportedObject[] = [];

  for (const mesh of meshes) {
    const meta = mesh.metadata as {
      type: string;
      w: number; h: number; d: number;
      material: string;
      tex?: TexParams;
    };

    const rot = mesh.rotationQuaternion
      ? mesh.rotationQuaternion.toEulerAngles()
      : mesh.rotation;

    const t = meta.tex ?? {
      uScale: 1, vScale: 1, uOffset: 0, vOffset: 0, wAng: 0,
    };

    objects.push({
      type: meta.type,
      x: round(mesh.position.x),
      y: round(mesh.position.y),
      z: round(mesh.position.z),
      rx: round(rot.x, 4),
      ry: round(rot.y, 4),
      rz: round(rot.z, 4),
      w: round(meta.w),
      h: round(meta.h),
      d: round(meta.d),
      material: meta.material,
      tex: {
        uScale: round(t.uScale, 3),
        vScale: round(t.vScale, 3),
        uOffset: round(t.uOffset, 4),
        vOffset: round(t.vOffset, 4),
        wAng: round(t.wAng, 4),
      },
    });
  }

  return { roomId, size, objects };
}

function round(n: number, digits = 2): number {
  const m = Math.pow(10, digits);
  return Math.round(n * m) / m;
}