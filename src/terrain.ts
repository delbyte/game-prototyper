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
    temperatureNoise: PerlinNoise;
    moistureNoise: PerlinNoise;

    width: number;
    depth: number;
    maxHeight: number;
    segments: number;
    
    terrainParams: any;
    biomes: any[];

    mesh: THREE.Mesh | null;
    heightMap: number[][];

    constructor(params: any = null) {
        this.noise = new PerlinNoise(params?.terrain?.base?.seed);
        this.temperatureNoise = new PerlinNoise(params?.environment?.temperature?.seed);
        this.moistureNoise = new PerlinNoise(params?.environment?.moisture?.seed);

        this.width = params?.global?.width || 2000;
        this.depth = params?.global?.depth || 2000;
        this.maxHeight = params?.global?.maxHeight || 150;
        this.segments = params?.global?.segments || 1000;
        
        this.terrainParams = params?.terrain;
        this.biomes = params?.biomes || [];

        this.mesh = null;
        this.heightMap = [];
    }

    private calculateElevation(worldX: number, worldZ: number): number {
        const { base, mountains, details } = this.terrainParams;

        const base_elevation = this.noise.fBm(worldX, worldZ, base) * base.amplitude;
        const mountain_ranges = this.noise.fBm(worldX, worldZ, mountains) * mountains.amplitude;
        const local_details = this.noise.fBm(worldX, worldZ, details) * details.amplitude;

        let elevation = base_elevation + (mountain_ranges * base_elevation) + local_details;

        return (elevation + 1) / 2;
    }

    private getBiome(elevation: number, temperature: number, moisture: number): any {
        for (const biome of this.biomes) {
            const rules = biome.rules;
            if (
                (rules.minElevation === undefined || elevation >= rules.minElevation) &&
                (rules.maxElevation === undefined || elevation <= rules.maxElevation) &&
                (rules.minTemperature === undefined || temperature >= rules.minTemperature) &&
                (rules.maxTemperature === undefined || temperature <= rules.maxTemperature) &&
                (rules.minMoisture === undefined || moisture >= rules.minMoisture) &&
                (rules.maxMoisture === undefined || moisture <= rules.maxMoisture)
            ) {
                return biome;
            }
        }
        return this.biomes[this.biomes.length - 1] || { name: 'Default', colorRamp: [{ stop: 0, color: {r:0,g:0,b:0} }] }; // Fallback
    }

    private getBiomeTerrainColor(biome: any, elevation: number): BiomeColor {
        const minElev = biome.rules.minElevation ?? 0;
        const maxElev = biome.rules.maxElevation ?? 1;
        const normalizedHeight = (elevation - minElev) / (maxElev - minElev);

        const ramp = biome.colorRamp;
        if (!ramp || ramp.length === 0) return { r: 1, g: 0, b: 1 }; // Default to magenta if no ramp

        for (let i = 0; i < ramp.length - 1; i++) {
            const start = ramp[i];
            const end = ramp[i + 1];
            if (normalizedHeight >= start.stop && normalizedHeight <= end.stop) {
                const t = (normalizedHeight - start.stop) / (end.stop - start.stop);
                return {
                    r: start.color.r + t * (end.color.r - start.color.r),
                    g: start.color.g + t * (end.color.g - start.color.g),
                    b: start.color.b + t * (end.color.b - start.color.b),
                };
            }
        }
        return ramp[ramp.length - 1].color; // Return last color if outside range
    }

    generateTerrain() {
        this.heightMap = [];
        const vertices: number[] = [];
        const indices: number[] = [];
        const normals: number[] = [];
        const uvs: number[] = [];
        const colors: number[] = [];

        for (let z = 0; z <= this.segments; z++) {
            this.heightMap[z] = [];
            for (let x = 0; x <= this.segments; x++) {
                const worldX = (x / this.segments) * this.width - this.width / 2;
                const worldZ = (z / this.segments) * this.depth - this.depth / 2;

                const elevation = this.calculateElevation(worldX, worldZ);
                const height = elevation * this.maxHeight;
                this.heightMap[z][x] = height;

                const temperature = (this.temperatureNoise.fBm(worldX, worldZ, this.terrainParams.environment?.temperature) + 1) / 2;
                const moisture = (this.moistureNoise.fBm(worldX, worldZ, this.terrainParams.environment?.moisture) + 1) / 2;

                const biome = this.getBiome(elevation, temperature, moisture);
                const color = this.getBiomeTerrainColor(biome, height);

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

        const material = new THREE.MeshLambertMaterial({
            vertexColors: true,
            wireframe: false
        });

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

    regenerate(params: any = null) {
        this.noise = new PerlinNoise(params?.terrain?.base?.seed);
        this.temperatureNoise = new PerlinNoise(params?.environment?.temperature?.seed);
        this.moistureNoise = new PerlinNoise(params?.environment?.moisture?.seed);

        this.width = params?.global?.width || 2000;
        this.depth = params?.global?.depth || 2000;
        this.maxHeight = params?.global?.maxHeight || 150;
        this.segments = params?.global?.segments || 1000;
        
        this.terrainParams = params?.terrain;
        this.biomes = params?.biomes || [];
        
        return this.generateTerrain();
    }
}
