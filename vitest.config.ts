import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "happy-dom",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    globals: true,
    testTimeout: 15000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      reportsDirectory: "tests/coverage",
      // Исключаем визуал, сцены, UI и entrypoints —
      // они тестируются вручную в браузере, а не unit-тестами
      exclude: [
        "tests/**",
        "node_modules/**",
        "**/*.config.ts",
        "src/systems/InteractionSystem.ts",
        "**/*.d.ts",
        "src/main.ts",
        "src/scenes/**",              // 3D-сцены
        "src/entities/**",            // визуальные модели
        "src/ui/**",                  // DOM / HUD
        "src/systems/Atmosphere.ts",  // постобработка
        "src/systems/LaptopSystem.ts",// анимация камеры
        "src/systems/LockpickSystem.ts",  // мини-игра (DOM)
        "src/systems/WorkbenchSystem.ts", // мини-игра (DOM)
        "src/systems/SettingsSystem.ts",  // UI-настройки
        "src/data/RoomTemplates.ts",      // декор комнат
        "src/data/ShopData.ts",           // статические данные
      ],
    },
  },
});