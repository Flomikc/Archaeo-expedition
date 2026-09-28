import { AbstractMesh, Ray, Scene, UniversalCamera, Vector3 } from "@babylonjs/core";

export interface Interactable {
  mesh: AbstractMesh;
  hint: string;
  range: number;
  enabled?: () => boolean;
  onInteract: () => void;
}

export class InteractionSystem {
  private readonly items: Interactable[] = [];
  private current: Interactable | null = null;

  constructor(
    private readonly scene: Scene,
    private readonly camera: UniversalCamera
  ) {}

  register(item: Interactable): void {
    this.items.push(item);
  }

  clear(): void {
    this.items.length = 0;
    this.current = null;
  }

  dispose(): void {
    this.clear();
  }

  update(): void {
    this.current = this.findTarget();
  }

  getHint(): string | null {
    return this.current ? this.current.hint : null;
  }

  interact(): boolean {
    if (!this.current) return false;
    this.current.onInteract();
    return true;
  }

  private isAvailable(item: Interactable): boolean {
    if (item.enabled && !item.enabled()) return false;
    return item.mesh.isEnabled() && item.mesh.isVisible;
  }

  private findTarget(): Interactable | null {
    const origin = this.camera.position;
    const direction = this.camera.getDirection(Vector3.Forward());

    let best: Interactable | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const item of this.items) {
      if (!this.isAvailable(item)) continue;

      const ray = new Ray(origin.clone(), direction.clone(), item.range);
      const pick = this.scene.pickWithRay(ray, (mesh) => mesh === item.mesh);

      if (pick && pick.hit && pick.pickedMesh === item.mesh && pick.distance < bestDistance) {
        bestDistance = pick.distance;
        best = item;
      }
    }

    return best;
  }
}