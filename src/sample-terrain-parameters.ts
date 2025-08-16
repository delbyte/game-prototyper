
export const sampleTerrainParameters = {
  "global": {
    "width": 2000,
    "depth": 2000,
    "maxHeight": 150,
    "segments": 1000,
    "biomeScale": 0.005
  },
  "skybox": {
    "horizonColor": { "r": 0.0, "g": 0.0, "b": 0.0 },
    "zenithColor": { "r": 0.0, "g": 0.0, "b": 0.2 },
    "atmosphereColor": { "r": 0.5, "g": 0.5, "b": 0.7 },
    "atmosphereStrength": 0.05
  },
  "lighting": {
    "ambient": {
      "color": { "r": 0.1, "g": 0.1, "b": 0.2 },
      "intensity": 0.3
    },
    "directional": {
      "color": { "r": 0.5, "g": 0.5, "b": 0.7 },
      "intensity": 0.5,
      "position": { "x": 0, "y": 100, "z": 0 }
    }
  },
  "biomes": [
    {
      "name": "Volcanic Wastes",
      "noiseScale": 0.01,
      "octaves": 6,
      "persistence": 0.5,
      "lacunarity": 2.2,
      "heightMultiplier": 0.8,
      "baseHeight": 0.2,
      "colors": {
        "low": { "r": 0.1, "g": 0.1, "b": 0.1 },
        "mid": { "r": 0.3, "g": 0.2, "b": 0.2 },
        "high": { "r": 0.8, "g": 0.3, "b": 0.1 }
      }
    },
    {
      "name": "Crystal Spires",
      "noiseScale": 0.005,
      "octaves": 8,
      "persistence": 0.6,
      "lacunarity": 2.8,
      "heightMultiplier": 1.5,
      "baseHeight": 0.5,
      "colors": {
        "low": { "r": 0.2, "g": 0.4, "b": 0.8 },
        "mid": { "r": 0.5, "g": 0.7, "b": 1.0 },
        "high": { "r": 0.9, "g": 0.9, "b": 1.0 }
      }
    }
  ]
}
