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

export interface MaterialProperties {
    transparency?: number;       // 0-1, for glass/crystal effects
    reflectivity?: number;       // 0-1, for mirror/water surfaces
    emission?: number;           // 0-1, for glowing materials
    metalness?: number;          // 0-1, for metallic surfaces
    roughness?: number;          // 0-1, surface roughness
    ior?: number;                // Index of refraction for glass
    iridescence?: number;        // 0-1, for rainbow/prismatic effects
    flowDirection?: { x: number; y: number; }; // For animated water/lava
    isWater?: boolean;           // Special water handling
}

export interface BiomeMaterialClassification {
    materialType: string;        // 'standard' | 'crystal' | 'glowing' | 'water'
    priority: number;            // Higher priority wins in conflicts (0-10)
    coverage: number;            // How much of the biome uses this material (0-1)
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
    material?: MaterialProperties;   // Advanced material properties
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