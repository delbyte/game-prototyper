export interface Asset {
  id: string;
  name: string;
  description: string;
  source: string;
  url: string;
  thumbnailUrl: string;
  tags: string[];
}

export interface RGBColor {
    r: number;
    g: number;
    b: number;
}

export interface ColorStop {
    stop: number;
    color: RGBColor;
}

export interface NoiseParams {
    seed?: number;
    scale: number;
    octaves: number;
    persistence?: number;
    lacunarity?: number;
    amplitude?: number;
    baseHeight?: number;
}

export interface BiomeProfile {
    name: string;
    controlRange: [number, number];
    terrainParams: NoiseParams;
    colorRamp: ColorStop[];
}

export interface BiomeControlParams {
    seed: number;
    scale: number;
    octaves: number;
}

export interface FullTerrainParameters {
    global: {
        width: number;
        depth: number;
        maxHeight: number;
        segments: number;
        offset: number;
    };
    skybox: {
        horizonColor: RGBColor;
        zenithColor: RGBColor;
        atmosphereColor: RGBColor;
        atmosphereStrength: number;
    };
    lighting: {
        ambient: { color: RGBColor; intensity: number; };
        directional: { color: RGBColor; intensity: number; position: { x: number; y: number; z: number; }; };
    };
    biomeControl: BiomeControlParams;
    biomes: BiomeProfile[];
}