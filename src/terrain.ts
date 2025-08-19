import * as THREE from 'three';
import { PerlinNoise } from './noise';

interface BiomeColor {
    r: number;
    g: number;
    b: number;
}

interface Biome {
    name: string;
    noiseScale: number;
    octaves: number;
    persistence: number;
    lacunarity: number;
    heightMultiplier: number;
    baseHeight: number;
    colors: {
        low: BiomeColor;
        mid: BiomeColor;
        high: BiomeColor;
    };
}

export class TerrainGenerator {
    noise: PerlinNoise;
    biomeNoise: PerlinNoise;
    width: number;
    depth: number;
    maxHeight: number;
    segments: number;
    biomeScale: number;
    biomes: { [key: string]: Biome };
    biomeList: string[];
    // Optional dominant biome index or name and coverage fraction (0.5-0.95)
    dominantBiome: number | string | null;
    dominantCoverage: number;
    // Optional elevation color bands applied after biome color blending
    elevationColorBands: Array<{ min: number; max: number; color: BiomeColor }>;
    mesh: THREE.Mesh | null;
    heightMap: number[][];

    constructor(params: any = null) {
        this.noise = new PerlinNoise();
        this.biomeNoise = new PerlinNoise(); // Separate noise for biome distribution

        if (params) {
            this.width = params.global.width;
            this.depth = params.global.depth;
            this.maxHeight = params.global.maxHeight;
            this.segments = params.global.segments;
            this.biomeScale = params.global.biomeScale;
            this.biomes = {};
            params.biomes.forEach((biome: Biome) => {
                this.biomes[biome.name] = biome;
            });
        } else {
            this.width = 2000;
            this.depth = 2000;
            this.maxHeight = 100;
            this.segments = 1000;
            this.biomeScale = 0.003; // Larger biome regions
            this.biomes = {
                plains: {
                    name: 'Plains',
                    noiseScale: 0.015,
                    octaves: 4,
                    persistence: 0.4,
                    lacunarity: 2.0,
                    heightMultiplier: 0.3,
                    baseHeight: 0.1,
                    colors: {
                        low: { r: 0.2, g: 0.6, b: 0.1 },    // Green grass
                        mid: { r: 0.3, g: 0.7, b: 0.2 },    // Lighter green
                        high: { r: 0.4, g: 0.5, b: 0.3 }    // Hills
                    }
                },
                mountains: {
                    name: 'Mountains',
                    noiseScale: 0.008,
                    octaves: 8,
                    persistence: 0.6,
                    lacunarity: 2.5,
                    heightMultiplier: 1.2,
                    baseHeight: 0.2,
                    colors: {
                        low: { r: 0.3, g: 0.5, b: 0.2 },    // Forest green
                        mid: { r: 0.5, g: 0.5, b: 0.5 },    // Rocky gray
                        high: { r: 0.9, g: 0.9, b: 0.9 }    // Snow
                    }
                },
                desert: {
                    name: 'Desert',
                    noiseScale: 0.02,
                    octaves: 3,
                    persistence: 0.3,
                    lacunarity: 1.8,
                    heightMultiplier: 0.4,
                    baseHeight: 0.0,
                    colors: {
                        low: { r: 0.8, g: 0.7, b: 0.4 },    // Sand
                        mid: { r: 0.7, g: 0.6, b: 0.3 },    // Darker sand
                        high: { r: 0.6, g: 0.5, b: 0.3 }    // Rocky sand
                    }
                },
                forest: {
                    name: 'Forest',
                    noiseScale: 0.025,
                    octaves: 6,
                    persistence: 0.5,
                    lacunarity: 2.2,
                    heightMultiplier: 0.6,
                    baseHeight: 0.15,
                    colors: {
                        low: { r: 0.1, g: 0.4, b: 0.1 },    // Dark green
                        mid: { r: 0.2, g: 0.5, b: 0.1 },    // Forest green
                        high: { r: 0.3, g: 0.6, b: 0.2 }    // Light green
                    }
                },
                tundra: {
                    name: 'Tundra',
                    noiseScale: 0.012,
                    octaves: 5,
                    persistence: 0.45,
                    lacunarity: 2.0,
                    heightMultiplier: 0.5,
                    baseHeight: 0.05,
                    colors: {
                        low: { r: 0.6, g: 0.7, b: 0.8 },    // Icy blue
                        mid: { r: 0.7, g: 0.7, b: 0.7 },    // Gray
                        high: { r: 0.9, g: 0.9, b: 0.9 }    // Snow
                    }
                }
            };
        }

        this.biomeList = Object.keys(this.biomes);
        // Read optional dominant biome and coverage from params
        if (params && params.dominantBiome != null) {
            // Accept either a numeric index or a biome name
            this.dominantBiome = params.dominantBiome;
        } else {
            this.dominantBiome = null;
        }
        this.dominantCoverage = params && typeof params.dominantCoverage === 'number' ? Math.min(Math.max(params.dominantCoverage, 0.5), 0.95) : 0.6;

        // Elevation color bands (optional): array of {min, max, color}
        this.elevationColorBands = (params && Array.isArray(params.elevationColorBands)) ? params.elevationColorBands : [];
        
        this.mesh = null;
        this.heightMap = [];
    }

    // Determine biome at a given world position
    getBiomeAtPosition(worldX: number, worldZ: number): Biome {
        // Use biome noise to determine which biome this position belongs to
        const biomeValue = this.biomeNoise.fractalNoise(worldX, worldZ, 3, 0.5, this.biomeScale);
        
        // Map noise value to biome index
        const normalizedValue = (biomeValue + 1) / 2; // Convert from [-1,1] to [0,1]

        // If a dominant biome is specified, bias the mapping so the dominant biome occupies ~dominantCoverage of the map
        if (this.dominantBiome != null) {
            // Resolve dominant biome index
            let dominantIndex: number;
            if (typeof this.dominantBiome === 'number') {
                dominantIndex = Math.max(0, Math.min(this.biomeList.length - 1, Math.round(this.dominantBiome)));
            } else {
                dominantIndex = this.biomeList.indexOf(String(this.dominantBiome));
                if (dominantIndex === -1) dominantIndex = 0;
            }

            const coverage = Math.min(Math.max(this.dominantCoverage || 0.6, 0.5), 0.95);

            if (normalizedValue < coverage) {
                return this.biomes[this.biomeList[dominantIndex]];
            } else {
                // Map the remaining [coverage,1] range to the other biomes
                const other = this.biomeList.filter((_, i) => i !== dominantIndex);
                if (other.length === 0) return this.biomes[this.biomeList[dominantIndex]];
                const remapped = (normalizedValue - coverage) / (1 - coverage); // [0,1]
                const idx = Math.floor(remapped * other.length);
                const clampedIdx = Math.max(0, Math.min(other.length - 1, idx));
                return this.biomes[other[clampedIdx]];
            }
        }

        const biomeIndex = Math.floor(normalizedValue * this.biomeList.length);
        const clampedIndex = Math.max(0, Math.min(this.biomeList.length - 1, biomeIndex));
        return this.biomes[this.biomeList[clampedIndex]];
    }

    // Blend between biomes for smooth transitions
    getBlendedBiomeParams(worldX: number, worldZ: number) {
        const sampleRadius = 100; // Distance to sample for blending
        const samples: Array<{ x: number; z: number; weight: number }> = [
            { x: worldX, z: worldZ, weight: 4 }, // Center sample has more weight
            { x: worldX + sampleRadius, z: worldZ, weight: 1 },
            { x: worldX - sampleRadius, z: worldZ, weight: 1 },
            { x: worldX, z: worldZ + sampleRadius, weight: 1 },
            { x: worldX, z: worldZ - sampleRadius, weight: 1 },
            // Add diagonal samples for better blending
            { x: worldX + sampleRadius * 0.7, z: worldZ + sampleRadius * 0.7, weight: 0.5 },
            { x: worldX - sampleRadius * 0.7, z: worldZ - sampleRadius * 0.7, weight: 0.5 },
            { x: worldX + sampleRadius * 0.7, z: worldZ - sampleRadius * 0.7, weight: 0.5 },
            { x: worldX - sampleRadius * 0.7, z: worldZ + sampleRadius * 0.7, weight: 0.5 }
        ];

        const biomeInfluences: Record<string, { biome: Biome; weight: number }> = {};
        let totalWeight = 0;

        // Calculate influence of each biome at this position
        samples.forEach(sample => {
            const biome = this.getBiomeAtPosition(sample.x, sample.z);
            const distance = Math.sqrt((sample.x - worldX) ** 2 + (sample.z - worldZ) ** 2);
            const falloff = Math.exp(-distance / (sampleRadius * 0.5)); // Exponential falloff
            const weight = sample.weight * falloff;

            if (!biomeInfluences[biome.name]) {
                biomeInfluences[biome.name] = { biome: biome, weight: 0 };
            }
            biomeInfluences[biome.name].weight += weight;
            totalWeight += weight;
        });

        // Normalize weights
        Object.values(biomeInfluences).forEach(influence => {
            influence.weight /= totalWeight;
        });

        // Blend biome parameters based on influences
        const blendedParams: any = {
            noiseScale: 0,
            octaves: 0,
            persistence: 0,
            lacunarity: 0,
            heightMultiplier: 0,
            baseHeight: 0,
            colors: {
                low: { r: 0, g: 0, b: 0 },
                mid: { r: 0, g: 0, b: 0 },
                high: { r: 0, g: 0, b: 0 }
            }
        };

        // Weighted average of all biome parameters
        Object.values(biomeInfluences).forEach(influence => {
            const biome = influence.biome;
            const weight = influence.weight;

            blendedParams.noiseScale += biome.noiseScale * weight;
            blendedParams.octaves += biome.octaves * weight;
            blendedParams.persistence += biome.persistence * weight;
            blendedParams.lacunarity += biome.lacunarity * weight;
            blendedParams.heightMultiplier += biome.heightMultiplier * weight;
            blendedParams.baseHeight += biome.baseHeight * weight;

            // Blend colors
            (['low', 'mid', 'high'] as Array<'low' | 'mid' | 'high'>).forEach(level => {
                blendedParams.colors[level].r += biome.colors[level].r * weight;
                blendedParams.colors[level].g += biome.colors[level].g * weight;
                blendedParams.colors[level].b += biome.colors[level].b * weight;
            });
        });

        // Round octaves to nearest integer (can't have fractional octaves)
        blendedParams.octaves = Math.round(blendedParams.octaves);

        return blendedParams;
    }

    generateTerrain() {
        // Generate height map
        this.heightMap = [];
        const vertices = [];
        const indices = [];
    const normals: number[] = [];
        const uvs = [];
        const colors = [];

        // Generate vertices
        for (let z = 0; z <= this.segments; z++) {
            this.heightMap[z] = [];
            for (let x = 0; x <= this.segments; x++) {
                const worldX = (x / this.segments) * this.width - this.width / 2;
                const worldZ = (z / this.segments) * this.depth - this.depth / 2;
                
                // Get biome parameters for this position
                const biome = this.getBlendedBiomeParams(worldX, worldZ);
                
                // Generate height using biome-specific fractal noise
                let height = this.noise.fractalNoise(
                    worldX, worldZ, 
                    biome.octaves, 
                    biome.persistence, 
                    biome.noiseScale
                );
                
                // Apply biome-specific terrain shaping
                height = Math.pow(Math.abs(height), 0.8) * Math.sign(height);
                height = (height * biome.heightMultiplier + biome.baseHeight) * this.maxHeight;
                
                this.heightMap[z][x] = height;
                
                vertices.push(worldX, height, worldZ);
                
                // Generate UV coordinates
                uvs.push(x / this.segments, z / this.segments);
                
                // Generate color based on height and biome
                const normalizedHeight = Math.max(0, Math.min(1, (height + this.maxHeight) / (2 * this.maxHeight)));
                const color = this.getBiomeTerrainColor(normalizedHeight, biome);
                colors.push(color.r, color.g, color.b);
            }
        }

        // Generate indices for triangles
        for (let z = 0; z < this.segments; z++) {
            for (let x = 0; x < this.segments; x++) {
                const a = x + (this.segments + 1) * z;
                const b = x + (this.segments + 1) * (z + 1);
                const c = (x + 1) + (this.segments + 1) * (z + 1);
                const d = (x + 1) + (this.segments + 1) * z;

                // Two triangles per quad
                indices.push(a, b, d);
                indices.push(b, c, d);
            }
        }

        // Calculate normals
        this.calculateNormals(vertices, indices, normals);

        // Create geometry
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.setIndex(indices);

        // Create material
        const material = new THREE.MeshLambertMaterial({
            vertexColors: true,
            wireframe: false
        });

        // Create mesh
        if (this.mesh) {
            this.mesh.geometry.dispose();
            // Material can be an array or a single material; guard dispose calls
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

    getBiomeTerrainColor(height: number, biome: Biome) {
        // Use biome-specific colors based on height
        let baseColor;
        if (height < 0.4) {
            baseColor = biome.colors.low;
        } else if (height < 0.7) {
            // Interpolate between low and mid colors
            const t = (height - 0.4) / 0.3;
            baseColor = {
                r: biome.colors.low.r + t * (biome.colors.mid.r - biome.colors.low.r),
                g: biome.colors.low.g + t * (biome.colors.mid.g - biome.colors.low.g),
                b: biome.colors.low.b + t * (biome.colors.mid.b - biome.colors.low.b)
            };
        } else {
            // Interpolate between mid and high colors
            const t = Math.min(1, (height - 0.7) / 0.3);
            baseColor = {
                r: biome.colors.mid.r + t * (biome.colors.high.r - biome.colors.mid.r),
                g: biome.colors.mid.g + t * (biome.colors.high.g - biome.colors.mid.g),
                b: biome.colors.mid.b + t * (biome.colors.high.b - biome.colors.mid.b)
            };
        }

        // Apply elevation color bands (global overrides based on normalized height)
        return this.applyElevationBands(baseColor, height);
    }

    applyElevationBands(baseColor: BiomeColor, normalizedHeight: number) {
        if (!this.elevationColorBands || this.elevationColorBands.length === 0) return baseColor;

        // Find the first band that matches the normalized height
        for (const band of this.elevationColorBands) {
            if (normalizedHeight >= band.min && normalizedHeight <= band.max) {
                // Calculate blend weight inside band (0..1)
                const t = (normalizedHeight - band.min) / Math.max(1e-6, (band.max - band.min));
                // Blend baseColor towards band.color
                return {
                    r: baseColor.r * (1 - t) + band.color.r * t,
                    g: baseColor.g * (1 - t) + band.color.g * t,
                    b: baseColor.b * (1 - t) + band.color.b * t
                };
            }
        }

        return baseColor;
    }

    getTerrainColor(height: number) {
        // Define color gradient based on height
        if (height < 0.2) {
            // Water/low areas - blue
            return { r: 0.1, g: 0.3, b: 0.8 };
        } else if (height < 0.4) {
            // Sand/beach - beige
            return { r: 0.8, g: 0.7, b: 0.5 };
        } else if (height < 0.6) {
            // Grass - green
            return { r: 0.2, g: 0.6, b: 0.1 };
        } else if (height < 0.8) {
            // Rock - gray
            return { r: 0.5, g: 0.5, b: 0.5 };
        } else {
            // Snow - white
            return { r: 0.9, g: 0.9, b: 0.9 };
        }
    }

    calculateNormals(vertices, indices, normals) {
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

    getHeightAtPosition(x, z) {
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

    regenerate(params: any = null) {
        this.noise = new PerlinNoise();
        this.biomeNoise = new PerlinNoise(); // Regenerate biome distribution too
        if (params) {
            this.width = params.global.width;
            this.depth = params.global.depth;
            this.maxHeight = params.global.maxHeight;
            this.segments = params.global.segments;
            this.biomeScale = params.global.biomeScale;
            this.biomes = {};
            params.biomes.forEach(biome => {
                this.biomes[biome.name] = biome;
            });
            this.biomeList = Object.keys(this.biomes);
        }
        return this.generateTerrain();
    }
}
