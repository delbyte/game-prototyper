export const sampleTerrainParameters = {
    global: {
        width: 2000,
        depth: 2000,
        maxHeight: 200,
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
    terrain: {
        base: { seed: 12345, scale: 0.005, octaves: 8, persistence: 0.5, lacunarity: 2.0, amplitude: 1.0 },
        mountains: { seed: 67890, scale: 0.02, octaves: 6, persistence: 0.45, lacunarity: 2.2, amplitude: 0.7 },
        details: { seed: 11223, scale: 0.1, octaves: 4, persistence: 0.3, lacunarity: 2.5, amplitude: 0.1 }
    },
    environment: {
        temperature: { seed: 44556, scale: 0.01, octaves: 4 },
        moisture: { seed: 77889, scale: 0.01, octaves: 4 }
    },
    biomes: [
        {
            name: 'Water',
            rules: { maxElevation: 0.1 },
            colorRamp: [
                { stop: 0, color: { r: 0.05, g: 0.1, b: 0.4 } },
                { stop: 1, color: { r: 0.1, g: 0.3, b: 0.8 } }
            ]
        },
        {
            name: 'Sand',
            rules: { minElevation: 0.1, maxElevation: 0.15 },
            colorRamp: [
                { stop: 0, color: { r: 0.8, g: 0.7, b: 0.4 } },
                { stop: 1, color: { r: 0.85, g: 0.75, b: 0.5 } }
            ]
        },
        {
            name: 'Plains',
            rules: { minElevation: 0.15, maxElevation: 0.4, minTemperature: 0.3, maxMoisture: 0.6 },
            colorRamp: [
                { stop: 0, color: { r: 0.2, g: 0.6, b: 0.1 } },
                { stop: 1, color: { r: 0.3, g: 0.7, b: 0.2 } }
            ]
        },
        {
            name: 'Forest',
            rules: { minElevation: 0.2, maxElevation: 0.6, minTemperature: 0.3, minMoisture: 0.6 },
            colorRamp: [
                { stop: 0, color: { r: 0.1, g: 0.4, b: 0.1 } },
                { stop: 1, color: { r: 0.2, g: 0.5, b: 0.15 } }
            ]
        },
        {
            name: 'Rock',
            rules: { minElevation: 0.4, maxElevation: 0.8 },
            colorRamp: [
                { stop: 0, color: { r: 0.4, g: 0.4, b: 0.4 } },
                { stop: 1, color: { r: 0.5, g: 0.5, b: 0.5 } }
            ]
        },
        {
            name: 'SnowyPeak',
            rules: { minElevation: 0.8 },
            colorRamp: [
                { stop: 0, color: { r: 0.8, g: 0.8, b: 0.85 } },
                { stop: 1, color: { r: 0.95, g: 0.95, b: 1.0 } }
            ]
        },
        {
            name: 'Default', // A fallback biome
            rules: {},
            colorRamp: [
                { stop: 0, color: { r: 1, g: 0, b: 1 } }, // Magenta
                { stop: 1, color: { r: 1, g: 0, b: 1 } }
            ]
        }
    ]
};