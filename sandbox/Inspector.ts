import {
  AbstractMesh,
  PointerEventTypes,
  Scene,
} from "@babylonjs/core";

interface InspectorCallbacks {
  onMeshPicked: (mesh: AbstractMesh | null) => void;
}

/**
 * Слушает клики по сцене и передаёт выбранный меш в UI-панель.
 */
export class Inspector {
  private readonly scene: Scene;
  private readonly callbacks: InspectorCallbacks;

  constructor(scene: Scene, callbacks: InspectorCallbacks) {
    this.scene = scene;
    this.callbacks = callbacks;

    scene.onPointerObservable.add((info) => {
      if (info.type !== PointerEventTypes.POINTERDOWN) return;
      // Игнорируем клики с pointer lock (это вращение камеры)
      if (document.pointerLockElement) return;

      const pick = info.pickInfo;
      if (pick && pick.hit && pick.pickedMesh) {
        this.callbacks.onMeshPicked(pick.pickedMesh);
      } else {
        this.callbacks.onMeshPicked(null);
      }
    });
  }
}

/**
 * Форматирует информацию о меше в HTML.
 */
export function renderMeshInfo(mesh: AbstractMesh | null): string {
  if (!mesh) return "";

  const bounding = mesh.getBoundingInfo().boundingBox;
  const size = bounding.extendSizeWorld.scale(2);
  const pos = mesh.position;

  const matName = (mesh.material && "name" in mesh.material)
    ? (mesh.material as { name: string }).name
    : "—";

  const row = (label: string, value: string) =>
    `<div class="row"><span>${label}</span><b>${value}</b></div>`;

  return [
    `<div class="mesh-name">${escapeHtml(mesh.name)}</div>`,
    row("Позиция X", pos.x.toFixed(2)),
    row("Позиция Y", pos.y.toFixed(2)),
    row("Позиция Z", pos.z.toFixed(2)),
    row("Размер X", size.x.toFixed(2)),
    row("Размер Y", size.y.toFixed(2)),
    row("Размер Z", size.z.toFixed(2)),
    row("Материал", escapeHtml(matName)),
    row("Видим", mesh.isEnabled() ? "да" : "нет"),
  ].join("");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}