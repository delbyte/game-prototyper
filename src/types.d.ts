export interface Asset {
  id: string;
  name: string;
  description: string;
  source: string;
  url: string;
  thumbnailUrl: string;
  tags: string[];
}

declare module './noise.ts' {
  export class PerlinNoise {
    constructor(seed?: number);
    noise(x: number, y: number, z?: number): number;
    fractalNoise(x: number, y: number, octaves?: number, persistence?: number, scale?: number): number;
  }
}
