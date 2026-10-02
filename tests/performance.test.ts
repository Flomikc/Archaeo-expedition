import { describe, it, expect } from "vitest";
import { NullEngine, Scene } from "@babylonjs/core";
import { SaveSystem } from "../src/systems/SaveSystem";
import { ArtifactSystem } from "../src/systems/ArtifactSystem";
import { LevelGenerator } from "../src/systems/LevelGenerator";

describe("Performance", () => {
  it("SaveSystem: 1000 записей < 200 мс", () => {
    const start = performance.now();
    for (let i = 0; i < 1000; i++) SaveSystem.addCoins(1);
    const elapsed = performance.now() - start;
    console.log(`[PERF] 1000 записей: ${elapsed.toFixed(1)} мс`);
    expect(elapsed).toBeLessThan(200);
  });

  it("SaveSystem: 1000 чтений < 300 мс", () => {
    const start = performance.now();
    for (let i = 0; i < 1000; i++) SaveSystem.get();
    const elapsed = performance.now() - start;
    console.log(`[PERF] 1000 чтений: ${elapsed.toFixed(1)} мс`);
    expect(elapsed).toBeLessThan(300);
  });

  it("ArtifactSystem: 500 расчётов < 50 мс", () => {
    for (let i = 0; i < 10; i++) SaveSystem.addArtifact("clay_tablet", "egypt", 0.8, true);
    const start = performance.now();
    for (let i = 0; i < 500; i++) ArtifactSystem.getPrice(i % 10);
    const elapsed = performance.now() - start;
    console.log(`[PERF] 500 расчётов: ${elapsed.toFixed(1)} мс`);
    expect(elapsed).toBeLessThan(50);
  });

  it("LevelGenerator: 10 генераций < 500 мс", () => {
    const engine = new NullEngine();
    const gen = new LevelGenerator();
    const start = performance.now();
    for (let i = 0; i < 10; i++) gen.build(new Scene(engine), 1000 + i);
    const elapsed = performance.now() - start;
    console.log(`[PERF] 10 генераций: ${elapsed.toFixed(1)} мс`);
    expect(elapsed).toBeLessThan(500);
    engine.dispose();
  });
});