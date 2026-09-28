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
  
  /** Фотоаппарат world-модель (на столе). */
  export function createCameraWorldPlaceholder(scene: Scene): PlaceholderResult {
    const root = new TransformNode("cameraWorldRoot", scene);
  
    const bodyMat = new StandardMaterial("ph_camBody", scene);
    bodyMat.diffuseColor = new Color3(0.15, 0.15, 0.18);
    bodyMat.specularColor = new Color3(0.15, 0.15, 0.15);
  
    const lensMat = new StandardMaterial("ph_camLens", scene);
    lensMat.diffuseColor = new Color3(0.08, 0.1, 0.14);
    lensMat.emissiveColor = new Color3(0.02, 0.04, 0.06);
  
    const body = MeshBuilder.CreateBox("camBody", { width: 0.32, height: 0.2, depth: 0.18 }, scene);
    body.position.set(0, 0.1, 0);
    body.material = bodyMat;
    body.parent = root;
    body.isPickable = true;
    body.checkCollisions = false;
  
    const lens = MeshBuilder.CreateCylinder("camLens", { height: 0.12, diameter: 0.1, tessellation: 12 }, scene);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(0, 0.1, 0.14);
    lens.material = lensMat;
    lens.parent = root;
    lens.isPickable = true;
  
    const trigger = MeshBuilder.CreateBox("camTrigger", { width: 0.6, height: 0.5, depth: 0.5 }, scene);
    trigger.position.set(0, 0.15, 0);
    trigger.visibility = 0;
    trigger.isPickable = true;
    trigger.checkCollisions = false;
    trigger.parent = root;
  
    return { root, meshes: [body, lens, trigger] };
  }
  
  /** Фотоаппарат viewmodel (в руке игрока). */
  export function createCameraViewModelPlaceholder(scene: Scene): PlaceholderResult {
    const root = new TransformNode("cameraViewModelRoot", scene);
  
    const bodyMat = new StandardMaterial("ph_vmBody", scene);
    bodyMat.diffuseColor = new Color3(0.18, 0.18, 0.2);
    bodyMat.specularColor = new Color3(0.2, 0.2, 0.2);
  
    const lensMat = new StandardMaterial("ph_vmLens", scene);
    lensMat.diffuseColor = new Color3(0.1, 0.12, 0.16);
    lensMat.emissiveColor = new Color3(0.03, 0.05, 0.08);
  
    const body = MeshBuilder.CreateBox("vmBody", { width: 0.14, height: 0.09, depth: 0.08 }, scene);
    body.material = bodyMat;
    body.parent = root;
    body.isPickable = false;
  
    const lens = MeshBuilder.CreateCylinder("vmLens", { height: 0.06, diameter: 0.05, tessellation: 10 }, scene);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(0, 0, 0.06);
    lens.material = lensMat;
    lens.parent = root;
    lens.isPickable = false;
  
    return { root, meshes: [body, lens] };
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