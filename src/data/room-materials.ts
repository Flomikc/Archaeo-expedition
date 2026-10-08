import {
  Color3,
  Scene,
  StandardMaterial,
  Texture,
} from "@babylonjs/core";

import type { RoomMaterials } from "./RoomBlueprint";

/**
 * Создаёт общий набор материалов для всех комнат уровня.
 * Вызывается ОДИН раз в GridLevelGenerator.build(), результат
 * кладётся в каждый RoomContext.materials — чтобы blueprint'ы
 * не плодили копии.
 */
export function createRoomMaterials(scene: Scene): RoomMaterials {
  // ── КАМЕНЬ (стены, колонны) ────────────────────────────
  const stone = makeTexturedMat(
    scene, "stone", "/textures/stone.jpg",
    6, 2,
    new Color3(0.55, 0.46, 0.33)
  );

  // ── ТЁМНЫЙ КАМЕНЬ ──────────────────────────────────────
  const darkStone = makeTexturedMat(
    scene, "darkStone", "/textures/stone_dark.jpg",
    6, 2,
    new Color3(0.30, 0.24, 0.18)
  );

  // ── ПЕСОК ──────────────────────────────────────────────
  const sand = makeTexturedMat(
    scene, "sand", "/textures/sand.jpg",
    6, 6,
    new Color3(0.85, 0.70, 0.45)
  );
  sand.emissiveColor = new Color3(0.10, 0.08, 0.05);

  // ── МЕТАЛЛ ─────────────────────────────────────────────
  const metal = makeTexturedMat(
    scene, "metal", "/textures/metal.jpg",
    2, 2,
    new Color3(0.40, 0.42, 0.45)
  );

  // ── ДЕРЕВО ─────────────────────────────────────────────
  const wood = makeTexturedMat(
    scene, "wood", "/textures/wood.jpg",
    1, 1,
    new Color3(0.32, 0.22, 0.12)
  );

  // ── ВОДА ───────────────────────────────────────────────
  const water = makeTexturedMat(
    scene, "water", "/textures/water.jpg",
    4, 4,
    new Color3(0.15, 0.35, 0.55)
  );
  water.alpha = 0.75;
  water.emissiveColor = new Color3(0.05, 0.15, 0.25);
  water.backFaceCulling = false;

  return { stone, darkStone, sand, metal, wood, water };
}

// ────────────────────────────────────────────────────────────
//  ХЕЛПЕР
// ────────────────────────────────────────────────────────────

function makeTexturedMat(
  scene: Scene,
  name: string,
  path: string,
  uScale: number,
  vScale: number,
  fallback: Color3
): StandardMaterial {
  const mat = new StandardMaterial(`mat_${name}`, scene);
  mat.diffuseColor = fallback;
  mat.specularColor = new Color3(0.04, 0.04, 0.04);

  // ── КРИТИЧНО ─────────────────────────────────────────────
  // Babylon по умолчанию рендерит только 4 источника света
  // на материал. У нас в сцене 30+ торчей + ambient + drill +
  // фонарик. Без этого увеличения фонарик вообще не попадает
  // в шейдер.
  mat.maxSimultaneousLights = 8;

  try {
    const tex = new Texture(path, scene, false, true, Texture.TRILINEAR_SAMPLINGMODE);
    tex.uScale = uScale;
    tex.vScale = vScale;
    mat.diffuseTexture = tex;

    // Защита от чёрных материалов при 404: снимаем не загрузившуюся
    // текстуру, чтобы проявился fallback-цвет.
    Texture.OnTextureLoadErrorObservable.addOnce((failed) => {
      if (failed === tex && mat.diffuseTexture === tex) {
        mat.diffuseTexture = null;
      }
    });
  } catch {
    /* оставим fallback-цвет */
  }

  return mat;
}