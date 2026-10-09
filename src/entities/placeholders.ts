import {
  AbstractMesh,
  Color3,
  DynamicTexture,
  Mesh,
  MeshBuilder,
  RenderTargetTexture,
  Scene,
  StandardMaterial,
  Texture,
  TransformNode,
  Vector3,
} from "@babylonjs/core";

import { TEXTURES } from "../data/textures";
  
  /**
   * Здесь собраны ВСЕ визуальные «болванки» для интерактивных объектов.
   *
   * КАК ЗАМЕНИТЬ НА РЕАЛЬНУЮ МОДЕЛЬ:
   *   1. Скачай .glb-модель и положи в /public/models/
   *   2. Замени тело функции на:
   *        const root = new TransformNode("drill", scene);
   *        const result = await SceneLoader.ImportMeshAsync(null, "/models/", "drill.glb", scene);
   *        result.meshes.forEach(m => m.parent = root);
   *        return { root, meshes: result.meshes };
   *   3. Больше ничего менять не нужно — логика уже работает с root и meshes.
   */
  
export interface PlaceholderResult {
  root: TransformNode;
  /** Меши, которые участвуют в raycast (наведение игрока). */
  meshes: AbstractMesh[];
  /** Опционально: функция перерисовки REC-индикатора (мигание). */
  redrawRec?: (visible: boolean) => void;
}
  
  /** Бур: основание + колонна + головка. */
  export function createDrillPlaceholder(scene: Scene): PlaceholderResult {
    const root = new TransformNode("drillRoot", scene);
  
    const metal = new StandardMaterial("ph_drillMetal", scene);
    metal.diffuseColor = new Color3(0.45, 0.47, 0.5);
    metal.specularColor = new Color3(0.5, 0.5, 0.5);
  
    const accent = new StandardMaterial("ph_drillAccent", scene);
    accent.diffuseColor = new Color3(0.8, 0.6, 0.18);
    accent.emissiveColor = new Color3(0.18, 0.12, 0.02);
  
    const base = MeshBuilder.CreateCylinder("drillBase", { height: 0.5, diameter: 2.6, tessellation: 20 }, scene);
    base.position.set(0, 0.25, 0);
    base.material = metal;
    base.parent = root;
    base.checkCollisions = true;
  
    const column = MeshBuilder.CreateCylinder("drillColumn", { height: 2.4, diameter: 0.9, tessellation: 16 }, scene);
    column.position.set(0, 1.7, 0);
    column.material = accent;
    column.parent = root;
  
    const head = MeshBuilder.CreateBox("drillHead", { width: 1.7, height: 0.9, depth: 1.7 }, scene);
    head.position.set(0, 3.35, 0);
    head.material = metal;
    head.parent = root;
  
    return { root, meshes: [column] };
  }
  
  /** Аномалия «кошко-призрак»: тело + два уха. */
  export function createAnomalyPlaceholder(scene: Scene): PlaceholderResult {
    const root = new TransformNode("anomalyRoot", scene);
  
    const mat = new StandardMaterial("ph_anomalyMat", scene);
    mat.diffuseColor = new Color3(0.55, 0.85, 1);
    mat.emissiveColor = new Color3(0.25, 0.55, 0.85);
    mat.specularColor = new Color3(0.1, 0.1, 0.1);
    mat.alpha = 0.6;
    mat.backFaceCulling = false;
  
    const body = MeshBuilder.CreateSphere("anomalyBody", { diameter: 1.1, segments: 12 }, scene);
    body.position.set(0, 1.0, 0);
    body.material = mat;
    body.parent = root;
    body.isPickable = true;
  
    const earL = MeshBuilder.CreateCylinder("anomalyEarL", { height: 0.45, diameterTop: 0.02, diameterBottom: 0.26, tessellation: 10 }, scene);
    earL.position.set(-0.28, 1.62, 0);
    earL.material = mat;
    earL.parent = root;
    earL.isPickable = true;
  
    const earR = MeshBuilder.CreateCylinder("anomalyEarR", { height: 0.45, diameterTop: 0.02, diameterBottom: 0.26, tessellation: 10 }, scene);
    earR.position.set(0.28, 1.62, 0);
    earR.material = mat;
    earR.parent = root;
    earR.isPickable = true;
  
    return { root, meshes: [body, earL, earR] };
  }
  
// ═══════════════════════════════════════════════════════════════
//  КАМЕРА — ОБЩИЕ ДАННЫЕ (из JSON пользователя)
// ═══════════════════════════════════════════════════════════════
//
//  Модель сделана в редакторе в масштабе 10x. Чтобы получить
//  реальный размер (0.22 × 0.16 × 0.06 м), применяем S = 0.1.

const S = 0.1;

interface CamPart {
  type: "box" | "cylinder";
  x: number; y: number; z: number;
  rx?: number; ry?: number; rz?: number;
  w: number; h: number; d: number;
  material: "stone" | "darkStone" | "sand" | "metal" | "wood" | "water";
  color?: string;
  /** Роль "screen" — рисуем не меш, а маску-окно. */
  role?: "screen";
}

const CAMERA_PARTS: CamPart[] = [
  // ── Основной корпус ─────────────────────────────────────
  { type: "box",      x:  0.00, y: 0.50, z:  0.00, w: 2.20, h: 1.60, d: 0.60, material: "metal" },
  { type: "cylinder", x:  1.10, y: 0.50, z:  0.00, w: 0.60, h: 1.60, d: 0.60, material: "metal" },
  { type: "cylinder", x: -1.10, y: 0.50, z:  0.00, w: 0.60, h: 1.60, d: 0.60, material: "metal" },
  { type: "box",      x:  1.10, y: 0.50, z:  0.32, w: 0.60, h: 1.60, d: 0.60, material: "metal" },
  { type: "cylinder", x:  1.10, y: 0.50, z:  0.62, w: 0.60, h: 1.60, d: 0.60, material: "metal" },

  // ── Задняя часть корпуса ────────────────────────────────
  { type: "box",      x:  0.00, y: 0.50, z: -0.28, w: 2.10, h: 1.40, d: 0.10, material: "wood" },

  // ── Экран — рисуется как МАСКА-ОКНО, не как box ─────────
  { type: "box",      x:  0.00, y: 0.50, z: -0.31, w: 1.86, h: 1.16, d: 0.10, material: "wood",
    color: "#000000", role: "screen" },

  // ── Объектив ────────────────────────────────────────────
  { type: "cylinder", x: -0.24, y: 0.50, z: 0.57, rx: 1.5708, w: 1.12, h: 0.60, d: 1.12, material: "metal", color: "#424242" },
  { type: "cylinder", x: -0.24, y: 0.50, z: 0.67, rx: 1.5708, w: 1.23, h: 0.36, d: 1.23, material: "metal" },
  { type: "cylinder", x: -0.24, y: 0.50, z: 0.65, rx: 1.5708, w: 1.00, h: 0.60, d: 1.00, material: "metal", color: "#000000" },
  { type: "cylinder", x: -0.04, y: 0.76, z: 0.66, rx: 1.5708, w: 0.20, h: 0.60, d: 1.00, material: "metal", color: "#ffffff" },

  // ── Кнопка спуска ───────────────────────────────────────
  { type: "cylinder", x:  1.10, y: 1.34, z: -0.02, w: 0.40, h: 0.20, d: 0.40, material: "metal", color: "#711414" },

  // ── Призма / видоискатель ───────────────────────────────
  { type: "box",      x: -0.24, y: 1.47, z:  0.10, w: 1.30, h: 0.50, d: 0.80, material: "metal" },
  { type: "box",      x: -0.24, y: 1.48, z: -0.31, w: 1.00, h: 0.33, d: 0.10, material: "wood", color: "#000000" },
];

// ── Материалы для частей камеры ──────────────────────────────

const FALLBACK_COLORS: Record<CamPart["material"], [number, number, number]> = {
  stone:     [0.55, 0.46, 0.33],
  darkStone: [0.28, 0.22, 0.16],
  sand:      [0.85, 0.70, 0.45],
  metal:     [0.50, 0.52, 0.55],
  wood:      [0.32, 0.22, 0.12],
  water:     [0.15, 0.40, 0.65],
};

// ═══════════════════════════════════════════════════════════════
//  КЕШ ТЕКСТУР, ПРИВЯЗАННЫЙ К СЦЕНЕ
// ═══════════════════════════════════════════════════════════════
//
//  ВАЖНО: кеш глобальный — раньше текстуры жили между сценами,
//  и при переходе фура → пирамида старые текстуры оставались в кеше,
//  но были привязаны к УЖЕ УНИЧТОЖЕННОЙ сцене. Материал получал
//  мёртвую текстуру → чёрный или невидимый меш.
//
//  Решение: WeakMap<Scene, Map<...>>. Каждая сцена имеет свой кеш,
//  при уничтожении сцены он автоматически собирается GC.

const CAM_TEX_CACHE = new WeakMap<Scene, Map<string, Texture | null>>();

function getTexCache(scene: Scene): Map<string, Texture | null> {
  let cache = CAM_TEX_CACHE.get(scene);
  if (!cache) {
    cache = new Map();
    CAM_TEX_CACHE.set(scene, cache);
  }
  return cache;
}

function loadCamTexture(scene: Scene, matId: string): Texture | null {
  const cache = getTexCache(scene);
  if (cache.has(matId)) {
    return cache.get(matId) ?? null;
  }
  const def = TEXTURES.find((t) => t.id === matId);
  if (!def) {
    cache.set(matId, null);
    return null;
  }
  try {
    const tex = new Texture(def.path, scene, false, true, Texture.TRILINEAR_SAMPLINGMODE);
    tex.uScale = 1;
    tex.vScale = 1;
    cache.set(matId, tex);
    return tex;
  } catch {
    cache.set(matId, null);
    return null;
  }
}

function makeCamPartMaterial(
  scene: Scene,
  part: CamPart,
  cache: Map<string, StandardMaterial>
): StandardMaterial {
  const key = `${part.material}|${part.color ?? ""}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const mat = new StandardMaterial(`cam_mat_${cache.size}`, scene);

  if (part.color) {
    const c = Color3.FromHexString(part.color);
    mat.diffuseColor = c;
    mat.emissiveColor = new Color3(c.r * 0.05, c.g * 0.05, c.b * 0.05);
  } else {
    const tex = loadCamTexture(scene, part.material);
    if (tex) {
      mat.diffuseTexture = tex;
      mat.diffuseColor = new Color3(1, 1, 1);
      mat.emissiveColor = new Color3(0.08, 0.08, 0.08);
    } else {
      const [r, g, b] = FALLBACK_COLORS[part.material];
      mat.diffuseColor = new Color3(r, g, b);
    }
  }

  mat.specularColor = new Color3(0.15, 0.15, 0.15);
  mat.maxSimultaneousLights = 8;
  cache.set(key, mat);
  return mat;
}

// ── Сборка модели из частей (все — Group 2) ──────────────────

function buildCameraBody(
  scene: Scene,
  parent: TransformNode,
  renderingGroup: number
): AbstractMesh[] {
  const out: AbstractMesh[] = [];
  const matCache = new Map<string, StandardMaterial>();

  for (const part of CAMERA_PARTS) {
    // Экран — НЕ рисуем. Вместо него будет маска.
    if (part.role === "screen") continue;

    let mesh: Mesh;
    if (part.type === "cylinder") {
      mesh = MeshBuilder.CreateCylinder(`${part.material}_cyl`,
        { height: part.h * S, diameter: part.w * S, tessellation: 24 }, scene);
    } else {
      mesh = MeshBuilder.CreateBox(`${part.material}_box`,
        { width: part.w * S, height: part.h * S, depth: part.d * S }, scene);
    }

    mesh.position.set(part.x * S, part.y * S, part.z * S);
    if (part.rx) mesh.rotation.x = part.rx;
    if (part.ry) mesh.rotation.y = part.ry;
    if (part.rz) mesh.rotation.z = part.rz;
    mesh.material = makeCamPartMaterial(scene, part, matCache);
    mesh.parent = parent;
    mesh.isPickable = false;
    mesh.renderingGroupId = renderingGroup;
    out.push(mesh);
  }

  return out;
}

// ═══════════════════════════════════════════════════════════════
//  WORLD-МОДЕЛЬ (на столе)
// ═══════════════════════════════════════════════════════════════

export function createCameraWorldPlaceholder(scene: Scene): PlaceholderResult {
  const root = new TransformNode("cameraWorldRoot", scene);

  // В мире тоже рисуем «окно» — но вместо маски чёрная плоскость,
  // чтобы на столе камера выглядела целой.
  const meshes = buildCameraBody(scene, root, 0);

  // Чёрный экран в world-версии (обычный box, не маска).
  const screenMat = new StandardMaterial("cam_screen_world", scene);
  screenMat.diffuseColor = new Color3(0.02, 0.02, 0.03);
  screenMat.emissiveColor = new Color3(0.01, 0.01, 0.015);
  screenMat.specularColor = new Color3(0, 0, 0);
  screenMat.maxSimultaneousLights = 8;

  const screenBox = MeshBuilder.CreateBox("camScreenWorld",
    { width: 1.86 * S, height: 1.16 * S, depth: 0.02 }, scene);
  screenBox.position.set(0 * S, 0.5 * S, -0.31 * S);
  screenBox.material = screenMat;
  screenBox.parent = root;
  screenBox.isPickable = false;
  meshes.push(screenBox);

  // Триггер для interaction.
  const trigger = MeshBuilder.CreateBox("camTrigger",
    { width: 0.35, height: 0.25, depth: 0.3 }, scene);
  trigger.position.set(0, 0.05, 0);
  trigger.visibility = 0;
  trigger.isPickable = true;
  trigger.checkCollisions = false;
  trigger.parent = root;
  meshes.push(trigger);

  return { root, meshes };
}

// ═══════════════════════════════════════════════════════════════
//  VIEWMODEL (в руке) — с маской-окном
// ═══════════════════════════════════════════════════════════════
//
//  Порядок рендера:
//    Group 0 — мир + сетка видоискателя
//    Group 1 — маска (пишет только depth, не цвет)
//    Group 2 — корпус камеры (не рисуется в области маски)
//
//  В результате игрок видит мир сквозь окно в задней стенке корпуса,
//  а сверху — сетку видоискателя.

export function createCameraViewModelPlaceholder(
  scene: Scene
): PlaceholderResult {
  const root = new TransformNode("cameraViewModelRoot", scene);

  // ── Корпус и объектив — Group 2 ─────────────────────────
  const meshes = buildCameraBody(scene, root, 2);

  // ── Маска-окно — Group 1 ────────────────────────────────
  // Плоскость с disableColorWrite: пишет depth, но не цвет.
  // В её области корпус (Group 2) не рисуется — открывается
  // окно в мир, который был отрендерен в Group 0.
  //
  // Z = -0.05 — перед задней стенкой корпуса (-0.03), с
  // запасом 20 мм. Плоскость повёрнута нормалью к игроку
  // (rotation.y = PI, т.к. по умолчанию нормаль смотрит в -Z).
  const maskMat = new StandardMaterial("cam_mask", scene);
  maskMat.disableColorWrite = true;
  maskMat.disableDepthWrite = false;
  // Без этого маска не рендерится, потому что после rotation.y = PI
  // её лицевая сторона отвёрнута от игрока — а мы смотрим на изнанку.
  maskMat.backFaceCulling = false;
  maskMat.diffuseColor = new Color3(0, 0, 0);
  maskMat.specularColor = new Color3(0, 0, 0);
  maskMat.maxSimultaneousLights = 0;

  const mask = MeshBuilder.CreatePlane("camMask",
    { width: 1.86 * S, height: 1.16 * S }, scene);
  mask.position.set(0, 0.5 * S, -0.05);
  mask.rotation.y = Math.PI;
  mask.material = maskMat;
  mask.parent = root;
  mask.isPickable = false;
  mask.renderingGroupId = 1;
  meshes.push(mask);

  // ── Сетка видоискателя — Group 0 ────────────────────────
  // Рендерится вместе с миром, поверх него. Через маску
  // (disableColorWrite) видна вместе с миром.
  const GW = 512;
  const GH = 340;
  const dt = new DynamicTexture("ph_vmGrid", { width: GW, height: GH }, scene, true);
  dt.hasAlpha = true;

  const g = dt.getContext() as unknown as CanvasRenderingContext2D;
  g.clearRect(0, 0, GW, GH);

  // Сетка третей
  g.strokeStyle = "rgba(255,255,255,0.35)";
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(GW / 3, 0); g.lineTo(GW / 3, GH);
  g.moveTo(GW * 2 / 3, 0); g.lineTo(GW * 2 / 3, GH);
  g.moveTo(0, GH / 3); g.lineTo(GW, GH / 3);
  g.moveTo(0, GH * 2 / 3); g.lineTo(GW, GH * 2 / 3);
  g.stroke();

  // Перекрестие
  g.strokeStyle = "rgba(255,255,255,0.9)";
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(GW / 2 - 28, GH / 2); g.lineTo(GW / 2 - 10, GH / 2);
  g.moveTo(GW / 2 + 10, GH / 2); g.lineTo(GW / 2 + 28, GH / 2);
  g.moveTo(GW / 2, GH / 2 - 28); g.lineTo(GW / 2, GH / 2 - 10);
  g.moveTo(GW / 2, GH / 2 + 10); g.lineTo(GW / 2, GH / 2 + 28);
  g.stroke();

  // Уголки
  const CM = 18;
  const CL = 44;
  g.strokeStyle = "rgba(255,255,255,0.9)";
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(CM, CM + CL); g.lineTo(CM, CM); g.lineTo(CM + CL, CM);
  g.moveTo(GW - CM - CL, CM); g.lineTo(GW - CM, CM); g.lineTo(GW - CM, CM + CL);
  g.moveTo(CM, GH - CM - CL); g.lineTo(CM, GH - CM); g.lineTo(CM + CL, GH - CM);
  g.moveTo(GW - CM - CL, GH - CM); g.lineTo(GW - CM, GH - CM); g.lineTo(GW - CM, GH - CM - CL);
  g.stroke();

  // REC — координаты и текст
  const recX = CM + CL + 26;
  const recY = CM + 22;

  g.font = "bold 20px Consolas, monospace";
  g.fillStyle = "rgba(244,67,54,1)";
  g.textAlign = "left";
  g.fillText("REC", recX + 14, recY + 7);

  g.fillStyle = "rgba(255,255,255,0.75)";
  g.font = "18px Consolas, monospace";
  g.textAlign = "right";
  g.fillText("AUTO", GW - recX, recY + 7);

  g.textAlign = "center";
  g.fillStyle = "rgba(255,255,255,0.6)";
  g.font = "16px Consolas, monospace";
  g.fillText("+10", GW / 2, CM + 16);
  g.fillText("-10", GW / 2, GH - CM - 6);
  g.fillText("10",  CM + 16, GH / 2 + 6);
  g.fillText("10",  GW - CM - 16, GH / 2 + 6);

  g.textAlign = "left";
  g.fillStyle = "rgba(255,255,255,0.75)";
  g.fillText("f/2.8", CM + 40, GH - CM - 6);
  g.textAlign = "right";
  g.fillText("+0.0", GW - CM - 40, GH - CM - 6);

  // Батарея
  const batW = 100;
  const batH = 14;
  const batX = GW / 2 - batW / 2;
  const batY = GH - 62;
  g.strokeStyle = "rgba(255,255,255,0.7)";
  g.lineWidth = 2;
  g.textAlign = "left";
  g.strokeRect(batX, batY, batW, batH);
  g.fillStyle = "rgba(255,255,255,0.7)";
  g.fillRect(batX + batW, batY + 4, 4, batH - 8);
  const cellW = (batW - 8) / 4;
  g.fillStyle = "rgba(76,175,80,0.95)";
  for (let k = 0; k < 4; k++) {
    g.fillRect(batX + 4 + k * cellW, batY + 4, cellW - 2, batH - 8);
  }

  dt.update();

  const gridMat = new StandardMaterial("ph_vmGridMat", scene);
  gridMat.emissiveTexture = dt;
  gridMat.emissiveColor = new Color3(1, 1, 1);
  gridMat.diffuseTexture = dt;
  gridMat.diffuseColor = new Color3(1, 1, 1);
  gridMat.specularColor = new Color3(0, 0, 0);
  gridMat.useAlphaFromDiffuseTexture = true;
  gridMat.disableLighting = true;
  gridMat.backFaceCulling = false;
  gridMat.disableDepthWrite = true;
  gridMat.maxSimultaneousLights = 0;

  const gridPlane = MeshBuilder.CreatePlane("vmGrid",
    { width: 1.86 * S, height: 1.16 * S }, scene);
  gridPlane.position.set(0, 0.5 * S, -0.052);
  gridPlane.material = gridMat;
  gridPlane.parent = root;
  gridPlane.isPickable = false;
  gridPlane.renderingGroupId = 0;
  meshes.push(gridPlane);

  // ── REC — мигание ───────────────────────────────────────
  const redrawRec = (visible: boolean): void => {
    const ctx = dt.getContext() as unknown as CanvasRenderingContext2D;
    ctx.clearRect(recX - 10, recY - 10, 20, 20);
    if (visible) {
      ctx.fillStyle = "rgba(244,67,54,1)";
      ctx.beginPath();
      ctx.arc(recX, recY, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    dt.update();
  };
  redrawRec(true);

  return { root, meshes, redrawRec };
}
  
  /** Простой камень на песке (для дорожки). */
  export function createPathStone(scene: Scene, name: string): Mesh {
    const mat = new StandardMaterial(`${name}_mat`, scene);
    mat.diffuseColor = new Color3(0.55, 0.5, 0.4);
    mat.specularColor = Color3.Black();
    const m = MeshBuilder.CreateBox(name, { width: 1.0, height: 0.12, depth: 1.6 }, scene);
    m.material = mat;
    m.checkCollisions = false;
    return m;
  }
  
  /** Заглушка для фуры снаружи. */
  export function createTruckExterior(scene: Scene): TransformNode {
    const root = new TransformNode("truckExtRoot", scene);
  
    const bodyMat = new StandardMaterial("truckExtMat", scene);
    bodyMat.diffuseColor = new Color3(0.22, 0.23, 0.25);
    bodyMat.specularColor = new Color3(0.08, 0.08, 0.08);
  
    const wheelMat = new StandardMaterial("wheelMat", scene);
    wheelMat.diffuseColor = new Color3(0.1, 0.1, 0.1);
  
    const body = MeshBuilder.CreateBox("extTruck", { width: 6, height: 3, depth: 3 }, scene);
    body.position.set(0, 1.5, 0);
    body.material = bodyMat;
    body.parent = root;
    body.checkCollisions = true;
  
    const cabin = MeshBuilder.CreateBox("extCabin", { width: 2.2, height: 2.4, depth: 2.8 }, scene);
    cabin.position.set(3.8, 1.4, 0);
    cabin.material = bodyMat;
    cabin.parent = root;
    cabin.checkCollisions = true;
  
    for (const [x, z] of [[-2, 1.3], [-2, -1.3], [2, 1.3], [2, -1.3]]) {
      const w = MeshBuilder.CreateCylinder("wheel", { height: 0.4, diameter: 1.1, tessellation: 12 }, scene);
      w.rotation.z = Math.PI / 2;
      w.position.set(x, 0.55, z);
      w.material = wheelMat;
      w.parent = root;
    }
  
    return root;
  }
  
  /** Заглушка для пирамиды. */
  export function createPyramidExterior(scene: Scene): TransformNode {
    const root = new TransformNode("pyramidRoot", scene);
  
    const mat = new StandardMaterial("pyramidMat", scene);
    mat.diffuseColor = new Color3(0.8, 0.7, 0.5);
    mat.specularColor = new Color3(0.05, 0.05, 0.04);
    mat.ambientColor = new Color3(0.25, 0.2, 0.12);
  
    const levels = [
      { y: 1.5, s: 28 },
      { y: 5, s: 20 },
      { y: 8.5, s: 12 },
      { y: 11.5, s: 5 },
    ];
    for (const lv of levels) {
      const box = MeshBuilder.CreateBox("pyrLv", { width: lv.s, height: 3.2, depth: lv.s }, scene);
      box.position.set(0, lv.y, 0);
      box.material = mat;
      box.parent = root;
      box.checkCollisions = true;
    }
    return root;
  }
  
  /** Заглушка для дыры входа в пирамиду. */
  export function createPyramidEntrance(scene: Scene): Mesh {
    const dark = new StandardMaterial("entranceDark", scene);
    dark.diffuseColor = new Color3(0.02, 0.02, 0.03);
    dark.emissiveColor = new Color3(0.01, 0.01, 0.015);
  
    const entrance = MeshBuilder.CreateBox("pyrEntrance", { width: 3.2, height: 3.5, depth: 4 }, scene);
    entrance.material = dark;
    entrance.checkCollisions = false;
    return entrance;
  }