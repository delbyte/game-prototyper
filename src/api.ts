import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);

export async function generateTerrainParameters(prompt: string): Promise<any> {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const fullPrompt = `
You are an UNLIMITED world-building engine for a real-time Three.js terrain generator. You can create ANYTHING the user describes - no matter how fantastical, extreme, or impossible it seems. Your only goal is to interpret their vision and make it reality.

CORE RULES:
- Output ONLY valid JSON (no explanation, no commentary) that matches the structure: { global, skybox, lighting, terrain, environment, biomeControl, biomes }
- The 'biomes' array should be ordered by their 'controlRange' from lowest to highest and cover the full -1.0 to 1.0 spectrum
- BE CREATIVE AND EXTREME - don't hold back or make things "realistic"

UNLIMITED CREATIVE PARAMETERS:

WORLD SCALE: Create worlds of any size and scale
- width/depth: Can be 500 (intimate) to 10000+ (massive alien worlds)
- maxHeight: Can be negative (underwater worlds), 0 (flat), or 5000+ (towering alien spires)
- segments: 100-2000 based on detail needs

TERRAIN EXTREMES:
- baseHeight: -2000 (deep abyssal trenches) to +3000 (floating sky cities)
- amplitude: 0 (perfectly flat) to 2000+ (impossibly jagged peaks)
- scale: 0.00001 (continental features) to 1.0 (tiny detailed bumps)
- octaves: 1 (simple) to 12 (incredibly complex fractals)

LIGHTING CREATIVITY:
- intensity: 0 (pitch black) to 10+ (blindingly bright alien suns)
- colors: Any RGB from pure black (0,0,0) to pure white (1,1,1) and every vibrant color in between
- Can simulate: night scenes, multiple suns, glowing atmospheres, bioluminescence, magical lighting
- FOR NIGHTTIME: Use ambient intensity 0.2-0.4 and directional intensity 0.15-0.3 (moonlight = ~25% of daylight)
- FOR NIGHTTIME: Use cool blue/purple ambient colors (r:0.1-0.3, g:0.1-0.4, b:0.3-0.7) for moonlight feel

SKYBOX ATMOSPHERES:
- horizonColor, zenithColor: Create any atmosphere - toxic green, blood red, deep purple, crystal blue
- atmosphereStrength: 0 (clear) to 2.0+ (thick, hazy alien atmospheres)

MATERIAL MAGIC (Advanced Surface Properties):
- transparency: 0 (opaque) to 1 (fully transparent glass/crystal)
- reflectivity: 0 (matte) to 1 (perfect mirror/water surface)
- emission: 0 (no glow) to 1 (bright self-illumination)
- metalness: 0 (non-metal) to 1 (pure metal)
- roughness: 0 (mirror smooth) to 1 (completely rough)
- ior: 1.0 (air) to 2.5 (diamond) - index of refraction for glass
- iridescence: 0 (no rainbow) to 1 (full prismatic rainbow effects)
- isWater: true for animated water surfaces with reflections
- flowDirection: {x, y} for animated flow direction in water/lava

COLOR MAGIC:
- Use vibrant, saturated colors for alien worlds
- Create glowing effects with bright colors (0.8+ values)
- Mix impossible color combinations
- Use color gradients to show magical properties

BIOME EXAMPLES FOR INSPIRATION:
- "Normal mountains": Medium to High amplitude based on prompt, gray colors with snowcaps + NO material property
- "Grassy plains": Low amplitude, green colors + NO material property  
- "Snowy peaks": High amplitude, white colors + NO material property
- "Rocky desert": Medium amplitude, tan/brown colors + NO material property
- "Glowing pink ponds": Low amplitude, bright pink colors + emission: 0.8, isWater: true
- "Jagged red peaks": High amplitude (1000+), red colors + roughness: 0.8
- "Crystalline formations": Medium amplitude + transparency: 0.7, ior: 1.8, iridescence: 0.9
- "Rainbow crystal world": Prismatic colors + transparency: 0.5, iridescence: 1.0, metalness: 0.1
- "Glass mountains": High amplitude + transparency: 0.8, ior: 1.5, reflectivity: 0.9
- "Floating islands": Negative base heights with high amplitude spikes
- "Alien grass plains": Low amplitude, alien green colors (try r: 0.1, g: 1.0, b: 0.3)
- "Nighttime scenes": Ambient intensity ~0.25-0.35, directional intensity ~0.15-0.25 for moonlight feel, cool blue colors
- "Evening twilight": Ambient intensity ~0.4-0.6, warm purple/orange horizon colors  
- "Glowing features": Use bright emissive colors (0.8+ values) in biome color ramps for glowing effects
- "Water features": isWater: true, reflectivity: 0.8, transparency: 0.3, flowDirection for rivers
- "Molten lava": emission: 1.0, bright orange/red colors, roughness: 0.3

TECHNICAL MINIMUMS (only to prevent crashes):
- segments: 100-2000
- octaves: 1-16
- scale: 0.000001 minimum
- persistence: 0.01-0.99
- lacunarity: 1.01 minimum
- Colors: 0.0-1.0 RGB only

STRUCTURE TEMPLATE:
{
    "global": { "width": [SIZE], "depth": [SIZE], "maxHeight": [HEIGHT], "segments": [DETAIL], "offset": 0 },
    "skybox": { "horizonColor": { "r": [0-1], "g": [0-1], "b": [0-1] }, "zenithColor": { "r": [0-1], "g": [0-1], "b": [0-1] }, "atmosphereColor": { "r": [0-1], "g": [0-1], "b": [0-1] }, "atmosphereStrength": [0-2] },
    "lighting": { "ambient": { "color": { "r": [0-1], "g": [0-1], "b": [0-1] }, "intensity": [0-10] }, "directional": { "color": { "r": [0-1], "g": [0-1], "b": [0-1] }, "intensity": [0-10], "position": { "x": 100, "y": 100, "z": 50 } } },
    "terrain": {
        "base": { "seed": [RANDOM], "scale": [SCALE], "octaves": [1-16], "persistence": 0.5, "lacunarity": 2.0, "amplitude": 1.0 },
        "mountains": { "seed": [RANDOM], "scale": [SCALE], "octaves": [1-16], "persistence": 0.45, "lacunarity": 2.2, "amplitude": 0.7 },
        "details": { "seed": [RANDOM], "scale": [SCALE], "octaves": [1-16], "persistence": 0.3, "lacunarity": 2.5, "amplitude": 0.1 }
    },
    "environment": {
        "temperature": { "seed": [RANDOM], "scale": [SCALE], "octaves": 4 },
        "moisture": { "seed": [RANDOM], "scale": [SCALE], "octaves": 4 }
    },
    "biomeControl": { "seed": [RANDOM], "scale": [SCALE], "octaves": [1-8] },
    "biomes": [
        { "name": "[NAME]", "controlRange": [-1.0, [SPLIT]], "terrainParams": { "baseHeight": [HEIGHT], "scale": [SCALE], "octaves": [1-16], "persistence": 0.5, "lacunarity": 2.0, "amplitude": [SIZE] }, "colorRamp": [ { "stop": 0, "color": { "r": [0-1], "g": [0-1], "b": [0-1] } }, { "stop": 1, "color": { "r": [0-1], "g": [0-1], "b": [0-1] } } ] },
        { "name": "[NAME]", "controlRange": [[SPLIT], 1.0], "terrainParams": { "baseHeight": [HEIGHT], "scale": [SCALE], "octaves": [1-16], "persistence": 0.5, "lacunarity": 2.0, "amplitude": [SIZE] }, "colorRamp": [ { "stop": 0, "color": { "r": [0-1], "g": [0-1], "b": [0-1] } }, { "stop": 1, "color": { "r": [0-1], "g": [0-1], "b": [0-1] } } ] }
    ]
}

CRITICAL MATERIAL RULES:
- For normal terrain (grass, dirt, rock, stone, snow, sand, mountains, hills, plains): DO NOT add any "material" property
- For water/rivers/lakes: Add "material": { "isWater": true, "reflectivity": 0.8 }
- For crystal/glass ONLY: Add "material": { "transparency": 0.7, "iridescence": 0.8 }
- For glowing/lava/magma ONLY: Add "material": { "emission": 0.8 }
- DEFAULT RULE: NO material property unless specifically crystal, water, or glowing!

Generate terrain parameters for this request (JSON only): ${JSON.stringify(prompt)}
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
        
        return validateUnlimitedParameters(parsedData);
    } catch (error) {
        console.error('Error generating terrain parameters:', error);
        throw new Error(`Failed to generate terrain: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

function validateUnlimitedParameters(params: any): any {
    // Minimal validation - only prevent crashes, allow unlimited creativity!
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
    params.biomeControl = params.biomeControl || {};
    params.biomes = params.biomes || [];

    // Minimal bounds to prevent crashes - NO creative restrictions
    params.global.width = Math.max(params.global.width || 2000, 100);
    params.global.depth = Math.max(params.global.depth || 2000, 100);
    params.global.maxHeight = params.global.maxHeight !== undefined ? params.global.maxHeight : 300; // Allow any value including negative
    params.global.segments = Math.min(Math.max(params.global.segments || 1000, 50), 2000);
    params.global.offset = params.global.offset || 0;

    const safeColor = (color: any, fallback = { r: 0.5, g: 0.5, b: 0.5 }) => {
        if (!color) color = fallback;
        let r = typeof color.r === 'number' ? color.r : fallback.r;
        let g = typeof color.g === 'number' ? color.g : fallback.g;
        let b = typeof color.b === 'number' ? color.b : fallback.b;

        // Auto-convert 0-255 values if needed
        if (r > 1 || g > 1 || b > 1) {
            r /= 255; g /= 255; b /= 255;
        }
        // Only ensure valid 0-1 range
        return { 
            r: Math.min(Math.max(r, 0), 1), 
            g: Math.min(Math.max(g, 0), 1), 
            b: Math.min(Math.max(b, 0), 1) 
        };
    };

    // Color validation only (no creative restrictions)
    params.skybox.horizonColor = safeColor(params.skybox.horizonColor, { r: 0.6, g: 0.8, b: 1.0 });
    params.skybox.zenithColor = safeColor(params.skybox.zenithColor, { r: 0.0, g: 0.1, b: 0.35 });
    params.skybox.atmosphereColor = safeColor(params.skybox.atmosphereColor, { r: 0.5, g: 0.5, b: 0.7 });
    params.skybox.atmosphereStrength = Math.max(params.skybox.atmosphereStrength || 0.05, 0);

    params.lighting.ambient.color = safeColor(params.lighting.ambient.color, { r: 0.1, g: 0.1, b: 0.2 });
    params.lighting.ambient.intensity = Math.max(params.lighting.ambient.intensity !== undefined ? params.lighting.ambient.intensity : 0.3, 0);
    params.lighting.directional.color = safeColor(params.lighting.directional.color, { r: 0.8, g: 0.8, b: 0.8 });
    params.lighting.directional.intensity = Math.max(params.lighting.directional.intensity !== undefined ? params.lighting.directional.intensity : 0.5, 0);
    
    // Ensure position exists
    params.lighting.directional.position = params.lighting.directional.position || { x: 100, y: 100, z: 50 };

    const safeNoise = (layer: any) => {
        layer = layer || {};
        layer.seed = layer.seed !== undefined ? layer.seed : Math.floor(Math.random() * 65536);
        layer.scale = Math.max(layer.scale || 0.01, 0.000001); // Prevent divide by zero only
        layer.octaves = Math.min(Math.max(Math.round(layer.octaves || 4), 1), 16); // Prevent performance issues only
        layer.persistence = Math.min(Math.max(layer.persistence || 0.5, 0.01), 0.99); // Prevent instability only
        layer.lacunarity = Math.max(layer.lacunarity || 2.0, 1.01); // Prevent infinite loops only
        layer.amplitude = layer.amplitude !== undefined ? layer.amplitude : 50; // NO LIMITS!
        layer.baseHeight = layer.baseHeight !== undefined ? layer.baseHeight : 0; // NO LIMITS!
        return layer;
    };

    // Apply minimal safety validation only
    params.terrain.base = safeNoise(params.terrain.base);
    params.terrain.mountains = safeNoise(params.terrain.mountains);
    params.terrain.details = safeNoise(params.terrain.details);

    params.environment.temperature = safeNoise(params.environment.temperature);
    params.environment.moisture = safeNoise(params.environment.moisture);

    params.biomeControl.seed = params.biomeControl.seed !== undefined ? params.biomeControl.seed : Math.floor(Math.random() * 65536);
    params.biomeControl.scale = Math.max(params.biomeControl.scale || 0.001, 0.000001);
    params.biomeControl.octaves = Math.min(Math.max(Math.round(params.biomeControl.octaves || 2), 1), 8);

    // Ensure at least one biome
    if (params.biomes.length === 0) {
        params.biomes.push({ 
            name: 'Default', 
            controlRange: [-1.0, 1.0], 
            terrainParams: { baseHeight: 10, scale: 0.01, octaves: 4, persistence: 0.5, lacunarity: 2.0, amplitude: 20 }, 
            colorRamp: [{ stop: 0, color: { r: 1, g: 0, b: 1 } }]
        });
    }

    // Validate biome structure only
    params.biomes.forEach((biome: any) => {
        biome.controlRange = biome.controlRange || [-1.0, 1.0];
        biome.controlRange[0] = Math.min(Math.max(biome.controlRange[0], -1.0), 1.0);
        biome.controlRange[1] = Math.min(Math.max(biome.controlRange[1], -1.0), 1.0);

        biome.terrainParams = safeNoise(biome.terrainParams);

        biome.colorRamp = biome.colorRamp || [{ stop: 0, color: { r: 1, g: 0, b: 1 } }];
        biome.colorRamp.forEach((stop: any) => {
            stop.color = safeColor(stop.color);
            stop.stop = Math.min(Math.max(stop.stop || 0, 0), 1);
        });

        // Validate material properties
        if (biome.material) {
            const mat = biome.material;
            mat.transparency = mat.transparency !== undefined ? Math.min(Math.max(mat.transparency, 0), 1) : undefined;
            mat.reflectivity = mat.reflectivity !== undefined ? Math.min(Math.max(mat.reflectivity, 0), 1) : undefined;
            mat.emission = mat.emission !== undefined ? Math.min(Math.max(mat.emission, 0), 1) : undefined;
            mat.metalness = mat.metalness !== undefined ? Math.min(Math.max(mat.metalness, 0), 1) : undefined;
            mat.roughness = mat.roughness !== undefined ? Math.min(Math.max(mat.roughness, 0), 1) : undefined;
            mat.ior = mat.ior !== undefined ? Math.min(Math.max(mat.ior, 1.0), 2.5) : undefined;
            mat.iridescence = mat.iridescence !== undefined ? Math.min(Math.max(mat.iridescence, 0), 1) : undefined;
            mat.isWater = mat.isWater || false;
            if (mat.flowDirection) {
                mat.flowDirection.x = mat.flowDirection.x || 0;
                mat.flowDirection.y = mat.flowDirection.y || 0;
            }
        }
    });

    console.log('✨ UNLIMITED terrain parameters validated:', params);
    return params;
}
