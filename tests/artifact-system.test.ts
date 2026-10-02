import { describe, it, expect } from "vitest";
import { ArtifactSystem } from "../src/systems/ArtifactSystem";
import { SaveSystem } from "../src/systems/SaveSystem";
import { ArtifactError } from "../src/systems/errors";

describe("ArtifactSystem", () => {
  it("рассчитывает цену с учётом качества", () => {
    SaveSystem.addArtifact("clay_tablet", "egypt", 0.8, true);
    expect(ArtifactSystem.getPrice(0)).toBe(32);
  });

  it("возвращает 0 для неотреставрированного", () => {
    SaveSystem.addArtifact("clay_tablet", "egypt", 0.8, false);
    expect(ArtifactSystem.getPrice(0)).toBe(0);
  });

  it("бросает ArtifactError при индексе < 0", () => {
    expect(() => ArtifactSystem.getPrice(-1)).toThrow(ArtifactError);
  });

  it("продажа начисляет монеты", () => {
    SaveSystem.addArtifact("clay_tablet", "egypt", 1.0, true);
    const before = SaveSystem.get().coins;
    const sold = ArtifactSystem.sell(0);
    expect(SaveSystem.get().coins).toBe(before + sold);
  });

  it("слияние < 3 возвращает reason", () => {
    SaveSystem.addArtifact("bronze_medallion", "egypt", 0.8, true);
    const result = ArtifactSystem.mergeFirstOfKind(0);
    expect(result.ok).toBe(false);
  });

  it("слияние 3 создаёт следующий уровень", () => {
    for (let i = 0; i < 3; i++) {
      SaveSystem.addArtifact("bronze_medallion", "egypt", 0.8, true);
    }
    const result = ArtifactSystem.mergeFirstOfKind(0);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.newId).toBe("gold_scarab");
  });
});