import { describe, it, expect } from "vitest";
import { SaveSystem } from "../src/systems/SaveSystem";

describe("SaveSystem", () => {
  it("пустой сейв содержит 50 монет", () => {
    const data = SaveSystem.get();
    expect(data.coins).toBe(50);
    expect(data.artifacts).toEqual([]);
  });

  it("addCoins суммирует монеты", () => {
    SaveSystem.addCoins(100);
    expect(SaveSystem.get().coins).toBe(150);
  });

  it("addCoins не допускает отрицательного баланса", () => {
    SaveSystem.addCoins(-999);
    expect(SaveSystem.get().coins).toBe(0);
  });

  it("addArtifact создаёт артефакт с restored=false", () => {
    SaveSystem.addArtifact("clay_tablet", "egypt", 0.7);
    const data = SaveSystem.get();
    expect(data.artifacts.length).toBe(1);
    expect(data.artifacts[0].restored).toBe(false);
  });

  it("updateArtifact изменяет поля", () => {
    SaveSystem.addArtifact("clay_tablet", "egypt", 0.5);
    SaveSystem.updateArtifact(0, { restored: true, quality: 0.9 });
    expect(SaveSystem.get().artifacts[0].restored).toBe(true);
  });

  it("removeArtifacts удаляет по индексам", () => {
    SaveSystem.addArtifact("a", "egypt", 0.5);
    SaveSystem.addArtifact("b", "egypt", 0.5);
    SaveSystem.addArtifact("c", "egypt", 0.5);
    SaveSystem.removeArtifacts([0, 2]);
    const data = SaveSystem.get();
    expect(data.artifacts.length).toBe(1);
    expect(data.artifacts[0].id).toBe("b");
  });

  it("восстанавливается после повреждённого JSON", () => {
    localStorage.setItem("archaeo_save_v3", "{{{");
    expect(SaveSystem.get().coins).toBe(50);
  });

  it("reset сбрасывает прогресс", () => {
    SaveSystem.addCoins(500);
    SaveSystem.reset();
    expect(SaveSystem.get().coins).toBe(50);
  });
});