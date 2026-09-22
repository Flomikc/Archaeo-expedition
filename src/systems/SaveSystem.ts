export interface SaveData {
  coins: number;
  unlockedLocations: string[];
  hasCamera: boolean;
  levelSeed: number | null;
  /** id предмета → сколько штук куплено/осталось. */
  purchasedItems: Record<string, number>;
  /** Артефакты, добытые в экспедициях. */
  artifacts: Array<{
    id: string;
    location: string;
    quality: number;
    restored: boolean;
  }>;
}

const STORAGE_KEY = "archaeo_save_v3";
const OLD_KEYS = ["archaeo_save_v2", "archaeo_save_v1"];
const DEFAULT_LOCATIONS: string[] = ["egypt"];

function emptySave(): SaveData {
  return {
    coins: 0,
    unlockedLocations: [...DEFAULT_LOCATIONS],
    hasCamera: false,
    levelSeed: null,
    purchasedItems: {},
    artifacts: [],
  };
}

export class SaveSystem {
  static load(): SaveData | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        // Пробуем мигрировать со старой версии
        for (const oldKey of OLD_KEYS) {
          const old = localStorage.getItem(oldKey);
          if (!old) continue;
          const p = JSON.parse(old) as Partial<SaveData>;
          const migrated = emptySave();
          if (typeof p.coins === "number") migrated.coins = Math.max(0, Math.floor(p.coins));
          if (Array.isArray(p.unlockedLocations)) {
            migrated.unlockedLocations = p.unlockedLocations.filter(
              (v): v is string => typeof v === "string"
            );
          }
          if (typeof p.hasCamera === "boolean") migrated.hasCamera = p.hasCamera;
          if (typeof p.levelSeed === "number") migrated.levelSeed = p.levelSeed;
          this.save(migrated);
          return migrated;
        }
        return null;
      }

      const parsed = JSON.parse(raw) as Partial<SaveData>;
      const base = emptySave();

      // Нормализуем artifacts: если поле restored отсутствует — ставим true,
      // чтобы старые сохранения не превращались в "требует реставрации"
      const rawArtifacts = Array.isArray(parsed.artifacts) ? parsed.artifacts : [];
      const artifacts = rawArtifacts
        .filter((a): a is SaveData["artifacts"][number] => !!a && typeof a === "object")
        .map((a) => ({
          id: String(a.id ?? "unknown"),
          location: String(a.location ?? "egypt"),
          quality: typeof a.quality === "number" ? a.quality : 0.5,
          restored: typeof a.restored === "boolean" ? a.restored : true,
        }));

      return {
        coins:
          typeof parsed.coins === "number" && Number.isFinite(parsed.coins)
            ? Math.max(0, Math.floor(parsed.coins))
            : base.coins,
        unlockedLocations: Array.isArray(parsed.unlockedLocations)
          ? parsed.unlockedLocations.filter((v): v is string => typeof v === "string")
          : base.unlockedLocations,
        hasCamera: !!parsed.hasCamera,
        levelSeed: typeof parsed.levelSeed === "number" ? parsed.levelSeed : null,
        purchasedItems:
          parsed.purchasedItems && typeof parsed.purchasedItems === "object"
            ? { ...parsed.purchasedItems }
            : {},
        artifacts,
      };
    } catch {
      return null;
    }
  }

  static hasSave(): boolean {
    try {
      if (localStorage.getItem(STORAGE_KEY) !== null) return true;
      return OLD_KEYS.some((k) => localStorage.getItem(k) !== null);
    } catch {
      return false;
    }
  }

  static get(): SaveData {
    return this.load() ?? emptySave();
  }

  static save(data: SaveData): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* ignore */
    }
  }

  static addCoins(amount: number): number {
    const data = this.get();
    data.coins = Math.max(0, data.coins + Math.floor(amount));
    this.save(data);
    return data.coins;
  }

  static setHasCamera(value: boolean): void {
    const data = this.get();
    data.hasCamera = value;
    this.save(data);
  }

  static setLevelSeed(seed: number): void {
    const data = this.get();
    data.levelSeed = seed;
    this.save(data);
  }

  static unlockLocation(id: string): void {
    const data = this.get();
    if (!data.unlockedLocations.includes(id)) {
      data.unlockedLocations.push(id);
      this.save(data);
    }
  }

  // ------------------------------------------------------------ artifacts

  /** Добавляет артефакт. По умолчанию — «сырой», требует реставрации. */
  static addArtifact(
    id: string,
    location: string,
    quality: number,
    restored = false
  ): void {
    const data = this.get();
    data.artifacts.push({ id, location, quality, restored });
    this.save(data);
  }

  /** Обновляет поля конкретного артефакта по индексу. */
  static updateArtifact(
    index: number,
    patch: Partial<SaveData["artifacts"][number]>
  ): void {
    const data = this.get();
    if (index < 0 || index >= data.artifacts.length) return;
    data.artifacts[index] = { ...data.artifacts[index], ...patch };
    this.save(data);
  }

  /** Удаляет артефакты по индексам (индексы сортируются по убыванию). */
  static removeArtifacts(indices: number[]): void {
    const data = this.get();
    const sorted = [...indices].sort((a, b) => b - a);
    for (const idx of sorted) {
      if (idx >= 0 && idx < data.artifacts.length) data.artifacts.splice(idx, 1);
    }
    this.save(data);
  }

  static reset(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
      for (const key of OLD_KEYS) localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}