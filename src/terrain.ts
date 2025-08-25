import * as THREE from 'three';
import { PerlinNoise } from './noise';
import type { BiomeProfile, NoiseParams, FullTerrainParameters } from './types';
import { getEnvironmentMap } from './renderer';

// Helper function for linear interpolation
function lerp(a: number, b: number, alpha: number): number {
    return a * (1 - alpha) + b * alpha;
}

export class TerrainGenerator {
    noise: PerlinNoise;
    biomeControlNoise: PerlinNoise;

    width: number;
    depth: number;
    maxHeight: number;
    segments: number;
    
    terrainParams: FullTerrainParameters;
    biomes: BiomeProfile[];

    mesh: THREE.Mesh | null;
    heightMap: number[][];

    constructor(params: FullTerrainParameters) {
        this.terrainParams = params;
        this.noise = new PerlinNoise(); // General purpose noise
        this.biomeControlNoise = new PerlinNoise(this.terrainParams.biomeControl.seed);

        this.width = this.terrainParams.global.width;
        this.depth = this.terrainParams.global.depth;
        this.maxHeight = this.terrainParams.global.maxHeight;
        this.segments = this.terrainParams.global.segments;
        
        this.biomes = this.terrainParams.biomes;
        // Sort biomes by control range to ensure correct lookups
        this.biomes.sort((a, b) => a.controlRange[0] - b.controlRange[0]);

        this.mesh = null;
        this.heightMap = [];
    }

    private getBiomeInfo(worldX: number, worldZ: number): { primaryBiome: BiomeProfile, blendedParams: NoiseParams } {
        const controlNoise_params = this.terrainParams.biomeControl;
        const controlValue = this.biomeControlNoise.fBm(worldX, worldZ, controlNoise_params);

        let primaryBiome: BiomeProfile = this.biomes[this.biomes.length - 1];
        let nextBiome: BiomeProfile | null = null;

        // Find the current biome and the next biome
        for (let i = 0; i < this.biomes.length; i++) {
            if (controlValue >= this.biomes[i].controlRange[0] && controlValue < this.biomes[i].controlRange[1]) {
                primaryBiome = this.biomes[i];
                if (i + 1 < this.biomes.length) {
                    nextBiome = this.biomes[i + 1];
                }
                break;
            }
        }

        const transitionWidth = 0.1; // Use 10% of the control value space for transitions
        const boundary = primaryBiome.controlRange[1];
        
        let blendedParams = { ...primaryBiome.terrainParams };

        if (nextBiome && controlValue > boundary - transitionWidth) {
            // We are in the transition zone, calculate the blend factor (alpha)
            const alpha = (controlValue - (boundary - transitionWidth)) / transitionWidth;
            
            const paramsA = primaryBiome.terrainParams;
            const paramsB = nextBiome.terrainParams;

            // Linearly interpolate all terrain parameters
            blendedParams = {
                baseHeight: lerp(paramsA.baseHeight || 0, paramsB.baseHeight || 0, alpha),
                scale: lerp(paramsA.scale, paramsB.scale, alpha),
                octaves: lerp(paramsA.octaves, paramsB.octaves, alpha),
                persistence: lerp(paramsA.persistence || 0.5, paramsB.persistence || 0.5, alpha),
                lacunarity: lerp(paramsA.lacunarity || 2.0, paramsB.lacunarity || 2.0, alpha),
                amplitude: lerp(paramsA.amplitude || 0, paramsB.amplitude || 0, alpha),
                seed: paramsA.seed // Seed should not be blended
            };
        }

        return { primaryBiome, blendedParams };
    }

    private calculateElevation(worldX: number, worldZ: number, biomeParams: NoiseParams): number {
        const params = {
            seed: 0,
            persistence: 0.5,
            lacunarity: 2.0,
            amplitude: 1,
            baseHeight: 0,
            ...biomeParams
        };
        const noiseVal = this.noise.fBm(worldX, worldZ, params);
        return params.baseHeight + noiseVal * params.amplitude;
    }

    private getBiomeTerrainColor(biome: BiomeProfile, height: number): { r: number, g: number, b: number } {
        const ramp = biome.colorRamp;
        if (!ramp || ramp.length === 0) return { r: 1, g: 0, b: 1 }; // Default to magenta if no ramp

        const { baseHeight, amplitude } = biome.terrainParams;
        const minBiomeHeight = (baseHeight || 0) - (amplitude || 0);
        const maxBiomeHeight = (baseHeight || 0) + (amplitude || 0);

        const normalizedHeight = (height - minBiomeHeight) / (maxBiomeHeight - minBiomeHeight);

        // Find the correct color in the ramp
        let color = ramp[ramp.length - 1].color;
        for (let i = 0; i < ramp.length - 1; i++) {
            const start = ramp[i];
            const end = ramp[i + 1];
            if (normalizedHeight >= start.stop && normalizedHeight <= end.stop) {
                const t = (normalizedHeight - start.stop) / (end.stop - start.stop);
                color = {
                    r: lerp(start.color.r, end.color.r, t),
                    g: lerp(start.color.g, end.color.g, t),
                    b: lerp(start.color.b, end.color.b, t),
                };
                break;
            }
        }
        return color;
    }

    generateTerrain() {
        this.heightMap = [];
        // First pass: Generate the raw heightmap
        for (let z = 0; z <= this.segments; z++) {
            this.heightMap[z] = [];
            for (let x = 0; x <= this.segments; x++) {
                const worldX = (x / this.segments) * this.width - this.width / 2;
                const worldZ = (z / this.segments) * this.depth - this.depth / 2;

                const { blendedParams } = this.getBiomeInfo(worldX, worldZ);
                this.heightMap[z][x] = this.calculateElevation(worldX, worldZ, blendedParams);
            }
        }

        // Post-processing step to smooth slopes
        this.applySlopeLimiting();

        const vertices: number[] = [];
        const indices: number[] = [];
        const normals: number[] = [];
        const uvs: number[] = [];
        const colors: number[] = [];

        // Second pass: Create vertices and colors from the final heightmap
        for (let z = 0; z <= this.segments; z++) {
            for (let x = 0; x <= this.segments; x++) {
                const worldX = (x / this.segments) * this.width - this.width / 2;
                const worldZ = (z / this.segments) * this.depth - this.depth / 2;
                const height = this.heightMap[z][x];

                const { primaryBiome } = this.getBiomeInfo(worldX, worldZ);
                const color = this.getBiomeTerrainColor(primaryBiome, height);

                vertices.push(worldX, height, worldZ);
                uvs.push(x / this.segments, z / this.segments);
                colors.push(color.r, color.g, color.b);
            }
        }

        for (let z = 0; z < this.segments; z++) {
            for (let x = 0; x < this.segments; x++) {
                const a = x + (this.segments + 1) * z;
                const b = x + (this.segments + 1) * (z + 1);
                const c = (x + 1) + (this.segments + 1) * (z + 1);
                const d = (x + 1) + (this.segments + 1) * z;
                indices.push(a, b, d);
                indices.push(b, c, d);
            }
        }

        this.calculateNormals(vertices, indices, normals);

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.setIndex(indices);

        // Create advanced material based on biome properties
        const material = this.createAdvancedMaterial();

        // Clean up previous mesh
        if (this.mesh) {
            this.mesh.geometry.dispose();
            const mat: any = this.mesh.material;
            if (Array.isArray(mat)) {
                mat.forEach((m: any) => m && typeof m.dispose === 'function' && m.dispose());
            } else if (mat && typeof mat.dispose === 'function') {
                mat.dispose();
            }
        }

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.receiveShadow = true;
        this.mesh.castShadow = true;

        return this.mesh;
    }

    private createAdvancedMaterial(): THREE.Material {
        // Analyze biomes to determine what kind of material to create
        let hasTransparency = false;
        let hasReflectivity = false;
        let hasEmission = false;
        let hasIridescence = false;
        let hasWater = false;
        let maxTransparency = 0;
        let maxReflectivity = 0;
        let maxEmission = 0;
        let maxIridescence = 0;
        let maxMetalness = 0;
        let minRoughness = 1;

        this.biomes.forEach(biome => {
            if (biome.material) {
                const mat = biome.material;
                if (mat.transparency && mat.transparency > 0) {
                    hasTransparency = true;
                    maxTransparency = Math.max(maxTransparency, mat.transparency);
                }
                if (mat.reflectivity && mat.reflectivity > 0) {
                    hasReflectivity = true;
                    maxReflectivity = Math.max(maxReflectivity, mat.reflectivity);
                }
                if (mat.emission && mat.emission > 0) {
                    hasEmission = true;
                    maxEmission = Math.max(maxEmission, mat.emission);
                }
                if (mat.iridescence && mat.iridescence > 0) {
                    hasIridescence = true;
                    maxIridescence = Math.max(maxIridescence, mat.iridescence);
                }
                if (mat.isWater) {
                    hasWater = true;
                }
                if (mat.metalness) {
                    maxMetalness = Math.max(maxMetalness, mat.metalness);
                }
                if (mat.roughness !== undefined) {
                    minRoughness = Math.min(minRoughness, mat.roughness);
                }
            }
        });

        console.log('🎨 Material analysis:', { hasTransparency, hasReflectivity, hasEmission, hasIridescence, hasWater });

        // Create appropriate material based on features needed
        if (hasTransparency || hasReflectivity || hasIridescence || hasWater) {
            // Advanced material for glass, crystal, water effects
            const envMap = getEnvironmentMap();
            
            const material = new THREE.MeshPhysicalMaterial({
                vertexColors: true,
                transparent: hasTransparency,
                opacity: hasTransparency ? (1 - maxTransparency * 0.8) : 1,
                metalness: maxMetalness,
                roughness: minRoughness,
                envMap: envMap,
                envMapIntensity: hasReflectivity ? maxReflectivity * 2 : 0.5,
                clearcoat: hasReflectivity ? maxReflectivity : 0,
                clearcoatRoughness: 0.1,
                ior: 1.5, // Glass-like
                thickness: hasTransparency ? 1 : 0,
                transmission: hasTransparency ? maxTransparency : 0,
                sheen: hasIridescence ? maxIridescence : 0,
                sheenColor: hasIridescence ? new THREE.Color(1, 0.5, 1) : new THREE.Color(0, 0, 0),
                iridescence: hasIridescence ? maxIridescence : 0,
                iridescenceIOR: 1.8,
                iridescenceThicknessRange: [100, 800],
                emissive: hasEmission ? new THREE.Color(0.2, 0.2, 0.2) : new THREE.Color(0, 0, 0),
                emissiveIntensity: hasEmission ? maxEmission * 0.5 : 0
            });

            console.log('✨ Created advanced physical material with crystal/glass effects!');
            return material;
        } else if (hasEmission) {
            // Glowing material
            const material = new THREE.MeshStandardMaterial({
                vertexColors: true,
                emissive: new THREE.Color(0.1, 0.1, 0.1),
                emissiveIntensity: maxEmission * 0.8,
                metalness: maxMetalness,
                roughness: minRoughness
            });
            console.log('🌟 Created glowing material!');
            return material;
        } else {
            // Standard material
            const material = new THREE.MeshLambertMaterial({
                vertexColors: true,
                wireframe: false
            });
            console.log('🏔️ Created standard terrain material');
            return material;
        }
    }

    calculateNormals(vertices: number[], indices: number[], normals: number[]): void {
        // Initialize normals array
        for (let i = 0; i < vertices.length; i++) {
            normals[i] = 0;
        }

        // Calculate face normals and accumulate
        for (let i = 0; i < indices.length; i += 3) {
            const i1 = indices[i] * 3;
            const i2 = indices[i + 1] * 3;
            const i3 = indices[i + 2] * 3;

            const v1 = new THREE.Vector3(vertices[i1], vertices[i1 + 1], vertices[i1 + 2]);
            const v2 = new THREE.Vector3(vertices[i2], vertices[i2 + 1], vertices[i2 + 2]);
            const v3 = new THREE.Vector3(vertices[i3], vertices[i3 + 1], vertices[i3 + 2]);

            const edge1 = v2.clone().sub(v1);
            const edge2 = v3.clone().sub(v1);
            const normal = edge1.cross(edge2).normalize();

            // Add to vertex normals
            normals[i1] += normal.x;
            normals[i1 + 1] += normal.y;
            normals[i1 + 2] += normal.z;

            normals[i2] += normal.x;
            normals[i2 + 1] += normal.y;
            normals[i2 + 2] += normal.z;

            normals[i3] += normal.x;
            normals[i3 + 1] += normal.y;
            normals[i3 + 2] += normal.z;
        }

        // Normalize vertex normals
        for (let i = 0; i < normals.length; i += 3) {
            const length = Math.sqrt(
                normals[i] * normals[i] +
                normals[i + 1] * normals[i + 1] +
                normals[i + 2] * normals[i + 2]
            );
            if (length > 0) {
                normals[i] /= length;
                normals[i + 1] /= length;
                normals[i + 2] /= length;
            }
        }
    }

    getHeightAtPosition(x: number, z: number): number {
        // Convert world coordinates to grid coordinates
        const gridX = (x + this.width / 2) / this.width * this.segments;
        const gridZ = (z + this.depth / 2) / this.depth * this.segments;

        // Clamp to bounds
        const clampedX = Math.max(0, Math.min(this.segments, gridX));
        const clampedZ = Math.max(0, Math.min(this.segments, gridZ));

        // Get integer and fractional parts
        const x0 = Math.floor(clampedX);
        const z0 = Math.floor(clampedZ);
        const x1 = Math.min(this.segments, x0 + 1);
        const z1 = Math.min(this.segments, z0 + 1);

        const fx = clampedX - x0;
        const fz = clampedZ - z0;

        // Bilinear interpolation
        const h00 = this.heightMap[z0] ? this.heightMap[z0][x0] || 0 : 0;
        const h10 = this.heightMap[z0] ? this.heightMap[z0][x1] || 0 : 0;
        const h01 = this.heightMap[z1] ? this.heightMap[z1][x0] || 0 : 0;
        const h11 = this.heightMap[z1] ? this.heightMap[z1][x1] || 0 : 0;

        const h0 = h00 * (1 - fx) + h10 * fx;
        const h1 = h01 * (1 - fx) + h11 * fx;

        return h0 * (1 - fz) + h1 * fz;
    }

    applySlopeLimiting(): void {
        // Slope limiting disabled for unlimited creativity!
        // Users can create impossibly jagged peaks, floating islands, 
        // vertical cliffs, and any extreme terrain they want
        console.log('🏔️ Slope limiting disabled - UNLIMITED terrain freedom!');
    }

    regenerate(params: FullTerrainParameters) {
        this.terrainParams = params;
        this.noise = new PerlinNoise(); // General purpose noise
        this.biomeControlNoise = new PerlinNoise(this.terrainParams.biomeControl.seed);

        this.width = this.terrainParams.global.width;
        this.depth = this.terrainParams.global.depth;
        this.maxHeight = this.terrainParams.global.maxHeight;
        this.segments = this.terrainParams.global.segments;
        
        this.biomes = this.terrainParams.biomes;
        // Sort biomes by control range to ensure correct lookups
        this.biomes.sort((a, b) => a.controlRange[0] - b.controlRange[0]);
        
        return this.generateTerrain();
    }
}
