import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { TerrainGenerator } from './terrain';

export interface AssetMetadata {
    id: string;
    name: string;
    description?: string;
    source?: 'local' | 'samples' | 'sketchfab' | 'url';
    url: string;
    thumbnailUrl?: string;
    license?: string;
    tags?: string[];
    boundingBox?: {
        min: THREE.Vector3;
        max: THREE.Vector3;
    };
}

export interface PlacedAsset {
    id: string;
    metadata: AssetMetadata;
    mesh: THREE.Object3D;
    position: THREE.Vector3;
    rotation: THREE.Euler;
    scale: THREE.Vector3;
}

/**
 * Asset Manager for handling 3D model loading and placement
 * Supports loading from multiple sources including local files, sample models, and external APIs
 */
export class AssetManager {
    private loader: GLTFLoader;
    private loadedAssets: Map<string, THREE.Object3D> = new Map();
    private placedAssets: Map<string, PlacedAsset> = new Map();
    private scene: THREE.Scene;
    private terrainGenerator?: TerrainGenerator;

    constructor(scene: THREE.Scene, terrainGenerator?: TerrainGenerator) {
        this.loader = new GLTFLoader();
        this.scene = scene;
        this.terrainGenerator = terrainGenerator;
    }

    /**
     * Get a curated list of free sample models that are known to work well
     */
    getSampleAssets(): AssetMetadata[] {
        return [
            {
                id: 'duck',
                name: 'Duck',
                description: 'Classic COLLADA duck model',
                source: 'samples',
                url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Duck/glTF/Duck.gltf',
                thumbnailUrl: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Duck/screenshot/screenshot.png',
                license: 'CC0',
                tags: ['animal', 'simple', 'yellow']
            },
            {
                id: 'damaged-helmet',
                name: 'Damaged Helmet',
                description: 'Battle-damaged sci-fi helmet with PBR materials',
                source: 'samples',
                url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/DamagedHelmet/glTF/DamagedHelmet.gltf',
                thumbnailUrl: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/DamagedHelmet/screenshot/screenshot.png',
                license: 'CC0',
                tags: ['helmet', 'sci-fi', 'damaged', 'pbr']
            },
            {
                id: 'avocado',
                name: 'Avocado',
                description: 'Realistic avocado with normal mapping',
                source: 'samples',
                url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Avocado/glTF/Avocado.gltf',
                thumbnailUrl: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Avocado/screenshot/screenshot.jpg',
                license: 'CC0',
                tags: ['food', 'organic', 'green']
            },
            {
                id: 'lantern',
                name: 'Lantern',
                description: 'Vintage lantern with emissive materials',
                source: 'samples',
                url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Lantern/glTF/Lantern.gltf',
                thumbnailUrl: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Lantern/screenshot/screenshot.jpg',
                license: 'CC0',
                tags: ['light', 'vintage', 'metal']
            },
            {
                id: 'cesium-man',
                name: 'Cesium Man',
                description: 'Animated character with walking cycle',
                source: 'samples',
                url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/CesiumMan/glTF/CesiumMan.gltf',
                thumbnailUrl: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/CesiumMan/screenshot/screenshot.gif',
                license: 'CC0',
                tags: ['character', 'animated', 'walking']
            },
            {
                id: 'box',
                name: 'Simple Box',
                description: 'Basic textured cube for testing',
                source: 'samples',
                url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Box/glTF/Box.gltf',
                thumbnailUrl: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Box/screenshot/screenshot.png',
                license: 'CC0',
                tags: ['simple', 'basic', 'cube']
            },
            {
                id: 'buggy',
                name: 'Buggy',
                description: 'Detailed dune buggy vehicle',
                source: 'samples',
                url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Buggy/glTF/Buggy.gltf',
                thumbnailUrl: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Buggy/screenshot/screenshot.png',
                license: 'CC0',
                tags: ['vehicle', 'buggy', 'detailed']
            },
            {
                id: 'boom-box',
                name: 'Boom Box',
                description: 'Retro boom box with detailed materials',
                source: 'samples',
                url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/BoomBox/glTF/BoomBox.gltf',
                thumbnailUrl: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/BoomBox/screenshot/screenshot.jpg',
                license: 'CC0',
                tags: ['radio', 'retro', 'music', 'electronic']
            }
        ];
    }

    /**
     * Load a 3D asset from URL
     */
    async loadAsset(metadata: AssetMetadata): Promise<THREE.Object3D> {
        // Check if already loaded
        if (this.loadedAssets.has(metadata.id)) {
            return this.loadedAssets.get(metadata.id)!.clone();
        }

        console.log(`Loading asset: ${metadata.name} from ${metadata.url}`);

        try {
            const gltf = await new Promise<any>((resolve, reject) => {
                this.loader.load(
                    metadata.url,
                    (gltf) => resolve(gltf),
                    (progress) => {
                        console.log(`Loading progress: ${(progress.loaded / progress.total * 100)}%`);
                    },
                    (error) => reject(error)
                );
            });

            const model = gltf.scene;
            
            // Calculate bounding box for the model
            const box = new THREE.Box3().setFromObject(model);
            metadata.boundingBox = {
                min: box.min.clone(),
                max: box.max.clone()
            };

            // Store the loaded model
            this.loadedAssets.set(metadata.id, model);
            
            console.log(`Successfully loaded asset: ${metadata.name}`);
            return model.clone();

        } catch (error) {
            console.error(`Failed to load asset ${metadata.name}:`, error);
            throw error;
        }
    }

    /**
     * Place an asset in the world at specified position
     */
    async placeAsset(
        metadata: AssetMetadata, 
        position: THREE.Vector3 = new THREE.Vector3(0, 0, 0),
        rotation: THREE.Euler = new THREE.Euler(0, 0, 0),
        scale: THREE.Vector3 = new THREE.Vector3(1, 1, 1)
    ): Promise<PlacedAsset> {
        const mesh = await this.loadAsset(metadata);

        // Calculate bounding box to understand model size
        const originalBox = new THREE.Box3().setFromObject(mesh);
        const originalSize = originalBox.getSize(new THREE.Vector3());
        console.log(`Asset ${metadata.name} original size:`, originalSize);

        // Auto-scale if model is too small or too large
        let autoScale = 1;
        const maxDimension = Math.max(originalSize.x, originalSize.y, originalSize.z);
        if (maxDimension > 0 && maxDimension < 1) {
            autoScale = 10 / maxDimension;
            console.log(`Scaling up ${metadata.name} by ${autoScale.toFixed(2)}x`);
        } else if (maxDimension > 100) {
            autoScale = 50 / maxDimension;
            console.log(`Scaling down ${metadata.name} by ${autoScale.toFixed(2)}x`);
        }

        // Apply transforms (scale first so bbox reflects final size)
        const finalScale = scale.clone().multiplyScalar(autoScale);
        mesh.scale.copy(finalScale);
        mesh.rotation.copy(rotation);

        // Compute bounding box after scaling to align base to requested Y
        const finalBox = new THREE.Box3().setFromObject(mesh);
        const minY = finalBox.min.y;

        // Position so the model's bottom sits on the requested Y (e.g., terrain height)
        mesh.position.set(position.x, position.y - minY, position.z);

        mesh.name = metadata.name || metadata.id;
        mesh.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                (child as THREE.Mesh).castShadow = true;
                (child as THREE.Mesh).receiveShadow = true;
            }
        });

        // Add to scene
        this.scene.add(mesh);

        // Create placed asset record
        const placedAsset: PlacedAsset = {
            id: `${metadata.id}_${Date.now()}`,
            metadata,
            mesh,
            position: mesh.position.clone(),
            rotation: rotation.clone(),
            scale: finalScale.clone()
        };

        this.placedAssets.set(placedAsset.id, placedAsset);

        console.log(`Placed asset: ${metadata.name} at position (${placedAsset.position.x}, ${placedAsset.position.y}, ${placedAsset.position.z}) with scale ${autoScale}`);
        // tag the mesh so UI/selection code can find which placed asset it belongs to
        try { (mesh as any).userData = (mesh as any).userData || {}; (mesh as any).userData.placedId = placedAsset.id; } catch(e) { /* ignore */ }
        return placedAsset;
    }

    /**
     * Update a placed asset's transform (position/rotation/scale).
     * Position.y is treated as the desired ground/base Y; the asset will be offset so its bottom sits at that Y.
     */
    updatePlacedAssetTransform(placedId: string, opts: { position?: THREE.Vector3; rotation?: THREE.Euler; scale?: THREE.Vector3 }): boolean {
        const placed = this.placedAssets.get(placedId);
        if (!placed) return false;

        const mesh = placed.mesh;

        if (opts.scale) {
            mesh.scale.copy(opts.scale);
            placed.scale.copy(opts.scale);
        }

        if (opts.rotation) {
            mesh.rotation.copy(opts.rotation);
            placed.rotation.copy(opts.rotation);
        }

        // Recompute bounding box after scale/rotation so we can align bottom to desired Y
        const box = new THREE.Box3().setFromObject(mesh);
        const minY = box.min.y;

        if (opts.position) {
            // position.y is considered the target ground/base Y
            mesh.position.set(opts.position.x, opts.position.y - minY, opts.position.z);
            placed.position.copy(mesh.position);
        } else {
            // if only adjusting scale/rotation, keep current x/z but realign Y base
            const cur = mesh.position;
            mesh.position.set(cur.x, cur.y - minY, cur.z);
            placed.position.copy(mesh.position);
        }

        return true;
    }

    /**
     * Remove a placed asset from the world
     */
    removeAsset(placedAssetId: string): boolean {
        const placedAsset = this.placedAssets.get(placedAssetId);
        if (!placedAsset) {
            return false;
        }

        // Remove from scene
        this.scene.remove(placedAsset.mesh);
        
        // Dispose of geometry and materials
        placedAsset.mesh.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(mat => mat.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            }
        });

        // Remove from tracking
        this.placedAssets.delete(placedAssetId);
        
        console.log(`Removed asset: ${placedAsset.metadata.name}`);
        return true;
    }

    /**
     * Get all currently placed assets
     */
    getPlacedAssets(): PlacedAsset[] {
        return Array.from(this.placedAssets.values());
    }

    /**
     * Find the placed asset that contains the provided object (or is the object)
     */
    findPlacedAssetByObject(obj: THREE.Object3D | null): PlacedAsset | undefined {
        if (!obj) return undefined;
        for (const placed of this.placedAssets.values()) {
            let p: THREE.Object3D | null = obj;
            while (p) {
                if (p === placed.mesh) return placed;
                p = p.parent;
            }
        }
        return undefined;
    }

    /**
     * Update transforms of a placed asset (position/rotation/scale). Any undefined component is left unchanged.
     */
    updatePlacedAssetTransforms(id: string, opts: { position?: THREE.Vector3; rotation?: THREE.Euler; scale?: THREE.Vector3 }): boolean {
        const placed = this.placedAssets.get(id);
        if (!placed) return false;

        if (opts.position) {
            placed.mesh.position.copy(opts.position);
            placed.position.copy(opts.position);
        }
        if (opts.rotation) {
            placed.mesh.rotation.copy(opts.rotation);
            placed.rotation.copy(opts.rotation);
        }
        if (opts.scale) {
            placed.mesh.scale.copy(opts.scale);
            placed.scale.copy(opts.scale);
        }

        // Update bounding box metadata if needed
        try {
            const box = new THREE.Box3().setFromObject(placed.mesh);
            placed.metadata.boundingBox = { min: box.min.clone(), max: box.max.clone() };
        } catch (e) {
            // ignore
        }

        return true;
    }

    /**
     * Clear all placed assets
     */
    clearAllAssets(): void {
        for (const placedAsset of this.placedAssets.values()) {
            this.scene.remove(placedAsset.mesh);
            
            // Dispose of resources
            placedAsset.mesh.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(mat => mat.dispose());
                        } else {
                            child.material.dispose();
                        }
                    }
                }
            });
        }
        
        this.placedAssets.clear();
        console.log('Cleared all placed assets');
    }

    /**
     * Load asset from custom URL
     */
    async loadAssetFromUrl(url: string, name: string): Promise<AssetMetadata> {
        const metadata: AssetMetadata = {
            id: `custom_${Date.now()}`,
            name: name,
            description: 'Custom loaded model',
            source: 'url',
            url: url,
            tags: ['custom']
        };

        // Test load to validate the URL
        await this.loadAsset(metadata);
        
        return metadata;
    }

    /**
     * Search sample assets by tag or name
     */
    searchSampleAssets(query: string): AssetMetadata[] {
        const samples = this.getSampleAssets();
        const lowerQuery = query.toLowerCase();
        
        return samples.filter(asset => 
            asset.name.toLowerCase().includes(lowerQuery) ||
            (asset.description || '').toLowerCase().includes(lowerQuery) ||
            asset.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
        );
    }

    /**
     * Get asset placement suggestions based on terrain
     */
    suggestPlacement(_metadata: AssetMetadata): THREE.Vector3[] {
        const suggestions: THREE.Vector3[] = [];
        const worldSize = 20000; // Match terrain size
        const numSuggestions = 5;

        console.log('Terrain generator available:', !!this.terrainGenerator);

        for (let i = 0; i < numSuggestions; i++) {
            // Random position within terrain bounds
            const x = (Math.random() - 0.5) * worldSize * 0.8; // Keep away from edges
            const z = (Math.random() - 0.5) * worldSize * 0.8;
            
            // Get terrain height at this position if terrain generator is available
            let y = 100; // Default height well above ground
            if (this.terrainGenerator) {
                const terrainHeight = this.terrainGenerator.getHeightAtPosition(x, z);
                y = terrainHeight + 50; // 50m above terrain for visibility
                console.log(`Position (${x.toFixed(2)}, ${z.toFixed(2)}) -> terrain height: ${terrainHeight.toFixed(2)}, placing at y: ${y.toFixed(2)}`);
            }
            
            suggestions.push(new THREE.Vector3(x, y, z));
        }

        return suggestions;
    }
}
