import { Mesh } from "@babylonjs/core";

import { EditorScene } from "./EditorScene";
import { EditorUI } from "./EditorUI";

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Не найден элемент #${id}`);
  return node as T;
}

const canvas = el<HTMLCanvasElement>("editor-canvas");

let ui: EditorUI | null = null;

const callbacks = {
  onSelectionChanged: (mesh: Mesh | null) => {
    if (ui) ui.refreshInspector(mesh);
  },
  onObjectsChanged: (meshes: Mesh[]) => {
    if (ui) ui.refreshObjectList(meshes);
  },
};

const editor = new EditorScene(canvas, callbacks);
ui = new EditorUI(editor);

ui.refreshObjectList(editor.getObjects());
ui.refreshInspector(null);

// ── Горячие клавиши ─────────────────────────────────────────
function focusIsInField(): boolean {
  const ae = document.activeElement as HTMLElement | null;
  if (!ae) return false;
  const tag = ae.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (ae.isContentEditable) return true;
  return false;
}

document.addEventListener("keydown", (e) => {
  if (focusIsInField()) return;

  if (e.code === "Delete" || e.code === "Backspace") {
    e.preventDefault();
    editor.deleteSelected();
    return;
  }
  if (e.code === "KeyD" && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    editor.duplicateSelected();
    return;
  }
  if (e.code === "Escape") {
    editor.select(null);
    return;
  }
});

// ── Авто-обновление инспектора при движении гизмо ───────────
let lastPos = { x: 0, y: 0, z: 0 };
let lastRot = { x: 0, y: 0, z: 0 };

editor.engine.runRenderLoop(() => {
  const selected = editor.gizmos.attachedMesh;
  if (selected instanceof Mesh && ui) {
    const p = selected.position;
    const r = selected.rotation;

    const posChanged =
      Math.abs(p.x - lastPos.x) > 0.001 ||
      Math.abs(p.y - lastPos.y) > 0.001 ||
      Math.abs(p.z - lastPos.z) > 0.001;

    const rotChanged =
      Math.abs(r.x - lastRot.x) > 0.001 ||
      Math.abs(r.y - lastRot.y) > 0.001 ||
      Math.abs(r.z - lastRot.z) > 0.001;

    if (posChanged || rotChanged) {
      lastPos = { x: p.x, y: p.y, z: p.z };
      lastRot = { x: r.x, y: r.y, z: r.z };
      ui.updateInspectorValues(selected);
    }
  }
});