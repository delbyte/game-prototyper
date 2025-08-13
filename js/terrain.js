class TerrainGenerator {
    constructor() {
        this.noise = new PerlinNoise();
        this.width = 200;
        this.depth = 200;
        this.maxHeight = 50;
        this.segments = 100;
        
        // Terrain generation parameters
        this.noiseScale = 0.02;
        this.octaves = 6;
        this.persistence = 0.5;
        this.lacunarity = 2.0;
        
        this.mesh = null;
        this.heightMap = [];
    }

    generateTerrain() {
        // Generate height map
        this.heightMap = [];
        const vertices = [];
        const indices = [];
        const normals = [];
        const uvs = [];
        const colors = [];

        // Generate vertices
        for (let z = 0; z <= this.segments; z++) {
            this.heightMap[z] = [];
            for (let x = 0; x <= this.segments; x++) {
                const worldX = (x / this.segments) * this.width - this.width / 2;
                const worldZ = (z / this.segments) * this.depth - this.depth / 2;
                
                // Generate height using fractal noise
                let height = this.noise.fractalNoise(
                    worldX, worldZ, 
                    this.octaves, 
                    this.persistence, 
                    this.noiseScale
                );
                
                // Apply some terrain shaping
                height = Math.pow(Math.abs(height), 0.8) * Math.sign(height);
                height *= this.maxHeight;
                
                this.heightMap[z][x] = height;
                
                vertices.push(worldX, height, worldZ);
                
                // Generate UV coordinates
                uvs.push(x / this.segments, z / this.segments);
                
                // Generate color based on height
                const normalizedHeight = (height + this.maxHeight) / (2 * this.maxHeight);
                const color = this.getTerrainColor(normalizedHeight);
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
            this.mesh.material.dispose();
        }
        
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.receiveShadow = true;
        this.mesh.castShadow = true;

        return this.mesh;
    }

    getTerrainColor(height) {
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

    regenerate() {
        this.noise = new PerlinNoise();
        return this.generateTerrain();
    }
}
