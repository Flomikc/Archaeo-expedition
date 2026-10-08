import {
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Texture,
} from "@babylonjs/core";

import { TEXTURES } from "../../src/data/textures";

// ============================================================
//  ТИПЫ ОБЪЕКТОВ
// ============================================================

export type ShapeKind = "box" | "cylinder" | "sphere";

export interface TexDefaults {
  uScale: number;
  vScale: number;
  uOffset: number;
  vOffset: number;
  wAng: number;
}

export interface ObjectTypeDef {
  type: string;
  label: string;
  shape: ShapeKind;
  defaultW: number;
  defaultH: number;
  defaultD: number;
  defaultMaterial: string;
  cylinderTessellation?: number;
  /** Дефолтные параметры текстуры (переопределяют реестр). */
  defaultTex?: TexDefaults;
}

export const OBJECT_TYPES: ObjectTypeDef[] = [
  {
    type: "floor",
    label: "Пол",
    shape: "box",
    defaultW: 18, defaultH: 0.2, defaultD: 18,
    defaultMaterial: "sand",
  },
  {
    type: "ceiling",
    label: "Потолок",
    shape: "box",
    defaultW: 18, defaultH: 0.2, defaultD: 18,
    defaultMaterial: "darkStone",
  },
  {
    type: "wall",
    label: "Стена (светлая)",
    shape: "box",
    defaultW: 18, defaultH: 4.5, defaultD: 0.5,
    defaultMaterial: "stone",
  },
  {
    type: "wall_dark",
    label: "Стена (тёмная)",
    shape: "box",
    defaultW: 18, defaultH: 4.5, defaultD: 0.5,
    defaultMaterial: "darkStone",
  },
  {
    type: "column",
    label: "Колонна",
    shape: "cylinder",
    defaultW: 0.8, defaultH: 4.5, defaultD: 0.8,
    defaultMaterial: "stone",
    cylinderTessellation: 16,
  },
  {
    type: "pedestal",
    label: "Пьедестал",
    shape: "box",
    defaultW: 1.2, defaultH: 1.0, defaultD: 1.2,
    defaultMaterial: "stone",
  },
  {
    type: "platform",
    label: "Платформа",
    shape: "box",
    defaultW: 2.0, defaultH: 0.3, defaultD: 2.0,
    defaultMaterial: "darkStone",
  },
  {
    type: "water",
    label: "Вода",
    shape: "box",
    defaultW: 18, defaultH: 0.05, defaultD: 18,
    defaultMaterial: "water",
  },
  {
    type: "spike",
    label: "Шип",
    shape: "cylinder",
    defaultW: 0.15, defaultH: 0.6, defaultD: 0.15,
    defaultMaterial: "metal",
    cylinderTessellation: 8,
  },
  {
    type: "box",
    label: "Куб (универсальный)",
    shape: "box",
    defaultW: 1, defaultH: 1, defaultD: 1,
    defaultMaterial: "stone",
  },
  {
    type: "sphere",
    label: "Сфера",
    shape: "sphere",
    defaultW: 1.0, defaultH: 1.0, defaultD: 1.0,
    defaultMaterial: "stone",
  },
];

// ============================================================
//  МАТЕРИАЛЫ РЕДАКТОРА
// ============================================================
//
// Каждый материал — с текстурой (если файл есть) и fallback-цветом.
// getCloned() создаёт копию материала + копию текстуры, чтобы
// каждый объект мог крутить tex независимо.

export class EditorMaterials {
  private readonly map = new Map<string, StandardMaterial>();

  constructor(scene: Scene) {
    for (const def of TEXTURES) {
      const mat = new StandardMaterial(`mat_${def.id}`, scene);

      try {
        const tex = new Texture(
          def.path,
          scene,
          false,
          true,
          Texture.TRILINEAR_SAMPLINGMODE
        );
        tex.uScale = def.uScale;
        tex.vScale = def.vScale;
        mat.diffuseTexture = tex;
      } catch {
        /* оставим fallback-цвет */
      }

      const [r, g, b] = def.fallbackColor;
      mat.diffuseColor = new Color3(r, g, b);
      mat.specularColor = new Color3(0.05, 0.05, 0.05);

      if (def.alpha !== undefined) {
        mat.alpha = def.alpha;
        if (def.alpha < 1) mat.backFaceCulling = false;
      }

      this.map.set(def.id, mat);
    }

    // Служебный материал для неизвестных id
    const fallback = new StandardMaterial("mat___default", scene);
    fallback.diffuseColor = new Color3(1, 0.1, 0.1);
    this.map.set("__default", fallback);
  }

  get(name: string): StandardMaterial {
    return this.map.get(name) ?? this.map.get("__default")!;
  }

  /**
   * Клон материала с копией текстуры — каждому объекту свой,
   * чтобы текстуру можно было крутить независимо.
   */
  getCloned(name: string): StandardMaterial {
    const base = this.get(name);
    const clone = base.clone(`mat_${name}_inst`);
    if (base.diffuseTexture) {
      clone.diffuseTexture = base.diffuseTexture.clone();
    }
    return clone;
  }

  /** Список доступных ID для UI. */
  getIds(): string[] {
    return TEXTURES.map((t) => t.id);
  }

  dispose(): void {
    for (const m of this.map.values()) {
      if (m.diffuseTexture) m.diffuseTexture.dispose();
      m.dispose();
    }
    this.map.clear();
  }
}

// ============================================================
//  СОЗДАНИЕ МЕША ПО ТИПУ
// ============================================================

export function spawnByType(
  scene: Scene,
  def: ObjectTypeDef,
  materials: EditorMaterials
): Mesh {
  let mesh: Mesh;

  if (def.shape === "cylinder") {
    mesh = MeshBuilder.CreateCylinder(
      def.type,
      {
        height: def.defaultH,
        diameter: def.defaultW,
        tessellation: def.cylinderTessellation ?? 12,
      },
      scene
    );
    mesh.metadata = {
      type: def.type,
      shape: "cylinder",
      w: def.defaultW, h: def.defaultH, d: def.defaultD,
      material: def.defaultMaterial,
      isCylinder: true,
    };
  } else if (def.shape === "sphere") {
    mesh = MeshBuilder.CreateSphere(
      def.type,
      { diameter: def.defaultW, segments: 16 },
      scene
    );
    mesh.metadata = {
      type: def.type,
      shape: "sphere",
      w: def.defaultW, h: def.defaultW, d: def.defaultW,
      material: def.defaultMaterial,
      isCylinder: false,
    };
  } else {
    mesh = MeshBuilder.CreateBox(
      def.type,
      { width: def.defaultW, height: def.defaultH, depth: def.defaultD },
      scene
    );
    mesh.metadata = {
      type: def.type,
      shape: "box",
      w: def.defaultW, h: def.defaultH, d: def.defaultD,
      material: def.defaultMaterial,
      isCylinder: false,
    };
  }

  mesh.material = materials.getCloned(def.defaultMaterial);

  const tex = (mesh.material as StandardMaterial).diffuseTexture as Texture | null;
  if (tex) {
    // Читаем tex-параметры материала и сохраняем в metadata.
    const uScale = tex.uScale;
    const vScale = tex.vScale;
    const uOffset = tex.uOffset;
    const vOffset = tex.vOffset;
    const wAng = tex.wAng;

    const existingMeta = mesh.metadata as Record<string, unknown>;
    mesh.metadata = {
      ...existingMeta,
      tex: { uScale, vScale, uOffset, vOffset, wAng },
    };
  }

  mesh.isPickable = true;
  mesh.checkCollisions = false;
  return mesh;
}

// ============================================================
//  УТИЛИТА: прилипание к полу
// ============================================================

export function placeAtCenter(mesh: Mesh): void {
  const meta = mesh.metadata as { h: number };
  mesh.position.set(0, meta.h / 2, 0);
  mesh.rotation.set(0, 0, 0);
}