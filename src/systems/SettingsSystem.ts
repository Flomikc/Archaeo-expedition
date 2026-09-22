/**
 * Глобальные настройки (чувствительность мыши, пучок фонарика).
 * Сохраняются в localStorage и рассылаются подписчикам.
 */

export interface SettingsData {
    /** Чувствительность мыши: 0.5 (медленно) .. 10 (быстро). */
    sensitivity: number;
    /** Угол пучка фонарика в радианах: 0.4 (узко/ярко) .. 1.6 (широко/тускло). */
    flashlight: number;
  }
  
  const STORAGE_KEY = "archaeo_settings_v1";
  
  export const SETTINGS_LIMITS = {
    sensitivityMin: 0.5,
    sensitivityMax: 10,
    flashlightMin: 0.4,
    flashlightMax: 1.6,
  } as const;
  
  const DEFAULTS: SettingsData = {
    sensitivity: 5.0,
    flashlight: 1.0,
  };
  
  export class SettingsSystem {
    private static current: SettingsData = { ...DEFAULTS };
    private static listeners: Array<(s: SettingsData) => void> = [];
    private static loaded = false;
  
    static load(): void {
      if (this.loaded) return;
      this.loaded = true;
  
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as Partial<SettingsData>;
  
        if (typeof parsed.sensitivity === "number" && Number.isFinite(parsed.sensitivity)) {
          this.current.sensitivity = this.clampSensitivity(parsed.sensitivity);
        }
        if (typeof parsed.flashlight === "number" && Number.isFinite(parsed.flashlight)) {
          this.current.flashlight = this.clampFlashlight(parsed.flashlight);
        }
      } catch {
        /* ignore */
      }
    }
  
    static get(): SettingsData {
      return { ...this.current };
    }
  
    static set(patch: Partial<SettingsData>): void {
      if (patch.sensitivity !== undefined) {
        this.current.sensitivity = this.clampSensitivity(patch.sensitivity);
      }
      if (patch.flashlight !== undefined) {
        this.current.flashlight = this.clampFlashlight(patch.flashlight);
      }
      this.save();
  
      const snapshot = this.get();
      for (const listener of this.listeners) listener(snapshot);
    }
  
    static subscribe(listener: (s: SettingsData) => void): () => void {
      this.listeners.push(listener);
      return () => {
        this.listeners = this.listeners.filter((l) => l !== listener);
      };
    }
  
    // ------------------------------------------------------------- private
  
    private static clampSensitivity(v: number): number {
      return Math.min(
        SETTINGS_LIMITS.sensitivityMax,
        Math.max(SETTINGS_LIMITS.sensitivityMin, v)
      );
    }
  
    private static clampFlashlight(v: number): number {
      return Math.min(
        SETTINGS_LIMITS.flashlightMax,
        Math.max(SETTINGS_LIMITS.flashlightMin, v)
      );
    }
  
    private static save(): void {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.current));
      } catch {
        /* ignore */
      }
    }
  }