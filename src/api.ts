import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);

export async function generateTerrainParameters(prompt: string): Promise<any> {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash"});

        const fullPrompt = `
        You are a creative world-building assistant for a real-time 3D terrain generator built with Three.js and WebGL. Your JSON output will be directly used to:

        **HOW YOUR OUTPUT IS USED:**
        1. **Terrain Generation**: Uses Perlin noise with your biome parameters to generate mesh vertices in real-time
        2. **Skybox Rendering**: Creates procedural sky using fragment shaders with your skybox colors
        3. **3D Lighting**: Sets up Three.js ambient and directional lights with shadows for realistic illumination
        4. **Real-time Performance**: Must render at 60fps, so parameters need to be performance-optimized

        **TECHNICAL CONSTRAINTS & OPTIMIZATION:**
        - **segments**: Controls mesh triangle count (400-1000). Higher = more detail but slower rendering
        - **octaves**: Perlin noise layers (4-8). More = more detail but exponentially slower computation
        - **noiseScale**: Terrain feature size (0.005-0.025). Smaller = larger mountains/valleys
        - **biomeScale**: Biome region size (0.003-0.008). Smaller = larger biome areas with smoother transitions
        - **Colors**: Three.js uses 0.0-1.0 range. Applied to vertex colors and lighting calculations
        - **heightMultiplier**: Scales terrain height (0.3-1.8). Too high creates unrealistic spikes
        - **Multiple Biomes**: Create 1-5 biomes that blend smoothly using distance-based interpolation

        **LIGHTING & SKYBOX SYSTEM:**
        - **Ambient Light**: Base illumination affecting all surfaces (like sky light)
        - **Directional Light**: Main light source (sun) with position, color, and shadow casting
        - **Skybox Shader**: Procedural gradient from horizonColor (bottom) to zenithColor (top)
        - **Atmosphere Effect**: Adds realistic haze around horizon using atmosphereColor

        **REFERENCE EXAMPLE (use similar value ranges and structure):**
        \`\`\`json
        {
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
        \`\`\`

        **CREATIVE STRATEGIES:**
        ✅ **DO:**
        - Create 2-5 biomes for visual variety (mountains, valleys, forests, deserts, etc.)
        - Use contrasting terrain parameters between biomes (smooth plains vs jagged mountains)
        - Match lighting and skybox to create cohesive atmosphere and mood
        - Consider time of day: bright daylight, golden sunset, moody twilight, or dark night
        - Use realistic color palettes that work together harmoniously
        - Think about the world's story/theme when choosing all parameters

        ✅ **SUCCESSFUL COMBINATIONS:**
        - **Tropical Paradise**: Bright blue sky, warm golden lighting, green/blue biomes
        - **Alien World**: Purple/magenta sky, cool blue lighting, unusual biome colors
        - **Post-Apocalyptic**: Orange/brown sky, harsh lighting, burnt/grey biomes
        - **Fantasy Realm**: Magical colors, ethereal lighting, vibrant fantasy biomes

        **VALUE RANGES (CRITICAL - stay within these):**
        - global.width/depth: 1500-2500
        - global.maxHeight: 80-200
        - global.segments: 400-1000
        - global.biomeScale: 0.003-0.008 (smaller = larger biome regions)
        - noiseScale: 0.005-0.025 (smaller = smoother, larger terrain features)
        - octaves: 4-8 (more = more detail)
        - persistence: 0.3-0.7
        - lacunarity: 1.8-2.8
        - heightMultiplier: 0.3-1.8
        - baseHeight: 0.0-0.6
        - All color r,g,b: 0.0-1.0 (NEVER use 0-255 range)
        - lighting intensities: 0.2-0.8
        - atmosphereStrength: 0.01-0.15

        **SKYBOX EXAMPLES FOR INSPIRATION:**
        - Bright Day: horizonColor ~{0.9,0.9,1.0}, zenithColor ~{0.5,0.7,1.0}
        - Golden Sunset: horizonColor ~{1.0,0.7,0.3}, zenithColor ~{0.3,0.1,0.7}
        - Dark Night: horizonColor ~{0.1,0.1,0.2}, zenithColor ~{0.0,0.0,0.1}
        - Alien Sky: horizonColor ~{0.8,0.3,0.8}, zenithColor ~{0.2,0.8,0.4}

        **Your Mission:** Create a cohesive, visually stunning 3D world that brings this prompt to life: ${JSON.stringify(prompt)}
        
        Think about atmosphere, mood, and visual storytelling. Make skybox, lighting, and terrain biomes work together to create an immersive, believable world.
    `;

        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        
        // Handle the new Gemini response structure
        let text: string;
        if (response.candidates && response.candidates[0]?.content?.parts?.[0]?.text) {
            text = response.candidates[0].content.parts[0].text;
        } else {
            text = await response.text();
        }

        // Remove the markdown ```json and ``` from the response
        const jsonText = text.replace(/```json\n?/g, "").replace(/\n?```/g, "").trim();
        const parsedData = JSON.parse(jsonText);
        
        // Validate and clamp all values to safe ranges
        return validateAndClampParameters(parsedData);
    } catch (error) {
        console.error('Error generating terrain parameters:', error);
        throw new Error(`Failed to generate terrain: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

function validateAndClampParameters(params: any): any {
    // Clamp global values to safe ranges
    params.global.width = Math.min(Math.max(params.global.width || 2000, 1000), 2500);
    params.global.depth = Math.min(Math.max(params.global.depth || 2000, 1000), 2500);
    params.global.maxHeight = Math.min(Math.max(params.global.maxHeight || 100, 50), 150);
    params.global.segments = Math.min(Math.max(params.global.segments || 400, 200), 500);
    params.global.biomeScale = Math.min(Math.max(params.global.biomeScale || 0.005, 0.002), 0.008);
    
    // Clamp color values and handle both 0-1 and 0-255 ranges
    const clampColor = (color: any) => {
        let r = color.r;
        let g = color.g;
        let b = color.b;
        
        // If values are > 1, assume they're in 0-255 range and convert
        if (r > 1 || g > 1 || b > 1) {
            r = r / 255;
            g = g / 255;
            b = b / 255;
        }
        
        return {
            r: Math.min(Math.max(r, 0), 1),
            g: Math.min(Math.max(g, 0), 1),
            b: Math.min(Math.max(b, 0), 1)
        };
    };
    
    // Clamp skybox colors
    params.skybox.horizonColor = clampColor(params.skybox.horizonColor);
    params.skybox.zenithColor = clampColor(params.skybox.zenithColor);
    params.skybox.atmosphereColor = clampColor(params.skybox.atmosphereColor);
    params.skybox.atmosphereStrength = Math.min(Math.max(params.skybox.atmosphereStrength || 0.05, 0), 0.2);
    
    // Clamp lighting values
    params.lighting.ambient.color = clampColor(params.lighting.ambient.color);
    params.lighting.ambient.intensity = Math.min(Math.max(params.lighting.ambient.intensity || 0.6, 0.3), 0.8);
    params.lighting.directional.color = clampColor(params.lighting.directional.color);
    params.lighting.directional.intensity = Math.min(Math.max(params.lighting.directional.intensity || 0.8, 0.3), 0.8);
    
    // Ensure directional light position is reasonable
    params.lighting.directional.position.x = Math.min(Math.max(params.lighting.directional.position.x || 100, -150), 150);
    params.lighting.directional.position.y = Math.min(Math.max(params.lighting.directional.position.y || 100, 50), 150);
    params.lighting.directional.position.z = Math.min(Math.max(params.lighting.directional.position.z || 50, -150), 150);
    
    // Clamp biome values
    params.biomes.forEach((biome: any) => {
        biome.noiseScale = Math.min(Math.max(biome.noiseScale || 0.015, 0.008), 0.025);
        biome.octaves = Math.min(Math.max(Math.round(biome.octaves || 4), 3), 6);
        biome.persistence = Math.min(Math.max(biome.persistence || 0.5, 0.3), 0.6);
        biome.lacunarity = Math.min(Math.max(biome.lacunarity || 2.0, 1.8), 2.5);
        biome.heightMultiplier = Math.min(Math.max(biome.heightMultiplier || 0.8, 0.3), 1.2);
        biome.baseHeight = Math.min(Math.max(biome.baseHeight || 0.1, 0.0), 0.3);
        
        biome.colors.low = clampColor(biome.colors.low);
        biome.colors.mid = clampColor(biome.colors.mid);
        biome.colors.high = clampColor(biome.colors.high);
    });
    
    console.log('Validated terrain parameters:', params);
    return params;
}