import {
  Color3,
  Color4,
  DefaultRenderingPipeline,
  DynamicTexture,
  ParticleSystem,
  Scene,
  Vector3,
} from "@babylonjs/core";

export type AtmospherePreset = "desert" | "pyramid" | "hub";

export class Atmosphere {
  private pipeline: DefaultRenderingPipeline | null = null;
  private particles: ParticleSystem | null = null;

  constructor(private readonly scene: Scene) {}

  apply(preset: AtmospherePreset): void {
    this.disposeParticles();

    switch (preset) {
      case "desert":
        this.scene.clearColor = new Color4(0.72, 0.55, 0.32, 1);
        this.scene.fogMode = Scene.FOGMODE_EXP2;
        this.scene.fogDensity = 0.028;
        this.scene.fogColor = new Color3(0.78, 0.62, 0.4);
        this.setupPipeline(0.35, 0.55, 0.08);
        this.spawnDust(new Vector3(0, 4, 20), 60, 8);
        break;
      case "pyramid":
        this.scene.clearColor = new Color4(0.02, 0.02, 0.025, 1);
        this.scene.fogMode = Scene.FOGMODE_EXP2;
        this.scene.fogDensity = 0.05;
        this.scene.fogColor = new Color3(0.04, 0.035, 0.03);
        this.setupPipeline(0.55, 0.75, 0.12);
        this.spawnDust(new Vector3(20, 3, 20), 100, 14);
        break;
      case "hub":
        this.scene.clearColor = new Color4(0.02, 0.02, 0.025, 1);
        this.scene.fogMode = Scene.FOGMODE_NONE;
        this.setupPipeline(0.25, 0.4, 0.05);
        break;
    }
  }

  update(_dt: number): void {}

  dispose(): void {
    this.disposeParticles();
    if (this.pipeline) {
      this.pipeline.dispose();
      this.pipeline = null;
    }
  }

  private setupPipeline(grain: number, vignette: number, chromatic: number): void {
    if (this.pipeline) this.pipeline.dispose();
    const pipe = new DefaultRenderingPipeline("atm", true, this.scene, this.scene.cameras);
    pipe.grainEnabled = true;
    pipe.grain.intensity = grain;
    pipe.imageProcessingEnabled = true;
    pipe.imageProcessing.contrast = 1.08;
    pipe.imageProcessing.exposure = 1.05;
    pipe.imageProcessing.vignetteEnabled = true;
    pipe.imageProcessing.vignetteWeight = vignette;
    pipe.imageProcessing.vignetteStretch = 0.4;
    pipe.imageProcessing.vignetteColor = new Color4(0, 0, 0, 0);
    pipe.chromaticAberrationEnabled = chromatic > 0.01;
    if (pipe.chromaticAberrationEnabled) {
      pipe.chromaticAberration.aberrationAmount = chromatic * 30;
    }
    this.pipeline = pipe;
  }

  private spawnDust(center: Vector3, capacity: number, emitRate: number): void {
    const ps = new ParticleSystem("dust", capacity, this.scene);

    const tex = new DynamicTexture("dustTex", { width: 32, height: 32 }, this.scene, false);
    const ctx = tex.getContext();
    const grd = ctx.createRadialGradient(16, 16, 1, 16, 16, 14);
    grd.addColorStop(0, "rgba(230,210,180,0.9)");
    grd.addColorStop(1, "rgba(230,210,180,0)");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 32, 32);
    tex.update();
    ps.particleTexture = tex;

    ps.emitter = center;
    ps.minEmitBox = new Vector3(-30, 0, -30);
    ps.maxEmitBox = new Vector3(30, 8, 30);
    ps.color1 = new Color4(0.9, 0.85, 0.7, 0.4);
    ps.color2 = new Color4(0.75, 0.7, 0.55, 0.2);
    ps.colorDead = new Color4(0.5, 0.45, 0.35, 0);
    ps.minSize = 0.05;
    ps.maxSize = 0.16;
    ps.minLifeTime = 4;
    ps.maxLifeTime = 12;
    ps.emitRate = emitRate;
    ps.gravity = new Vector3(0, 0.015, 0);
    ps.direction1 = new Vector3(-0.25, 0.05, -0.25);
    ps.direction2 = new Vector3(0.25, 0.35, 0.25);
    ps.minEmitPower = 0.04;
    ps.maxEmitPower = 0.18;
    ps.updateSpeed = 0.02;
    ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    ps.start();
    this.particles = ps;
  }

  private disposeParticles(): void {
    if (this.particles) {
      this.particles.dispose();
      this.particles = null;
    }
  }
}
