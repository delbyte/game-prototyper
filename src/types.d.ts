declare module './terrain.ts' {
  export class TerrainGenerator {
    constructor();
    generateTerrain(): any;
    regenerate(): any;
    getHeightAtPosition(x: number, z: number): number;
  }
}

declare module './noise.ts' {
  export class PerlinNoise {
    constructor(seed?: number);
    noise(x: number, y: number, z?: number): number;
    fractalNoise(x: number, y: number, octaves?: number, persistence?: number, scale?: number): number;
  }
}
