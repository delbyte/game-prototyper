import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);

export async function generateTerrainParameters(prompt: string): Promise<any> {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash"});

        const fullPrompt = `
        You are a creative world-building assistant. Your task is to generate a JSON object that describes a world based on the user's prompt. The JSON object must follow the EXACT structure and value ranges defined below. Do not include any other text or explanations in your response, only the JSON object.

        **CRITICAL VALUE RANGES (DO NOT EXCEED THESE):**
        - ALL COLOR VALUES: Must be between 0.0 and 1.0 (NOT 0-255 range)
        - global.width/depth: 1000-2500
        - global.maxHeight: 50-150
        - global.segments: 200-500 (higher = more detail but slower)
        - global.biomeScale: 0.002-0.008 (smaller = larger biome regions)
        - noiseScale: 0.008-0.025 (smaller = larger terrain features)
        - octaves: 3-6
        - persistence: 0.3-0.6
        - lacunarity: 1.8-2.5
        - heightMultiplier: 0.3-1.2
        - baseHeight: 0.0-0.3
        - lighting intensities: 0.3-0.8
        - directional.position: values like {x: 100, y: 100, z: 50}

        **JSON Structure:**

\`\`\`json
{
  "global": {
    "width": <number 1000-2500>,
    "depth": <number 1000-2500>,
    "maxHeight": <number 50-150>,
    "segments": <number 200-500>,
    "biomeScale": <number 0.002-0.008>
  },
  "skybox": {
    "horizonColor": { "r": <0.0-1.0>, "g": <0.0-1.0>, "b": <0.0-1.0> },
    "zenithColor": { "r": <0.0-1.0>, "g": <0.0-1.0>, "b": <0.0-1.0> },
    "atmosphereColor": { "r": <0.0-1.0>, "g": <0.0-1.0>, "b": <0.0-1.0> },
    "atmosphereStrength": <number 0.0-0.2>
  },
  "lighting": {
    "ambient": {
      "color": { "r": <0.0-1.0>, "g": <0.0-1.0>, "b": <0.0-1.0> },
      "intensity": <number 0.3-0.8>
    },
    "directional": {
      "color": { "r": <0.0-1.0>, "g": <0.0-1.0>, "b": <0.0-1.0> },
      "intensity": <number 0.3-0.8>,
      "position": { "x": <number -150 to 150>, "y": <number 50-150>, "z": <number -150 to 150> }
    }
  },
  "biomes": [
    {
      "name": "<string>",
      "noiseScale": <number 0.008-0.025>,
      "octaves": <number 3-6>,
      "persistence": <number 0.3-0.6>,
      "lacunarity": <number 1.8-2.5>,
      "heightMultiplier": <number 0.3-1.2>,
      "baseHeight": <number 0.0-0.3>,
      "colors": {
        "low": { "r": <0.0-1.0>, "g": <0.0-1.0>, "b": <0.0-1.0> },
        "mid": { "r": <0.0-1.0>, "g": <0.0-1.0>, "b": <0.0-1.0> },
        "high": { "r": <0.0-1.0>, "g": <0.0-1.0>, "b": <0.0-1.0> }
      }
    }
  ]
}
\`\`\`

        **EXAMPLES OF GOOD VALUES (use these as reference):**
        - noiseScale: 0.015 (NOT 75 or 500!)
        - heightMultiplier: 0.8 (NOT 90!)
        - baseHeight: 0.1 (NOT 10!)
        - biomeScale: 0.005 (NOT 500!)
        - Colors: { "r": 0.2, "g": 0.6, "b": 0.1 } (NOT { "r": 20, "g": 60, "b": 10 })
        - Daytime sky: horizonColor around { "r": 0.9, "g": 0.9, "b": 1.0 }, zenithColor around { "r": 0.5, "g": 0.7, "b": 1.0 }
        - Night sky: horizonColor around { "r": 0.1, "g": 0.1, "b": 0.2 }, zenithColor around { "r": 0.0, "g": 0.0, "b": 0.1 }

        **User Prompt:** ${JSON.stringify(prompt)}
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