import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Asset } from "./types";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);

export async function generateTerrainParameters(prompt: string): Promise<any> {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const fullPrompt = `
        You are a deterministic world-building engine for a real-time Three.js terrain generator. Produce ONLY valid JSON (no explanation, no commentary) that the client will ingest directly. Maintain the exact structure shown in the reference example below.

        IMPORTANT: Follow these rules strictly:
        - Output MUST be parsable JSON and match the structure: { global, skybox, lighting, terrain, environment, biomes }.
        - Do not include human-readable commentary, markdown fences, or extra keys.
        - The 'biomes' array should be ordered from most specific to most general. The last biome should be a general fallback.

        HOW THE PARAMETERS MAP TO STYLES:
        - Terrain Shape: Controlled by the 'terrain' object. Use the 'base', 'mountains', and 'details' layers to shape the world. Prompts like "rolling hills" or "jagged mountains" should primarily affect the amplitude and scale of these layers.
        - Terrain Color & Biomes: Controlled by the 'biomes' array. Each biome is defined by a set of rules based on normalized elevation, temperature, and moisture (all 0.0-1.0). The color is defined by a gradient (colorRamp).
        - "Snow-capped peaks": Create a biome with a high 'minElevation' rule (e.g., 0.8) and a colorRamp that goes from gray to white.
        - "Pink mountains": Create a mountain-shaped terrain, then define a biome with rules that match the mountain elevations and a colorRamp that uses shades of pink.
        - "Alien world with wavy surfaces": Use low-frequency, low-amplitude noise for the terrain shape. Then, define a set of biomes with unconventional colorRamps (purples, greens, etc.).

        TECHNICAL CONSTRAINTS & PERFORMANCE:
        - segments: 400-1500.
        - octaves: 3-8.
        - scale: 0.001-0.2.
        - amplitude: 0.0-1.5.
        - All colors are 0.0-1.0 RGB.
        - Biome rules (min/max Elevation/Temperature/Moisture) are normalized from 0.0 to 1.0.
        - ColorRamp stops are normalized from 0.0 to 1.0 within a biome's elevation range.

        OUTPUT REQUIREMENTS:
        - Return JSON only.
        - The 'terrain' object must contain 'base', 'mountains', and 'details' layers.
        - The 'environment' object must contain 'temperature' and 'moisture' maps.
        - The 'biomes' array must contain biome definition objects, each with 'name', 'rules', and 'colorRamp'.

        REFERENCE EXAMPLE (preserve structure and types):
        {
            "global": { "width": 2000, "depth": 2000, "maxHeight": 250, "segments": 1000, "offset": -20 },
            "skybox": { "horizonColor": { "r": 0.5, "g": 0.5, "b": 0.7 }, "zenithColor": { "r": 0.1, "g": 0.2, "b": 0.4 }, "atmosphereColor": { "r": 0.8, "g": 0.85, "b": 0.9 }, "atmosphereStrength": 0.1 },
            "lighting": { "ambient": { "color": { "r": 0.6, "g": 0.7, "b": 0.8 }, "intensity": 0.5 }, "directional": { "color": { "r": 1.0, "g": 0.9, "b": 0.8 }, "intensity": 1.0, "position": { "x": 100, "y": 100, "z": 50 } } },
            "terrain": {
                "base": { "seed": 555, "scale": 0.004, "octaves": 8, "persistence": 0.5, "lacunarity": 2.0, "amplitude": 1.0 },
                "mountains": { "seed": 666, "scale": 0.015, "octaves": 6, "persistence": 0.45, "lacunarity": 2.2, "amplitude": 1.2 },
                "details": { "seed": 777, "scale": 0.08, "octaves": 4, "persistence": 0.3, "lacunarity": 2.5, "amplitude": 0.1 }
            },
            "environment": {
                "temperature": { "seed": 888, "scale": 0.01, "octaves": 4 },
                "moisture": { "seed": 999, "scale": 0.01, "octaves": 4 }
            },
            "biomes": [
                { "name": "Deep Water", "rules": { "maxElevation": 0.08 }, "colorRamp": [ { "stop": 0, "color": { "r": 0, "g": 0.05, "b": 0.2 } }, { "stop": 1, "color": { "r": 0.05, "g": 0.1, "b": 0.4 } } ] },
                { "name": "Sand", "rules": { "minElevation": 0.08, "maxElevation": 0.12 }, "colorRamp": [ { "stop": 0, "color": { "r": 0.8, "g": 0.7, "b": 0.4 } }, { "stop": 1, "color": { "r": 0.85, "g": 0.75, "b": 0.5 } } ] },
                { "name": "Plains", "rules": { "minElevation": 0.12, "maxElevation": 0.4 }, "colorRamp": [ { "stop": 0, "color": { "r": 0.2, "g": 0.6, "b": 0.1 } }, { "stop": 0.5, "color": { "r": 0.3, "g": 0.7, "b": 0.2 } }, { "stop": 1, "color": { "r": 0.4, "g": 0.5, "b": 0.3 } } ] },
                { "name": "Rock", "rules": { "minElevation": 0.4, "maxElevation": 0.8 }, "colorRamp": [ { "stop": 0, "color": { "r": 0.4, "g": 0.4, "b": 0.4 } }, { "stop": 1, "color": { "r": 0.5, "g": 0.5, "b": 0.5 } } ] },
                { "name": "Snow", "rules": { "minElevation": 0.8 }, "colorRamp": [ { "stop": 0, "color": { "r": 0.8, "g": 0.8, "b": 0.85 } }, { "stop": 1, "color": { "r": 0.95, "g": 0.95, "b": 1.0 } } ] }
            ]
        }

        Now generate parameters tailored to this user request (as JSON only): ${JSON.stringify(prompt)}
    `;

        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        
        let text: string;
        if (response.candidates && response.candidates[0]?.content?.parts?.[0]?.text) {
            text = response.candidates[0].content.parts[0].text;
        } else {
            text = await response.text();
        }

        const jsonText = text.replace(/```json\n?/g, "").replace(/\n?```/g, "").trim();
        const parsedData = JSON.parse(jsonText);
        
        return validateAndClampParameters(parsedData);
    } catch (error) {
        console.error('Error generating terrain parameters:', error);
        throw new Error(`Failed to generate terrain: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

function validateAndClampParameters(params: any): any {
    params = params || {};
    params.global = params.global || {};
    params.skybox = params.skybox || {};
    params.lighting = params.lighting || { ambient: {}, directional: {} };
    params.lighting.ambient = params.lighting.ambient || {};
    params.lighting.directional = params.lighting.directional || { position: {} };
    params.terrain = params.terrain || {};
    params.terrain.base = params.terrain.base || {};
    params.terrain.mountains = params.terrain.mountains || {};
    params.terrain.details = params.terrain.details || {};
    params.environment = params.environment || {};
    params.environment.temperature = params.environment.temperature || {};
    params.environment.moisture = params.environment.moisture || {};
    params.biomes = params.biomes || [];

    params.global.width = Math.min(Math.max(params.global.width || 2000, 1000), 2500);
    params.global.depth = Math.min(Math.max(params.global.depth || 2000, 1000), 2500);
    params.global.maxHeight = Math.min(Math.max(params.global.maxHeight || 150, 50), 300);
    params.global.segments = Math.min(Math.max(params.global.segments || 1000, 400), 1500);
    params.global.offset = params.global.offset || 0;

    const clampColor = (color: any, fallback = { r: 0.5, g: 0.5, b: 0.5 }) => {
        if (!color) color = fallback;
        let r = typeof color.r === 'number' ? color.r : fallback.r;
        let g = typeof color.g === 'number' ? color.g : fallback.g;
        let b = typeof color.b === 'number' ? color.b : fallback.b;

        if (r > 1 || g > 1 || b > 1) {
            r /= 255; g /= 255; b /= 255;
        }
        return { r: Math.min(Math.max(r, 0), 1), g: Math.min(Math.max(g, 0), 1), b: Math.min(Math.max(b, 0), 1) };
    };

    params.skybox.horizonColor = clampColor(params.skybox.horizonColor, { r: 0.6, g: 0.8, b: 1.0 });
    params.skybox.zenithColor = clampColor(params.skybox.zenithColor, { r: 0.0, g: 0.1, b: 0.35 });
    params.skybox.atmosphereColor = clampColor(params.skybox.atmosphereColor, { r: 0.5, g: 0.5, b: 0.7 });
    params.skybox.atmosphereStrength = Math.min(Math.max(params.skybox.atmosphereStrength || 0.05, 0), 0.2);

    params.lighting.ambient.color = clampColor(params.lighting.ambient.color, { r: 0.1, g: 0.1, b: 0.2 });
    params.lighting.ambient.intensity = Math.min(Math.max(params.lighting.ambient.intensity || 0.3, 0.2), 0.8);
    params.lighting.directional.color = clampColor(params.lighting.directional.color, { r: 0.8, g: 0.8, b: 0.8 });
    params.lighting.directional.intensity = Math.min(Math.max(params.lighting.directional.intensity || 0.5, 0.2), 0.8);

    const clampNoiseLayer = (layer: any) => {
        layer = layer || {};
        layer.seed = layer.seed || Math.floor(Math.random() * 65536);
        layer.scale = Math.min(Math.max(layer.scale || 0.01, 0.001), 0.2);
        layer.octaves = Math.min(Math.max(Math.round(layer.octaves || 4), 3), 8);
        layer.persistence = Math.min(Math.max(layer.persistence || 0.5, 0.3), 0.7);
        layer.lacunarity = Math.min(Math.max(layer.lacunarity || 2.0, 1.8), 3.0);
        layer.amplitude = Math.min(Math.max(layer.amplitude || 1.0, 0.0), 1.5);
        return layer;
    };

    params.terrain.base = clampNoiseLayer(params.terrain.base);
    params.terrain.mountains = clampNoiseLayer(params.terrain.mountains);
    params.terrain.details = clampNoiseLayer(params.terrain.details);

    params.environment.temperature = clampNoiseLayer(params.environment.temperature);
    params.environment.moisture = clampNoiseLayer(params.environment.moisture);

    if (params.biomes.length === 0) {
        // Add a default biome if none are provided
        params.biomes.push({ name: 'Default', rules: {}, colorRamp: [{ stop: 0, color: { r: 1, g: 0, b: 1 } }] });
    }

    params.biomes.forEach((biome: any) => {
        biome.rules = biome.rules || {};
        biome.colorRamp = biome.colorRamp || [{ stop: 0, color: { r: 1, g: 0, b: 1 } }];
        biome.colorRamp.forEach((stop: any) => {
            stop.color = clampColor(stop.color);
            stop.stop = Math.min(Math.max(stop.stop || 0, 0), 1);
        });
    });

    console.log('Validated terrain parameters:', params);
    return params;
}