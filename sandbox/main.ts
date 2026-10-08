import { Engine, Scene, Color4, Vector3 } from "@babylonjs/core";

import { FlyCamera } from "./FlyCamera";
import { RoomViewer } from "./RoomViewer";
import { GridOverlay } from "./GridOverlay";
import { Inspector, renderMeshInfo } from "./Inspector";

import { ALL_BLUEPRINTS, findBlueprint } from "../src/data/blueprints";
import { GridLevelGenerator } from "../src/systems/GridLevelGenerator";

// ────────────────────────────────────────────────────────────────
//  ДОМ-элементы
// ────────────────────────────────────────────────────────────────

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Не найден элемент #${id}`);
  return node as T;
}

const canvas = el<HTMLCanvasElement>("sandbox-canvas");
const panelRight = el<HTMLElement>("panel-right");
const inspectorBody = el<HTMLElement>("inspector-body");
const statusMode = el<HTMLElement>("status-mode");
const statusCount = el<HTMLElement>("status-count");

const blueprintSelect = el<HTMLSelectElement>("blueprint-select");
const sizeXInput = el<HTMLInputElement>("size-x");
const sizeZInput = el<HTMLInputElement>("size-z");
const sizeXValue = el<HTMLElement>("size-x-value");
const sizeZValue = el<HTMLElement>("size-z-value");

const seedInput = el<HTMLInputElement>("seed-input");
const sizeSelect = el<HTMLSelectElement>("size-select");
const btnRegenerate = el<HTMLButtonElement>("btn-regenerate");
const btnRandomSeed = el<HTMLButtonElement>("btn-random-seed");
const btnResetCamera = el<HTMLButtonElement>("btn-reset-camera");
const btnCloseInspector = el<HTMLButtonElement>("btn-close-inspector");

const singleControls = el<HTMLElement>("single-controls");
const gridControls = el<HTMLElement>("grid-controls");

// ────────────────────────────────────────────────────────────────
//  ENGINE + SCENE
// ────────────────────────────────────────────────────────────────

const engine = new Engine(canvas, true, { stencil: false }, true);
const scene = new Scene(engine);
scene.clearColor = new Color4(0.04, 0.04, 0.06, 1);

const flyCamera = new FlyCamera(scene, canvas, new Vector3(0, 6, -22));
const viewer = new RoomViewer(scene);
const overlay = new GridOverlay(scene);

// Небольшое освещение, чтобы не было черноты
import { HemisphericLight, DirectionalLight } from "@babylonjs/core";
const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
hemi.intensity = 0.6;
const dir = new DirectionalLight("dir", new Vector3(-0.4, -1, 0.3), scene);
dir.intensity = 0.8;

// ────────────────────────────────────────────────────────────────
//  INSPECTOR
// ────────────────────────────────────────────────────────────────

const inspector = new Inspector(scene, {
  onMeshPicked: (mesh) => {
    if (mesh) {
      inspectorBody.innerHTML = renderMeshInfo(mesh);
      panelRight.classList.remove("hidden");
    } else {
      panelRight.classList.add("hidden");
    }
  },
});

btnCloseInspector.addEventListener("click", () => {
  panelRight.classList.add("hidden");
});

// ────────────────────────────────────────────────────────────────
//  ЗАПОЛНЕНИЕ СПИСКА BLUEPRINT'ов
// ────────────────────────────────────────────────────────────────

// Сортируем по категории → затем по id
const sortedBps = [...ALL_BLUEPRINTS].sort((a, b) => {
  if (a.category !== b.category) return a.category.localeCompare(b.category);
  return a.id.localeCompare(b.id);
});

for (const bp of sortedBps) {
  const opt = document.createElement("option");
  opt.value = bp.id;
  opt.textContent = `[${bp.category}] ${bp.label}`;
  blueprintSelect.appendChild(opt);
}
// Выбираем что-нибудь осмысленное по умолчанию
blueprintSelect.value = "corner_ne";
if (!blueprintSelect.value) blueprintSelect.value = sortedBps[0].id;

// ────────────────────────────────────────────────────────────────
//  РЕЖИМЫ
// ────────────────────────────────────────────────────────────────

type Mode = "single" | "grid";
let currentMode: Mode = "single";

const modeRadios = document.querySelectorAll<HTMLInputElement>(
  'input[name="mode"]'
);
modeRadios.forEach((radio) => {
  radio.addEventListener("change", () => {
    if (!radio.checked) return;
    currentMode = radio.value as Mode;
    if (currentMode === "single") {
      singleControls.classList.remove("hidden");
      gridControls.classList.add("hidden");
      statusMode.textContent = "Одна комната";
      rebuild();
    } else {
      singleControls.classList.add("hidden");
      gridControls.classList.remove("hidden");
      statusMode.textContent = "Весь уровень";
      regenerateGrid();
    }
  });
});

// ────────────────────────────────────────────────────────────────
//  ОБНОВЛЕНИЕ ОДНОЙ КОМНАТЫ
// ────────────────────────────────────────────────────────────────

function rebuild(): void {
  const bp = findBlueprint(blueprintSelect.value);
  if (!bp) return;

  const sizeX = parseFloat(sizeXInput.value);
  const sizeZ = parseFloat(sizeZInput.value);

  viewer.buildSingle(bp, sizeX, sizeZ);
  overlay.buildForRoom(bp, sizeX, sizeZ);

  statusCount.textContent = `Blueprint: ${bp.id} · ${sizeX}×${sizeZ} м`;
}

sizeXInput.addEventListener("input", () => {
  sizeXValue.textContent = sizeXInput.value;
  if (currentMode === "single") rebuild();
});
sizeZInput.addEventListener("input", () => {
  sizeZValue.textContent = sizeZInput.value;
  if (currentMode === "single") rebuild();
});
blueprintSelect.addEventListener("change", () => {
  if (currentMode === "single") rebuild();
});

// ────────────────────────────────────────────────────────────────
//  ГЕНЕРАЦИЯ УРОВНЯ
// ────────────────────────────────────────────────────────────────

const gridGen = new GridLevelGenerator();

function regenerateGrid(): void {
  const seed = parseInt(seedInput.value, 10) || 12345;
  const size = sizeSelect.value as "small" | "large";

  try {
    const data = gridGen.build(scene, { size, seed });
    viewer.buildGrid(data);

    // Для уровня wireframe рисуем вокруг всего пространства
    const maxSpan = Math.max(data.gridW, data.gridD) * data.cellSize;
    const wallH = data.floors * data.floorHeight;
    overlay.buildForRoom(
      { ...findBlueprint("corner_ne")!, exits: { n: false, s: false, w: false, e: false, up: false, down: false } },
      maxSpan, maxSpan, wallH, 0, 0, 0
    );

    statusCount.textContent =
      `Seed: ${data.seed} · Комнат: ${data.rooms.length} · ` +
      `Сетка ${data.gridW}×${data.gridD}×${data.floors}`;
  } catch (e) {
    console.error(e);
    statusCount.textContent = `Ошибка: ${(e as Error).message}`;
  }
}

btnRegenerate.addEventListener("click", regenerateGrid);
btnRandomSeed.addEventListener("click", () => {
  seedInput.value = String(Math.floor(Math.random() * 1e9));
  regenerateGrid();
});

// ────────────────────────────────────────────────────────────────
//  ТУМБЛЕРЫ ОТОБРАЖЕНИЯ
// ────────────────────────────────────────────────────────────────

const toggleGrid = el<HTMLInputElement>("toggle-grid");
const toggleAxes = el<HTMLInputElement>("toggle-axes");
const toggleBounds = el<HTMLInputElement>("toggle-bounds");
const toggleDoors = el<HTMLInputElement>("toggle-doors");
const toggleWalls = el<HTMLInputElement>("toggle-walls");
const toggleFloor = el<HTMLInputElement>("toggle-floor");
const toggleCeiling = el<HTMLInputElement>("toggle-ceiling");
const toggleDecor = el<HTMLInputElement>("toggle-decor");

toggleGrid.addEventListener("change", () => overlay.setGridVisible(toggleGrid.checked));
toggleAxes.addEventListener("change", () => overlay.setAxesVisible(toggleAxes.checked));
toggleBounds.addEventListener("change", () => overlay.setBoundsVisible(toggleBounds.checked));
toggleDoors.addEventListener("change", () => overlay.setDoorsVisible(toggleDoors.checked));
toggleWalls.addEventListener("change", () => viewer.setCategoryVisible("walls", toggleWalls.checked));
toggleFloor.addEventListener("change", () => viewer.setCategoryVisible("floor", toggleFloor.checked));
toggleCeiling.addEventListener("change", () => viewer.setCategoryVisible("ceiling", toggleCeiling.checked));
toggleDecor.addEventListener("change", () => viewer.setCategoryVisible("decor", toggleDecor.checked));

// ────────────────────────────────────────────────────────────────
//  КАМЕРА
// ────────────────────────────────────────────────────────────────

btnResetCamera.addEventListener("click", () => {
  flyCamera.resetTo(new Vector3(0, 6, -22), new Vector3(0, 1.5, 0));
});

// ────────────────────────────────────────────────────────────────
//  RENDER LOOP
// ────────────────────────────────────────────────────────────────

engine.runRenderLoop(() => {
  const dt = Math.min(engine.getDeltaTime() / 1000, 0.1);
  flyCamera.update(dt);
  scene.render();
});

window.addEventListener("resize", () => engine.resize());

// ────────────────────────────────────────────────────────────────
//  СТАРТ
// ────────────────────────────────────────────────────────────────

rebuild();