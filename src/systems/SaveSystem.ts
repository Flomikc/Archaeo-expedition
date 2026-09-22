/**
 * Сохранение прогресса в localStorage.
 */

export interface SaveData {
  coins: number;
  unlockedLocations: string[];
  hasCamera: boolean;
  levelSeed: number | null;
}

const STORAGE_KEY = "archaeo_save_v2";

const DEFAULT_LOCATIONS: string[] = ["egypt"];

export class SaveSystem {
  static load(): SaveData | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const old = localStorage.getItem("archaeo_save_v1");
        if (old) {
          const p = JSON.parse(old) as Partial<SaveData>;
          return {
            coins: typeof p.coins === "number" ? Math.max(0, Math.floor(p.coins)) : 0,
            unlockedLocations: Array.isArray(p.unlockedLocations)
              ? p.unlockedLocations.filter((v): v is string => typeof v === "string")
              : [...DEFAULT_LOCATIONS],
            hasCamera: false,
            levelSeed: null,
          };
        }
        return null;
      }

      const parsed = JSON.parse(raw) as Partial<SaveData>;

      const coins =
        typeof parsed.coins === "number" && Number.isFinite(parsed.coins)
          ? Math.max(0, Math.floor(parsed.coins))
          : 0;

      const unlocked = Array.isArray(parsed.unlockedLocations)
        ? parsed.unlockedLocations.filter((v): v is string => typeof v === "string")
        : [];

      return {
        coins,
        unlockedLocations: unlocked.length > 0 ? unlocked : [...DEFAULT_LOCATIONS],
        hasCamera: !!parsed.hasCamera,
        levelSeed: typeof parsed.levelSeed === "number" ? parsed.levelSeed : null,
      };
    } catch {
      return null;
    }
  }

  static hasSave(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEY) !== null || localStorage.getItem("archaeo_save_v1") !== null;
    } catch {
      return false;
    }
  }

  static get(): SaveData {
    return (
      SaveSystem.load() ?? {
        coins: 0,
        unlockedLocations: [...DEFAULT_LOCATIONS],
        hasCamera: false,
        levelSeed: null,
      }
    );
  }

  static save(data: SaveData): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* ignore */
    }
  }

  static addCoins(amount: number): number {
    const data = SaveSystem.get();
    data.coins = Math.max(0, data.coins + Math.floor(amount));
    SaveSystem.save(data);
    return data.coins;
  }

  static setHasCamera(value: boolean): void {
    const data = SaveSystem.get();
    data.hasCamera = value;
    SaveSystem.save(data);
  }

  static setLevelSeed(seed: number): void {
    const data = SaveSystem.get();
    data.levelSeed = seed;
    SaveSystem.save(data);
  }

  static unlockLocation(id: string): void {
    const data = SaveSystem.get();
    if (!data.unlockedLocations.includes(id)) {
      data.unlockedLocations.push(id);
      SaveSystem.save(data);
    }
  }

  static reset(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem("archaeo_save_v1");
    } catch {
      /* ignore */
    }
  }
}
