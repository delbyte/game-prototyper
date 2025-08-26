import * as THREE from 'three';
import { PerlinNoise } from './noise';
import type { BiomeProfile, NoiseParams, FullTerrainParameters, BiomeMaterialClassification } from './types';
import { getEnvironmentMap } from './renderer';

// Material Type Constants
const BiomeMaterialType = {
    STANDARD: 'standard',
    CRYSTAL: 'crystal',
    GLOWING: 'glowing',
    WATER: 'water'
} as const;

// Helper function for linear interpolation
function lerp(a: number, b: number, alpha: number): number {
    return a * (1 - alpha) + b * alpha;
}

// Biome Material Classification Functions
function classifyBiomeMaterial(biome: BiomeProfile): BiomeMaterialClassification {
    if (!biome.material) {
        return {
            materialType: BiomeMaterialType.STANDARD,
            priority: 1,
            coverage: 1.0
        };
    }

    const mat = biome.material;
    
    // Check for water biomes first (highest priority for water systems)
    if (mat.isWater) {
        return {
            materialType: BiomeMaterialType.WATER,
            priority: 8,
            coverage: 1.0
        };
    }
    
    // Check for crystal/glass materials
    const hasSignificantTransparency = (mat.transparency && mat.transparency > 0.5);
    const hasSignificantReflectivity = (mat.reflectivity && mat.reflectivity > 0.6);
    const hasSignificantIridescence = (mat.iridescence && mat.iridescence > 0.5);
    
    if (hasSignificantTransparency || hasSignificantReflectivity || hasSignificantIridescence) {
        return {
            materialType: BiomeMaterialType.CRYSTAL,
            priority: 6,
            coverage: Math.max(mat.transparency || 0, mat.reflectivity || 0, mat.iridescence || 0)
        };
    }
    
    // Check for glowing materials
    if (mat.emission && mat.emission > 0.4) {
        return {
            materialType: BiomeMaterialType.GLOWING,
            priority: 4,
            coverage: mat.emission
        };
    }
    
    // Default to standard material
    return {
        materialType: BiomeMaterialType.STANDARD,
        priority: 1,
        coverage: 1.0
    };
}

function analyzeMaterialRequirements(biomes: BiomeProfile[]): Map<string, BiomeMaterialClassification[]> {
    const materialMap = new Map<string, BiomeMaterialClassification[]>();
    
    biomes.forEach((biome, index) => {
        const classification = classifyBiomeMaterial(biome);
        
        if (!materialMap.has(classification.materialType)) {
            materialMap.set(classification.materialType, []);
        }
        
        materialMap.get(classification.materialType)!.push({
            ...classification,
            biomeIndex: index
        } as any);
    });
    
    console.log('🔍 Material Requirements Analysis:', {
        totalBiomes: biomes.length,
        materialTypes: Array.from(materialMap.keys()),
        breakdown: Object.fromEntries(
            Array.from(materialMap.entries()).map(([type, classifications]) => [
                type, 
                { count: classifications.length, avgPriority: classifications.reduce((sum, c) => sum + c.priority, 0) / classifications.length }
            ])
        )
    });
    
    return materialMap;
}

// Phase 2: Geometry Separation Functions
function getVertexMaterialType(biome: BiomeProfile): string {
    const classification = classifyBiomeMaterial(biome);
    return classification.materialType;
}

function initializeMaterialGeometry(materialType: string): {
    vertices: number[],
    indices: number[],
    normals: number[],
    uvs: number[],
    colors: number[],
    vertexMap: Map<number, number>
} {
    return {
        vertices: [],
        indices: [],
        normals: [],
        uvs: [],
        colors: [],
        vertexMap: new Map()
    };
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
    materialRequirements: Map<string, BiomeMaterialClassification[]>;

    // Multi-mesh system for per-biome materials
    materialMeshes: Map<string, THREE.Mesh>;
    materialGeometries: Map<string, {
        vertices: number[],
        indices: number[],
        normals: number[],
        uvs: number[],
        colors: number[],
        vertexMap: Map<number, number> // Maps original vertex index to material-specific index
    }>;

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

        // Analyze material requirements for all biomes
        this.materialRequirements = analyzeMaterialRequirements(this.biomes);

        // Initialize multi-mesh system
        this.materialMeshes = new Map();
        this.materialGeometries = new Map();

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
        console.log('🏔️  Starting terrain generation...');
        
        // Analyze material requirements (already done in constructor, but refresh)
        this.materialRequirements = analyzeMaterialRequirements(this.biomes);
        
        // Check if we need multi-material rendering
        const needsMultiMaterial = this.materialRequirements.size > 1 || 
                                 (this.materialRequirements.size === 1 && 
                                  !this.materialRequirements.has(BiomeMaterialType.STANDARD));
        
        if (needsMultiMaterial) {
            console.log('🎨 Using multi-material terrain generation');
            return this.generateMultiMaterialTerrain();
        } else {
            console.log('📦 Using standard single-material terrain generation');
            return this.generateStandardTerrain();
        }
    }

    private generateStandardTerrain(): THREE.Mesh {
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

    // Phase 2: Multi-Material Terrain Generation
    generateMultiMaterialTerrain(): THREE.Group {
        console.log('🔧 Starting multi-material terrain generation...');
        
        // Step 1: Generate heightmap (same as before)
        this.generateHeightMap();
        
        // Step 2: Initialize geometry arrays for each material type
        this.initializeMaterialGeometries();
        
        // Step 3: Generate vertices and assign to material-specific geometries
        this.generateMaterialSpecificVertices();
        
        // Step 4: Generate indices for each material geometry
        this.generateMaterialSpecificIndices();
        
        // Step 5: Create meshes for each material type
        const terrainGroup = this.createMaterialMeshes();
        
        console.log('✅ Multi-material terrain generation complete!');
        return terrainGroup;
    }

    private generateHeightMap(): void {
        console.log('📊 Generating heightmap...');
        this.heightMap = [];
        
        // First pass: Generate the raw heightmap (same logic as before)
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
        console.log('✅ Heightmap generated');
    }

    private initializeMaterialGeometries(): void {
        console.log('🎨 Initializing material geometries...');
        
        // Clear existing geometries
        this.materialGeometries.clear();
        
        // Initialize geometry arrays for each required material type
        for (const [materialType] of this.materialRequirements) {
            this.materialGeometries.set(materialType, initializeMaterialGeometry(materialType));
            console.log(`  📦 Initialized geometry for: ${materialType}`);
        }
        
        // Always ensure we have a standard material geometry as fallback
        if (!this.materialGeometries.has(BiomeMaterialType.STANDARD)) {
            this.materialGeometries.set(BiomeMaterialType.STANDARD, initializeMaterialGeometry(BiomeMaterialType.STANDARD));
            console.log(`  📦 Added fallback standard geometry`);
        }
    }

    private generateMaterialSpecificVertices(): void {
        console.log('🔺 Generating material-specific vertices...');
        
        // FIXED APPROACH: Generate ALL vertices for each material geometry
        // This ensures proper indexing and prevents geometry corruption
        
        for (let z = 0; z <= this.segments; z++) {
            for (let x = 0; x <= this.segments; x++) {
                const worldX = (x / this.segments) * this.width - this.width / 2;
                const worldZ = (z / this.segments) * this.depth - this.depth / 2;
                const height = this.heightMap[z][x];

                // Determine which material this vertex should use
                const materialType = this.getVertexMaterialType(worldX, worldZ);
                
                // Add this vertex to ALL geometries (we'll filter out unused triangles later)
                for (const [currentMaterialType, geometry] of this.materialGeometries) {
                    // Add vertex to every geometry
                    geometry.vertices.push(worldX, height, worldZ);
                    
                    // Generate normal (will be recalculated later)
                    geometry.normals.push(0, 1, 0);
                    
                    // Generate UV coordinates
                    const u = x / this.segments;
                    const v = z / this.segments;
                    geometry.uvs.push(u, v);
                }
            }
        }
        
        console.log('✅ Material-specific vertices generated (all vertices in all geometries)');
    }

    private generateMaterialSpecificIndices(): void {
        console.log('🔗 Generating material-specific indices...');
        
        // FIXED APPROACH: For each triangle, determine its material and add to appropriate geometry
        // Since all geometries have identical vertices, we can use the same indices
        
        for (let z = 0; z < this.segments; z++) {
            for (let x = 0; x < this.segments; x++) {
                // Calculate vertex indices for this quad (FIXED - matches standard terrain)
                const a = x + (this.segments + 1) * z;
                const b = x + (this.segments + 1) * (z + 1);
                const c = (x + 1) + (this.segments + 1) * (z + 1);
                const d = (x + 1) + (this.segments + 1) * z;
                
                // Determine the material for this quad by sampling its center
                const centerX = (x + 0.5) / this.segments * this.width - this.width / 2;
                const centerZ = (z + 0.5) / this.segments * this.depth - this.depth / 2;
                const quadMaterialType = this.getVertexMaterialType(centerX, centerZ);
                
                // Add triangles only to the geometry that matches this quad's material
                const geometry = this.materialGeometries.get(quadMaterialType);
                if (geometry) {
                    // Add two triangles for this quad (FIXED WINDING ORDER)
                    geometry.indices.push(a, b, d);  // Triangle 1 - matches standard terrain
                    geometry.indices.push(b, c, d);  // Triangle 2 - matches standard terrain
                }
            }
        }
        
        console.log('✅ Material-specific indices generated (clean triangulation)');
    }

    private createMaterialMeshes(): THREE.Group {
        console.log('🎭 Creating material meshes...');
        
        const terrainGroup = new THREE.Group();
        terrainGroup.name = 'multi-material-terrain';
        
        // Clear existing meshes
        this.materialMeshes.clear();
        
        // Define render order for proper transparency (opaque first, transparent last)
        const renderOrder = [
            BiomeMaterialType.STANDARD,  // 0 - Opaque base terrain
            BiomeMaterialType.GLOWING,   // 1 - Emissive (can be opaque)
            BiomeMaterialType.WATER,     // 2 - Transparent water
            BiomeMaterialType.CRYSTAL,   // 3 - Highly transparent crystals (last)
        ];
        
        // Create meshes in render order
        for (const materialType of renderOrder) {
            const geometryData = this.materialGeometries.get(materialType);
            if (!geometryData || geometryData.vertices.length === 0) {
                continue;
            }
            
            console.log(`  🎨 Creating mesh for ${materialType} (${geometryData.vertices.length / 3} vertices)`);
            
            // Create Three.js geometry
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(geometryData.vertices, 3));
            geometry.setAttribute('normal', new THREE.Float32BufferAttribute(geometryData.normals, 3));
            geometry.setAttribute('uv', new THREE.Float32BufferAttribute(geometryData.uvs, 2));
            geometry.setIndex(geometryData.indices);
            
            // Recalculate normals for proper lighting
            geometry.computeVertexNormals();
            
            // Create material based on type
            const material = this.createMaterialForType(materialType);
            
            // Create mesh
            const mesh = new THREE.Mesh(geometry, material);
            mesh.name = `terrain-${materialType}`;
            mesh.receiveShadow = true;
            mesh.castShadow = true;
            
            // Set render order for transparency sorting
            mesh.renderOrder = renderOrder.indexOf(materialType);
            
            // Special settings for transparent materials
            if (materialType === BiomeMaterialType.CRYSTAL || materialType === BiomeMaterialType.WATER) {
                mesh.castShadow = false; // Transparent objects shouldn't cast hard shadows
                // Enable frustum culling for performance
                mesh.frustumCulled = true;
            }
            
            // Store mesh and add to group
            this.materialMeshes.set(materialType, mesh);
            terrainGroup.add(mesh);
        }
        
        console.log(`✅ Created ${this.materialMeshes.size} material meshes with proper render order`);
        return terrainGroup;
    }

    // Phase 2: Helper Methods
    private getVertexMaterialType(worldX: number, worldZ: number): string {
        const { primaryBiome } = this.getBiomeInfo(worldX, worldZ);
        const materialClassification = classifyBiomeMaterial(primaryBiome);
        return materialClassification.materialType;
    }

    private createMaterialForType(materialType: string, biome?: BiomeProfile): THREE.Material {
        console.log(`  🎭 Creating advanced ${materialType} material...`);
        
        // Extract color information from biome if available
        const baseColor = biome?.colorRamp?.[0]?.color ? 
            new THREE.Color(biome.colorRamp[0].color.r / 255, biome.colorRamp[0].color.g / 255, biome.colorRamp[0].color.b / 255) :
            new THREE.Color(0.34, 0.49, 0.27); // Default terrain green
        
        switch (materialType) {
            case BiomeMaterialType.CRYSTAL:
                // Use biome color for crystal tint, but keep it light
                const crystalColor = baseColor.clone().lerp(new THREE.Color(1, 1, 1), 0.7);
                
                return new THREE.MeshPhysicalMaterial({
                    // Base crystal appearance with biome tint
                    color: crystalColor,
                    metalness: 0.0,
                    roughness: 0.05,
                    
                    // Transparency and refraction
                    transmission: 0.95,
                    thickness: 1.0,
                    ior: 1.5, // Glass-like refraction
                    
                    // Crystal effects
                    iridescence: 0.8,
                    iridescenceIOR: 1.3,
                    iridescenceThicknessRange: [100, 800],
                    
                    // Transparency
                    transparent: true,
                    opacity: 0.3,
                    
                    // Environment reflection
                    envMapIntensity: 1.0,
                    
                    // Render settings for proper transparency
                    side: THREE.DoubleSide,
                    alphaTest: 0.1,
                    
                    // FIXED: Disable depth writing for proper transparency
                    depthWrite: false,
                });
                
            case BiomeMaterialType.GLOWING:
                // Use biome color for glow, but make it warm
                const glowColor = baseColor.clone().lerp(new THREE.Color(1, 0.3, 0), 0.6);
                const emissiveColor = glowColor.clone().multiplyScalar(0.8);
                
                return new THREE.MeshStandardMaterial({
                    // Base glowing color from biome
                    color: glowColor,
                    
                    // Strong emission for glow effect
                    emissive: emissiveColor,
                    emissiveIntensity: 2.0,
                    
                    // Surface properties for lava/magma
                    metalness: 0.1,
                    roughness: 0.9,
                    
                    // No transparency for solid glow
                    transparent: false,
                    
                    // Enable tone mapping for HDR glow
                    toneMapped: false,
                });
                
            case BiomeMaterialType.WATER:
                // Use biome color for water tint
                const waterColor = baseColor.clone().lerp(new THREE.Color(0, 0.41, 0.58), 0.7);
                
                const waterMaterial = new THREE.MeshPhysicalMaterial({
                    // Water base color with biome influence
                    color: waterColor,
                    metalness: 0.0,
                    roughness: 0.02,
                    
                    // Water transparency
                    transmission: 0.98,
                    thickness: 0.5,
                    ior: 1.333, // Water's refractive index
                    
                    // Water surface properties
                    transparent: true,
                    opacity: 0.8,
                    
                    // Environment reflection
                    envMapIntensity: 0.8,
                    
                    // Render settings
                    side: THREE.FrontSide,
                    
                    // FIXED: Proper transparency settings
                    depthWrite: false,
                });
                
                // Add subtle animation to water (basic version)
                waterMaterial.onBeforeRender = () => {
                    const time = Date.now() * 0.001;
                    waterMaterial.roughness = 0.02 + Math.sin(time * 0.5) * 0.01;
                };
                
                return waterMaterial;
                
            case BiomeMaterialType.STANDARD:
            default:
                return new THREE.MeshLambertMaterial({
                    color: baseColor,
                    transparent: false,
                    // Keep it simple and performant for standard terrain
                });
        }
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

        console.log('🎨 Material analysis:', { hasTransparency, hasReflectivity, hasEmission, hasIridescence, hasWater, maxTransparency, maxReflectivity, maxIridescence, maxEmission });

        // VERY STRICT: Only use advanced materials for significant crystal/glass effects
        const needsAdvancedMaterial = (maxTransparency > 0.6) || 
                                     (maxReflectivity > 0.7) || 
                                     (maxIridescence > 0.6);
        
        // Only glowing material if no advanced material and strong emission
        const needsGlowingMaterial = !needsAdvancedMaterial && hasEmission && maxEmission > 0.5;

        if (needsAdvancedMaterial) {
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
        } else if (needsGlowingMaterial) {
            // Glowing material - only when no crystal and strong emission
            const material = new THREE.MeshStandardMaterial({
                vertexColors: true,
                emissive: new THREE.Color(0.3, 0.1, 0.0), // Warm glow
                emissiveIntensity: maxEmission * 1.5,
                metalness: maxMetalness * 0.3,
                roughness: Math.max(minRoughness, 0.4)
            });
            console.log('🔥 Created glowing material with emission:', maxEmission * 1.5);
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
