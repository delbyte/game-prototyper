import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Asset } from "./types";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);

const SKETCHFAB_API_URL = 'https://api.sketchfab.com/v3';
const SKETCHFAB_API_TOKEN = import.meta.env.VITE_SKETCHFAB_API_TOKEN;

export async function searchSketchfab(query: string): Promise<Asset[]> {
    if (!SKETCHFAB_API_TOKEN) {
        console.warn('Sketchfab API token not set. Falling back to sample assets.');
        return fetch('/server/sample-assets.json').then(res => res.json());
    }

    const response = await fetch(`${SKETCHFAB_API_URL}/search?type=models&q=${query}&downloadable=true`, {
        headers: {
            Authorization: `Token ${SKETCHFAB_API_TOKEN}`,
        },
    });

    if (!response.ok) {
        console.error('Sketchfab API error:', response.status, response.statusText);
        return fetch('/server/sample-assets.json').then(res => res.json());
    }

    const data = await response.json();

    return data.results.map((model: any) => ({
        id: model.uid,
        name: model.name,
        description: model.description,
        source: 'sketchfab',
        url: model.viewerUrl,
        thumbnailUrl: model.thumbnails.images[0].url,
        tags: model.tags.map((tag: any) => tag.name),
    }));
}

export async function getSketchfabModelDownloadUrl(uid: string): Promise<{ url: string; size: number } | null> {
    if (!SKETCHFAB_API_TOKEN) {
        console.error('Sketchfab API token not set.');
        return null;
    }

    // Use 'Bearer' as per the new documentation
    const response = await fetch(`${SKETCHFAB_API_URL}/models/${uid}/download`, {
        headers: {
            Authorization: `Bearer ${SKETCHFAB_API_TOKEN}`,
        },
        mode: 'cors'
    });

    if (!response.ok) {
        console.error('Failed to get Sketchfab model download URL:', response.status, response.statusText);
        // Log the response body for more details if available
        try {
            const errorBody = await response.json();
            console.error('Error details:', errorBody);
        } catch (e) {
            // response body might not be json
        }
        return null;
    }

    const data = await response.json();
    
    // The new docs show the response is an object with gltf, usdz, etc.
    // We want the gltf object which contains the url and size.
    if (data.gltf) {
        return data.gltf;
    } else {
        console.error('No glTF download available for this model.');
        return null;
    }
}


export async function generateTerrainParameters(prompt: string): Promise<any> {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash"});

        const fullPrompt = `
        You are a deterministic world-building engine for a real-time Three.js terrain generator. Produce ONLY valid JSON (no explanation, no commentary) that the client will ingest directly. Maintain the exact structure shown in the reference example below. If any field is optional for a particular design, still include it with a safe default.

        IMPORTANT: Follow these rules strictly:
        - Output MUST be parsable JSON and match the structure used by the app (global, skybox, lighting, biomes).
        - Do not include human-readable commentary, markdown fences, or extra keys.
        - Respect the numeric ranges and types specified in the VALUE RANGES section.
        - When the user's prompt includes a shorthand description OR it is implied that the terrain is of a certain type(e.g., "superflat", "huge peaks", "rolling hills", "islands", "canyons", "terraced", "savannah"), translate it into precise parameter adjustments using the mapping rules below.
        - Prefer predictable, repeatable parameter choices. If a seed is helpful, include "seed": <integer> in global (optional), but it's not required.

        HOW THE PARAMETERS MAP TO STYLES (deterministic rule mappings):
        - "superflat" / "flat": set noiseScale -> maximum (0.025), octaves -> absolute minimum (3), heightMultiplier -> extremely low (0.001-0.01), baseHeight -> tiny constant (0.001-0.01), persistence -> very low (0.3). Result: nearly perfectly flat terrain with microscopic variations only.
        - "gentle rolling" / "rolling hills": noiseScale -> mid-high, octaves -> 3-5, heightMultiplier -> low (0.1-0.4), baseHeight moderate. Soft transitions and long wavelengths.
        - "huge peaks" / "jagged mountains": noiseScale -> low (small values for large features), octaves -> high (6-8), persistence -> higher (0.5-0.7), lacunarity -> 2.0-2.8, heightMultiplier -> toward upper range to produce tall relief.
        - "plateau" / "mesa": combine a large low-frequency base (noiseScale low) plus a second octave with high persistence and clamp plateau tops via baseHeight near upper percent of maxHeight.
        - "islands" / "archipelago": bias baseHeight so sea-level sits at low values; use biome masks (biomeScale small) to place land patches; use higher noiseScale for isolated peaks per island.
        - "canyons" / "ravines": use anisotropic noise by setting noiseScale X/Z differences (prefer lower-level detail in one axis) and add negative baseHeight offset plus deeper heightMultiplier locally in a biome.
        - "terraced" / "farmland": use low-frequency base with quantized height steps (simulate by recommending small heightMultiplier but larger baseHeight steps; client can quantize during generation).
        - "floating" / "floating islands": put biome with high baseHeight and small local islands (biomeScale small), increase atmosphere/zenith contrast and set gravity-agnostic visuals; (note: client must treat islands as separate meshes).

        TECHNICAL CONSTRAINTS & PERFORMANCE (must keep these):
        - segments: triangle density (400-1500). Reduce segments for larger worlds. Default ~1000 for good detail.
        - octaves: 3-8. Use more octaves only when the style needs finer detail (mountains). More octaves cost more CPU.
        - noiseScale: 0.005-0.025. Smaller values => larger features (mountains, wide valleys). Larger values => fine detail.
        - biomeScale: 0.003-0.008. Smaller => larger regions; larger => more frequent biome changes.
        - heightMultiplier: 0.3-1.8 (use smaller values for flat/rolling; higher values for dramatic peaks).
        - All colors: 0.0-1.0 (if values are outside this, assume user mistakenly gave 0-255; convert by dividing by 255).
        - Keep lighting intensities 0.2-0.8 and atmosphereStrength 0.01-0.15 for rendering reliability.

        EXTRA GUIDELINES FOR ROBUSTNESS:
        - If the user requests a named real-world style ("Alpine", "Sahara", "Amazon"), favor realistic parameter mixes (e.g., Alpine -> high heightMultiplier, low noiseScale; Sahara -> very low heightMultiplier, sandy colors, higher baseHeight for dunes).
        - If the user asks for a hybrid (e.g., "volcanic islands with snow caps"), produce multiple biomes: volcanic base + snow-capped peaks with height-based palette steps and a blending band.
  - Provide an explicit dominant "mood" tag: include top-level string field "mood" with values like "bright", "moody", "sunset", "alien", or "neutral" to help UI choices.
  - Provide an explicit dominant biome signal: include top-level fields "dominantBiome" and "dominantCoverage". "dominantBiome" may be the name of the biome (string) or the zero-based index into the "biomes" array (integer). "dominantCoverage" must be a decimal between 0.5 and 0.95 indicating the fraction of the map covered by the dominant biome. When the user says "mostly stone mountains" or similar, set the dominant biome to the appropriate biome and choose dominantCoverage between 0.7-0.95 depending on wording ("mostly" -> 0.7-0.85, "almost entirely" -> 0.85-0.95). The generator must still include the full "biomes" array describing the other, smaller biomes.
  - Provide elevation color bands to enable Y-level overrides (ice caps, glaciers, lava flows). Optionally include a top-level array field "elevationColorBands": an ordered list of objects { "min": <0-1>, "max": <0-1>, "color": {r,g,b} } where min/max are normalized heights (0 = lowest, 1 = highest) and color uses 0-1 RGB values. Use these bands to indicate zones that should override/blend with biome colors (e.g., ice cap: min=0.85, max=1.0, color={r:0.95,g:0.95,b:1.0}). Ensure bands do not overlap excessively and are within [0,1].
        - When requested "superflat" or "flat runways" ensure segments remain sufficient to cover area but use minimal vertical variance; do not produce large noise amplitudes.

        OUTPUT REQUIREMENTS:
        - Return JSON only. Keep keys: global, skybox, lighting, biomes. You may add an optional top-level "seed" and "mood".
  - Optionally include top-level: "dominantBiome" (string or integer) and "dominantCoverage" (0.5-0.95) to indicate which biome should cover most of the map and by how much.
  - Optionally include top-level: "elevationColorBands" as described above so the client can apply Y-level color overrides (bands normalized 0..1 with RGB colors 0..1).
        - For each biome include: name, noiseScale, octaves, persistence, lacunarity, heightMultiplier, baseHeight, colors { low, mid, high }.
        - Make numeric choices conservative but faithful to the user's intent. Avoid extreme values unless the user explicitly asked for them.

        REFERENCE EXAMPLE (preserve structure and types; use similar ranges):
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
            }
          ]
  }

  Now generate parameters tailored to this user request (as JSON only): ${JSON.stringify(prompt)}
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
  // Ensure params and nested objects exist
  params = params || {};
  params.global = params.global || {};
  params.skybox = params.skybox || {};
  params.lighting = params.lighting || { ambient: {}, directional: {} };
  params.lighting.ambient = params.lighting.ambient || {};
  params.lighting.directional = params.lighting.directional || { position: {} };
  params.biomes = Array.isArray(params.biomes) && params.biomes.length ? params.biomes : [
    {
      name: 'Default',
      noiseScale: 0.015,
      octaves: 4,
      persistence: 0.5,
      lacunarity: 2.0,
      heightMultiplier: 0.8,
      baseHeight: 0.1,
      colors: {
        low: { r: 0.1, g: 0.2, b: 0.1 },
        mid: { r: 0.3, g: 0.4, b: 0.3 },
        high: { r: 0.7, g: 0.7, b: 0.6 }
      }
    }
  ];

  // Clamp global values to safe ranges (match the prompt ranges)
  params.global.width = Math.min(Math.max(params.global.width || 2000, 1000), 2500);
  params.global.depth = Math.min(Math.max(params.global.depth || 2000, 1000), 2500);
  params.global.maxHeight = Math.min(Math.max(params.global.maxHeight || 100, 50), 150);
  // segments: triangle density (400-1500). Default ~1000.
  params.global.segments = Math.min(Math.max(params.global.segments || 1000, 400), 1500);
  // biomeScale: 0.003-0.008 per prompt guidance
  params.global.biomeScale = Math.min(Math.max(params.global.biomeScale || 0.005, 0.003), 0.008);

  // Clamp color values and handle both 0-1 and 0-255 ranges, with safe fallback
  const clampColor = (color: any, fallback = { r: 0.5, g: 0.5, b: 0.5 }) => {
    if (!color) color = fallback;
    let r = typeof color.r === 'number' ? color.r : fallback.r;
    let g = typeof color.g === 'number' ? color.g : fallback.g;
    let b = typeof color.b === 'number' ? color.b : fallback.b;

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
  params.skybox.horizonColor = clampColor(params.skybox.horizonColor, { r: 0.6, g: 0.8, b: 1.0 });
  params.skybox.zenithColor = clampColor(params.skybox.zenithColor, { r: 0.0, g: 0.1, b: 0.35 });
  params.skybox.atmosphereColor = clampColor(params.skybox.atmosphereColor, { r: 0.5, g: 0.5, b: 0.7 });
  params.skybox.atmosphereStrength = Math.min(Math.max(params.skybox.atmosphereStrength || 0.05, 0), 0.2);

  // Clamp lighting values (keep within safe intensity ranges)
  params.lighting.ambient.color = clampColor(params.lighting.ambient.color, { r: 0.1, g: 0.1, b: 0.2 });
  params.lighting.ambient.intensity = Math.min(Math.max(params.lighting.ambient.intensity || 0.3, 0.2), 0.8);
  params.lighting.directional.color = clampColor(params.lighting.directional.color, { r: 0.8, g: 0.8, b: 0.8 });
  params.lighting.directional.intensity = Math.min(Math.max(params.lighting.directional.intensity || 0.5, 0.2), 0.8);

  // Ensure directional light position is reasonable
  params.lighting.directional.position.x = Math.min(Math.max(params.lighting.directional.position.x || 100, -150), 150);
  params.lighting.directional.position.y = Math.min(Math.max(params.lighting.directional.position.y || 100, 50), 150);
  params.lighting.directional.position.z = Math.min(Math.max(params.lighting.directional.position.z || 50, -150), 150);

  // Clamp biome values (use ranges from the prompt: noiseScale 0.005-0.025, octaves 3-8, persistence 0.3-0.7, lacunarity 1.8-2.8, heightMultiplier 0.3-1.8)
  params.biomes.forEach((biome: any) => {
    biome.noiseScale = Math.min(Math.max(biome.noiseScale || 0.015, 0.005), 0.025);
    biome.octaves = Math.min(Math.max(Math.round(biome.octaves || 4), 3), 8);
    biome.persistence = Math.min(Math.max(typeof biome.persistence === 'number' ? biome.persistence : 0.5, 0.3), 0.7);
    biome.lacunarity = Math.min(Math.max(typeof biome.lacunarity === 'number' ? biome.lacunarity : 2.0, 1.8), 2.8);
    biome.heightMultiplier = Math.min(Math.max(typeof biome.heightMultiplier === 'number' ? biome.heightMultiplier : 0.8, 0.3), 1.8);
    biome.baseHeight = Math.min(Math.max(typeof biome.baseHeight === 'number' ? biome.baseHeight : 0.1, 0.0), 0.4);

    biome.colors = biome.colors || {};
    biome.colors.low = clampColor(biome.colors.low, { r: 0.1, g: 0.1, b: 0.1 });
    biome.colors.mid = clampColor(biome.colors.mid, { r: 0.3, g: 0.3, b: 0.25 });
    biome.colors.high = clampColor(biome.colors.high, { r: 0.8, g: 0.8, b: 0.7 });
  });

  // Validate dominantBiome / dominantCoverage if present, or provide defaults
  if (params.dominantCoverage == null) {
    // default to majority coverage but not complete takeover
    params.dominantCoverage = 0.6;
  }
  // clamp to allowed 0.5 - 0.95
  params.dominantCoverage = Math.min(Math.max(params.dominantCoverage, 0.5), 0.95);

  if (params.dominantBiome == null) {
    // default to first biome
    params.dominantBiome = 0;
  } else {
    // if numeric, ensure it's a valid index into biomes; if string, leave as-is
    if (typeof params.dominantBiome === 'number') {
      const idx = Math.round(params.dominantBiome);
      params.dominantBiome = Math.min(Math.max(idx, 0), params.biomes.length - 1);
    }
  }

  // Normalize elevationColorBands if provided
  if (!Array.isArray(params.elevationColorBands)) {
    params.elevationColorBands = [];
  } else {
    params.elevationColorBands = params.elevationColorBands.map((band: any) => {
      const min = Math.min(Math.max(typeof band.min === 'number' ? band.min : 0, 0), 1);
      const max = Math.min(Math.max(typeof band.max === 'number' ? band.max : 1, 0), 1);
      const correctedMin = Math.min(min, max);
      const correctedMax = Math.max(min, max);
      const color = clampColor(band.color, { r: 1, g: 1, b: 1 });
      return { min: correctedMin, max: correctedMax, color };
    }).filter((b: any) => b.max > b.min);
  }

  console.log('Validated terrain parameters:', params);
  return params;
}