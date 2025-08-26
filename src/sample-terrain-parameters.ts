import type { FullTerrainParameters } from "./types";

export const sampleTerrainParameters: FullTerrainParameters = {
    global: {
        width: 2000,
        depth: 2000,
        maxHeight: 300, // Increased max height for mountains
        segments: 1000,
        offset: 0
    },
    skybox: {
        horizonColor: { r: 0.53, g: 0.81, b: 0.92 },
        zenithColor: { r: 0.1, g: 0.2, b: 0.4 },
        atmosphereColor: { r: 0.8, g: 0.85, b: 0.9 },
        atmosphereStrength: 0.1,
    },
    lighting: {
        ambient: { color: { r: 0.6, g: 0.7, b: 0.8 }, intensity: 0.5 },
        directional: { color: { r: 1.0, g: 0.9, b: 0.8 }, intensity: 1.0, position: { x: 100, y: 100, z: 50 } }
    },
    
    biomeControl: {
        seed: Math.floor(Math.random() * 65536), // Use a random seed
        scale: 0.0005, // Very low frequency for large biome areas
        octaves: 2
    },
    biomes: [
        {
            name: 'Deep Ocean',
            controlRange: [-1.0, -0.6],
            terrainParams: {
                baseHeight: -150, // Deep water
                scale: 0.01,
                octaves: 3,
                persistence: 0.5,
                lacunarity: 2.0,
                amplitude: 20
            },
            colorRamp: [
                { stop: 0, color: { r: 0.0, g: 0.05, b: 0.2 } },
                { stop: 1, color: { r: 0.05, g: 0.1, b: 0.4 } }
            ],
            material: {
                transparency: 0.8,
                reflectivity: 0.7,
                ior: 1.333,
                isWater: true
            }
        },
        {
            name: 'Crystal Caves',
            controlRange: [-0.6, -0.2],
            terrainParams: {
                baseHeight: -20,
                scale: 0.008,
                octaves: 5,
                persistence: 0.6,
                lacunarity: 2.2,
                amplitude: 30
            },
            colorRamp: [
                { stop: 0, color: { r: 0.8, g: 0.9, b: 1.0 } },
                { stop: 0.5, color: { r: 0.9, g: 0.8, b: 1.0 } },
                { stop: 1, color: { r: 1.0, g: 0.9, b: 0.9 } }
            ],
            material: {
                transparency: 0.9,
                reflectivity: 0.8,
                ior: 1.5,
                iridescence: 0.7
            }
        },
        {
            name: 'Plains',
            controlRange: [-0.2, 0.2],
            terrainParams: {
                baseHeight: 5, // Slightly above sea level
                scale: 0.008,
                octaves: 2, // Very few octaves for flatness
                persistence: 0.4,
                lacunarity: 2.0,
                amplitude: 10 // Low amplitude
            },
            colorRamp: [
                { stop: 0, color: { r: 0.2, g: 0.6, b: 0.1 } },
                { stop: 1, color: { r: 0.3, g: 0.7, b: 0.2 } }
            ]
            // No material properties = standard material
        },
        {
            name: 'Glowing Crystals',
            controlRange: [0.2, 0.5],
            terrainParams: {
                baseHeight: 80, 
                scale: 0.012,
                octaves: 6,
                persistence: 0.7,
                lacunarity: 2.5,
                amplitude: 60
            },
            colorRamp: [
                { stop: 0, color: { r: 0.2, g: 0.8, b: 1.0 } },
                { stop: 0.5, color: { r: 0.8, g: 0.4, b: 1.0 } },
                { stop: 1, color: { r: 1.0, g: 0.6, b: 0.8 } }
            ],
            material: {
                transparency: 0.6,
                emission: 0.8,
                iridescence: 0.9,
                reflectivity: 0.5
            }
        },
        {
            name: 'Mountains',
            controlRange: [0.5, 0.8],
            terrainParams: {
                baseHeight: 200, // Much higher base
                scale: 0.015,
                octaves: 8, // Many octaves for detail
                persistence: 0.5,
                lacunarity: 2.2,
                amplitude: 250 // High amplitude for jaggedness
            },
            colorRamp: [
                { stop: 0, color: { r: 0.4, g: 0.4, b: 0.4 } },
                { stop: 0.8, color: { r: 0.8, g: 0.8, b: 0.85 } },
                { stop: 1, color: { r: 0.95, g: 0.95, b: 1.0 } } // Snow caps
            ]
            // No material properties = standard material
        },
        {
            name: 'Lava Peaks',
            controlRange: [0.8, 1.0],
            terrainParams: {
                baseHeight: 250, 
                scale: 0.02,
                octaves: 6,
                persistence: 0.45,
                lacunarity: 2.5, // High lacunarity for spikiness
                amplitude: 300
            },
            colorRamp: [
                { stop: 0, color: { r: 0.1, g: 0.1, b: 0.1 } },
                { stop: 0.7, color: { r: 0.9, g: 0.3, b: 0.0 } },
                { stop: 1, color: { r: 1.0, g: 0.5, b: 0.0 } } // Lava glow
            ],
            material: {
                emission: 0.9,
                metalness: 0.2,
                roughness: 0.9
            }
        }
    ]
};