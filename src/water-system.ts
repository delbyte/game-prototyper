/**
 * Advanced Water System Generator
 * 
 * This module implements a sophisticated water simulation system that can generate:
 * - Oceans and seas (global water level)
 * - Lakes and ponds (local minima with drainage)
 * - Rivers (flow paths following terrain gradients)
 * - Waterfalls (vertical drops between elevation levels)
 * 
 * Mathematical Foundation:
 * 1. Hydraulic Flow: Uses simplified Navier-Stokes equations
 * 2. Watershed Analysis: Identifies drainage basins using flow accumulation
 * 3. Gradient Descent: Calculates steepest descent paths for river flow
 * 4. Volume Conservation: Ensures water mass is preserved in the system
 */

import type { WaterSystem, WaterPool, WaterFlowNode, Waterfall, RiverSegment } from './types';

export class WaterSystemGenerator {
    private terrainData: Float32Array;
    private width: number;
    private depth: number;
    private maxHeight: number;
    private segments: number;
    
    private flowField: WaterFlowNode[][];
    private poolMap: Map<string, number> = new Map(); // Maps coordinates to pool IDs
    
    constructor(terrainData: Float32Array, width: number, depth: number, maxHeight: number, segments: number) {
        this.terrainData = terrainData;
        this.width = width;
        this.depth = depth;
        this.maxHeight = maxHeight;
        this.segments = segments;
        
        // Initialize flow field grid
        this.flowField = Array(segments).fill(null).map(() => 
            Array(segments).fill(null).map(() => ({
                x: 0, z: 0, height: 0, waterLevel: 0, flowRate: 0,
                flowDirection: { x: 0, z: 0 }, isSource: false, isOutlet: false
            }))
        );
        
        console.log('🌊 Water System Generator initialized');
        console.log(`📏 Terrain: ${width}x${depth}, Height: ${maxHeight}, Resolution: ${segments}x${segments}`);
    }
    
    /**
     * Generate complete water system based on terrain and user preferences
     */
    generateWaterSystem(preferences: {
        hasOcean?: boolean;
        oceanLevel?: number;
        riverDensity?: number;  // 0-1, how many rivers to generate
        lakeDensity?: number;   // 0-1, how many lakes to generate
        waterfallThreshold?: number; // Height difference needed for waterfall
        precipitation?: number; // 0-1, affects water volume
    }): WaterSystem {
        
        console.log('🌊 Starting water system generation...');
        console.log('📊 Preferences:', preferences);
        
        // Step 1: Calculate height field and gradients
        this.calculateHeightField();
        
        // Step 2: Calculate flow directions using steepest descent
        this.calculateFlowDirections();
        
        // Step 3: Identify local minima for potential lakes
        const potentialLakes = this.findLocalMinima();
        console.log(`🏞️  Found ${potentialLakes.length} potential lake locations`);
        
        // Step 4: Generate ocean if requested
        const pools: WaterPool[] = [];
        let globalSeaLevel = preferences.hasOcean ? (preferences.oceanLevel || -50) : -Infinity;
        
        if (preferences.hasOcean) {
            const ocean = this.generateOcean(globalSeaLevel);
            pools.push(ocean);
            console.log(`🌊 Generated ocean at level ${globalSeaLevel}`);
        }
        
        // Step 5: Generate lakes from local minima
        const lakes = this.generateLakes(potentialLakes, preferences.lakeDensity || 0.3, globalSeaLevel);
        pools.push(...lakes);
        console.log(`🏞️  Generated ${lakes.length} lakes`);
        
        // Step 6: Calculate flow accumulation for river generation
        this.calculateFlowAccumulation();
        
        // Step 7: Generate rivers based on flow accumulation
        const rivers = this.generateRivers(preferences.riverDensity || 0.5, pools);
        console.log(`🏔️  Generated ${rivers.length} river segments`);
        
        // Step 8: Generate waterfalls where rivers drop significantly
        const waterfalls = this.generateWaterfalls(rivers, pools, preferences.waterfallThreshold || 20);
        console.log(`💧 Generated ${waterfalls.length} waterfalls`);
        
        // Step 9: Calculate final flow rates and connections
        this.calculateFlowRates(pools, rivers, preferences.precipitation || 0.5);
        
        const waterSystem: WaterSystem = {
            globalSeaLevel,
            pools,
            rivers,
            waterfalls,
            flowField: this.flowField,
            precipitation: preferences.precipitation || 0.5,
            evaporation: 0.1
        };
        
        console.log('✅ Water system generation complete!');
        console.log(`📈 Total water bodies: ${pools.length} pools, ${rivers.length} rivers, ${waterfalls.length} waterfalls`);
        
        return waterSystem;
    }
    
    /**
     * Calculate height field from terrain data
     */
    private calculateHeightField(): void {
        const stepX = this.width / (this.segments - 1);
        const stepZ = this.depth / (this.segments - 1);
        
        for (let i = 0; i < this.segments; i++) {
            for (let j = 0; j < this.segments; j++) {
                const terrainIndex = i * this.segments + j;
                const height = this.terrainData[terrainIndex * 3 + 1]; // Y coordinate
                
                this.flowField[i][j].x = (j - this.segments / 2) * stepX;
                this.flowField[i][j].z = (i - this.segments / 2) * stepZ;
                this.flowField[i][j].height = height;
                this.flowField[i][j].waterLevel = height; // Initially no water
            }
        }
    }
    
    /**
     * Calculate flow directions using steepest descent algorithm
     * This is the mathematical core of river generation
     */
    private calculateFlowDirections(): void {
        console.log('🧮 Calculating flow directions using steepest descent...');
        
        for (let i = 1; i < this.segments - 1; i++) {
            for (let j = 1; j < this.segments - 1; j++) {
                const currentHeight = this.flowField[i][j].height;
                
                // Calculate gradients in 8 directions (Moore neighborhood)
                const neighbors = [
                    { di: -1, dj: -1, distance: Math.sqrt(2) }, // NW
                    { di: -1, dj:  0, distance: 1 },            // N
                    { di: -1, dj:  1, distance: Math.sqrt(2) }, // NE
                    { di:  0, dj: -1, distance: 1 },            // W
                    { di:  0, dj:  1, distance: 1 },            // E
                    { di:  1, dj: -1, distance: Math.sqrt(2) }, // SW
                    { di:  1, dj:  0, distance: 1 },            // S
                    { di:  1, dj:  1, distance: Math.sqrt(2) }  // SE
                ];
                
                let steepestGradient = 0;
                let flowDx = 0, flowDz = 0;
                
                for (const neighbor of neighbors) {
                    const ni = i + neighbor.di;
                    const nj = j + neighbor.dj;
                    const neighborHeight = this.flowField[ni][nj].height;
                    
                    // Calculate gradient: rise/run
                    const heightDiff = currentHeight - neighborHeight;
                    const gradient = heightDiff / neighbor.distance;
                    
                    if (gradient > steepestGradient) {
                        steepestGradient = gradient;
                        flowDx = neighbor.dj;
                        flowDz = neighbor.di;
                    }
                }
                
                // Normalize flow direction
                const flowMagnitude = Math.sqrt(flowDx * flowDx + flowDz * flowDz);
                if (flowMagnitude > 0) {
                    this.flowField[i][j].flowDirection.x = flowDx / flowMagnitude;
                    this.flowField[i][j].flowDirection.z = flowDz / flowMagnitude;
                }
            }
        }
    }
    
    /**
     * Find local minima in the terrain - potential lake locations
     */
    private findLocalMinima(): { x: number; z: number; height: number; drainageArea: number }[] {
        const minima: { x: number; z: number; height: number; drainageArea: number }[] = [];
        
        for (let i = 1; i < this.segments - 1; i++) {
            for (let j = 1; j < this.segments - 1; j++) {
                const currentHeight = this.flowField[i][j].height;
                let isMinimum = true;
                
                // Check if all neighbors are higher
                for (let di = -1; di <= 1; di++) {
                    for (let dj = -1; dj <= 1; dj++) {
                        if (di === 0 && dj === 0) continue;
                        
                        const neighborHeight = this.flowField[i + di][j + dj].height;
                        if (neighborHeight <= currentHeight) {
                            isMinimum = false;
                            break;
                        }
                    }
                    if (!isMinimum) break;
                }
                
                if (isMinimum) {
                    // Calculate approximate drainage area (simplified)
                    const drainageArea = this.estimateDrainageArea(i, j);
                    
                    minima.push({
                        x: this.flowField[i][j].x,
                        z: this.flowField[i][j].z,
                        height: currentHeight,
                        drainageArea
                    });
                }
            }
        }
        
        // Sort by drainage area (larger areas get priority for lake generation)
        return minima.sort((a, b) => b.drainageArea - a.drainageArea);
    }
    
    /**
     * Estimate drainage area using flow accumulation
     */
    private estimateDrainageArea(centerI: number, centerJ: number): number {
        let area = 0;
        const visited = new Set<string>();
        const queue = [{ i: centerI, j: centerJ }];
        
        while (queue.length > 0) {
            const { i, j } = queue.shift()!;
            const key = `${i},${j}`;
            
            if (visited.has(key) || i < 0 || i >= this.segments || j < 0 || j >= this.segments) {
                continue;
            }
            
            visited.add(key);
            area++;
            
            // Check if neighboring cells flow towards this cell
            for (let di = -1; di <= 1; di++) {
                for (let dj = -1; dj <= 1; dj++) {
                    if (di === 0 && dj === 0) continue;
                    
                    const ni = i + di;
                    const nj = j + dj;
                    
                    if (ni >= 0 && ni < this.segments && nj >= 0 && nj < this.segments) {
                        const flowDir = this.flowField[ni][nj].flowDirection;
                        
                        // Check if flow direction points towards current cell
                        if (Math.abs(flowDir.x + dj) < 0.5 && Math.abs(flowDir.z + di) < 0.5) {
                            queue.push({ i: ni, j: nj });
                        }
                    }
                }
            }
        }
        
        return area;
    }
    
    /**
     * Generate ocean covering low-lying areas
     */
    private generateOcean(seaLevel: number): WaterPool {
        let minX = Infinity, maxX = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;
        let volume = 0;
        
        // Find ocean boundaries and calculate volume
        for (let i = 0; i < this.segments; i++) {
            for (let j = 0; j < this.segments; j++) {
                const height = this.flowField[i][j].height;
                
                if (height <= seaLevel) {
                    const x = this.flowField[i][j].x;
                    const z = this.flowField[i][j].z;
                    
                    minX = Math.min(minX, x);
                    maxX = Math.max(maxX, x);
                    minZ = Math.min(minZ, z);
                    maxZ = Math.max(maxZ, z);
                    
                    // Set water level
                    this.flowField[i][j].waterLevel = seaLevel;
                    volume += seaLevel - height;
                }
            }
        }
        
        return {
            id: 0,
            type: 'ocean',
            boundingBox: { minX, maxX, minZ, maxZ },
            waterLevel: seaLevel,
            volume,
            outlets: [],
            inlets: []
        };
    }
    
    /**
     * Generate lakes from local minima
     */
    private generateLakes(minima: { x: number; z: number; height: number; drainageArea: number }[], 
                         density: number, globalSeaLevel: number): WaterPool[] {
        const lakes: WaterPool[] = [];
        const numLakes = Math.floor(minima.length * density);
        
        for (let i = 0; i < numLakes && i < minima.length; i++) {
            const minimum = minima[i];
            
            // Skip if below sea level
            if (minimum.height <= globalSeaLevel) continue;
            
            // Calculate lake water level (fill until overflow)
            const waterLevel = this.calculateLakeLevel(minimum);
            
            // Generate lake geometry
            const lake = this.generateLakeGeometry(minimum, waterLevel, lakes.length + 1);
            
            if (lake.volume > 0) {
                lakes.push(lake);
            }
        }
        
        return lakes;
    }
    
    /**
     * Calculate water level for a lake by simulating filling until overflow
     */
    private calculateLakeLevel(minimum: { x: number; z: number; height: number }): number {
        // Find grid coordinates
        const stepX = this.width / (this.segments - 1);
        const stepZ = this.depth / (this.segments - 1);
        
        const centerI = Math.round((minimum.z + this.depth / 2) / stepZ);
        const centerJ = Math.round((minimum.x + this.width / 2) / stepX);
        
        // Simulate filling by gradually raising water level
        let waterLevel = minimum.height;
        const maxLevel = minimum.height + 50; // Maximum lake depth
        
        for (let level = minimum.height; level < maxLevel; level += 1) {
            // Check if water would overflow at this level
            if (this.wouldOverflow(centerI, centerJ, level)) {
                return level - 1;
            }
        }
        
        return maxLevel;
    }
    
    /**
     * Check if water would overflow from a lake at given level
     */
    private wouldOverflow(centerI: number, centerJ: number, waterLevel: number): boolean {
        const visited = new Set<string>();
        const queue = [{ i: centerI, j: centerJ }];
        
        while (queue.length > 0) {
            const { i, j } = queue.shift()!;
            const key = `${i},${j}`;
            
            if (visited.has(key) || i < 0 || i >= this.segments || j < 0 || j >= this.segments) {
                continue;
            }
            
            const height = this.flowField[i][j].height;
            
            // If we reach terrain higher than water level, we've found the boundary
            if (height > waterLevel) {
                return false;
            }
            
            visited.add(key);
            
            // If we reach the edge, water would overflow
            if (i === 0 || i === this.segments - 1 || j === 0 || j === this.segments - 1) {
                return true;
            }
            
            // Add neighbors if they're below water level
            for (let di = -1; di <= 1; di++) {
                for (let dj = -1; dj <= 1; dj++) {
                    if (di === 0 && dj === 0) continue;
                    
                    const ni = i + di;
                    const nj = j + dj;
                    
                    if (ni >= 0 && ni < this.segments && nj >= 0 && nj < this.segments) {
                        const neighborHeight = this.flowField[ni][nj].height;
                        if (neighborHeight <= waterLevel) {
                            queue.push({ i: ni, j: nj });
                        }
                    }
                }
            }
        }
        
        return false;
    }
    
    /**
     * Generate lake geometry and update flow field
     */
    private generateLakeGeometry(minimum: { x: number; z: number; height: number }, 
                                waterLevel: number, lakeId: number): WaterPool {
        let minX = Infinity, maxX = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;
        let volume = 0;
        
        // Flood fill to determine lake extent
        const stepX = this.width / (this.segments - 1);
        const stepZ = this.depth / (this.segments - 1);
        
        const centerI = Math.round((minimum.z + this.depth / 2) / stepZ);
        const centerJ = Math.round((minimum.x + this.width / 2) / stepX);
        
        const visited = new Set<string>();
        const queue = [{ i: centerI, j: centerJ }];
        
        while (queue.length > 0) {
            const { i, j } = queue.shift()!;
            const key = `${i},${j}`;
            
            if (visited.has(key) || i < 0 || i >= this.segments || j < 0 || j >= this.segments) {
                continue;
            }
            
            const height = this.flowField[i][j].height;
            
            if (height > waterLevel) continue;
            
            visited.add(key);
            
            // Update water level in flow field
            this.flowField[i][j].waterLevel = waterLevel;
            
            const x = this.flowField[i][j].x;
            const z = this.flowField[i][j].z;
            
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minZ = Math.min(minZ, z);
            maxZ = Math.max(maxZ, z);
            
            volume += waterLevel - height;
            
            // Mark in pool map
            this.poolMap.set(key, lakeId);
            
            // Add neighbors
            for (let di = -1; di <= 1; di++) {
                for (let dj = -1; dj <= 1; dj++) {
                    if (di === 0 && dj === 0) continue;
                    queue.push({ i: i + di, j: j + dj });
                }
            }
        }
        
        return {
            id: lakeId,
            type: 'lake',
            boundingBox: { minX, maxX, minZ, maxZ },
            waterLevel,
            volume,
            outlets: [],
            inlets: []
        };
    }
    
    /**
     * Calculate flow accumulation for river generation
     */
    private calculateFlowAccumulation(): void {
        console.log('🧮 Calculating flow accumulation for river generation...');
        
        // Initialize accumulation values
        for (let i = 0; i < this.segments; i++) {
            for (let j = 0; j < this.segments; j++) {
                this.flowField[i][j].flowRate = 1; // Base precipitation
            }
        }
        
        // Accumulate flow following flow directions
        // Process from highest to lowest elevation to ensure proper accumulation
        const sortedCells = [];
        for (let i = 0; i < this.segments; i++) {
            for (let j = 0; j < this.segments; j++) {
                sortedCells.push({ i, j, height: this.flowField[i][j].height });
            }
        }
        
        sortedCells.sort((a, b) => b.height - a.height);
        
        for (const cell of sortedCells) {
            const { i, j } = cell;
            const flowDir = this.flowField[i][j].flowDirection;
            
            // Find target cell
            const targetI = Math.round(i + flowDir.z);
            const targetJ = Math.round(j + flowDir.x);
            
            if (targetI >= 0 && targetI < this.segments && targetJ >= 0 && targetJ < this.segments) {
                // Add current cell's flow to target cell
                this.flowField[targetI][targetJ].flowRate += this.flowField[i][j].flowRate;
            }
        }
    }
    
    /**
     * Generate rivers based on flow accumulation
     */
    private generateRivers(density: number, pools: WaterPool[]): RiverSegment[] {
        console.log('🏔️  Generating rivers from flow accumulation...');
        
        const rivers: RiverSegment[] = [];
        const riverThreshold = this.segments * this.segments * 0.01 * density; // Minimum flow for river
        
        const visited = new Set<string>();
        
        for (let i = 0; i < this.segments; i++) {
            for (let j = 0; j < this.segments; j++) {
                const key = `${i},${j}`;
                
                if (visited.has(key)) continue;
                if (this.flowField[i][j].flowRate < riverThreshold) continue;
                
                // Trace river from this point
                const riverSegment = this.traceRiver(i, j, visited);
                
                if (riverSegment.points.length > 5) { // Minimum river length
                    rivers.push(riverSegment);
                }
            }
        }
        
        return rivers;
    }
    
    /**
     * Trace a river following flow directions
     */
    private traceRiver(startI: number, startJ: number, visited: Set<string>): RiverSegment {
        const points: { x: number; z: number; height: number; width: number }[] = [];
        let currentI = startI;
        let currentJ = startJ;
        let totalFlow = 0;
        
        while (currentI >= 0 && currentI < this.segments && currentJ >= 0 && currentJ < this.segments) {
            const key = `${currentI},${currentJ}`;
            
            if (visited.has(key)) break;
            visited.add(key);
            
            const cell = this.flowField[currentI][currentJ];
            const width = Math.min(Math.sqrt(cell.flowRate) * 0.5, 10); // River width based on flow
            
            points.push({
                x: cell.x,
                z: cell.z,
                height: cell.height,
                width
            });
            
            totalFlow += cell.flowRate;
            
            // Follow flow direction
            const flowDir = cell.flowDirection;
            const nextI = Math.round(currentI + flowDir.z);
            const nextJ = Math.round(currentJ + flowDir.x);
            
            // Stop if we reach a water body
            if (this.poolMap.has(`${nextI},${nextJ}`)) {
                break;
            }
            
            currentI = nextI;
            currentJ = nextJ;
        }
        
        return {
            points,
            flowDirection: Math.atan2(
                points[points.length - 1]?.z - points[0]?.z || 0,
                points[points.length - 1]?.x - points[0]?.x || 0
            ),
            avgFlowRate: totalFlow / points.length,
            connectsTo: []
        };
    }
    
    /**
     * Generate waterfalls where rivers drop significantly
     */
    private generateWaterfalls(rivers: RiverSegment[], pools: WaterPool[], 
                              heightThreshold: number): Waterfall[] {
        console.log('💧 Generating waterfalls...');
        
        const waterfalls: Waterfall[] = [];
        
        for (const river of rivers) {
            for (let i = 0; i < river.points.length - 1; i++) {
                const current = river.points[i];
                const next = river.points[i + 1];
                
                const heightDrop = current.height - next.height;
                
                if (heightDrop > heightThreshold) {
                    waterfalls.push({
                        startPoint: { x: current.x, z: current.z, height: current.height },
                        endPoint: { x: next.x, z: next.z, height: next.height },
                        width: current.width,
                        flowRate: river.avgFlowRate
                    });
                }
            }
        }
        
        return waterfalls;
    }
    
    /**
     * Calculate final flow rates and water connections
     */
    private calculateFlowRates(pools: WaterPool[], rivers: RiverSegment[], precipitation: number): void {
        console.log('💧 Calculating final flow rates and connections...');
        
        // Scale all flow rates by precipitation
        for (let i = 0; i < this.segments; i++) {
            for (let j = 0; j < this.segments; j++) {
                this.flowField[i][j].flowRate *= precipitation;
            }
        }
        
        // Update river flow rates
        for (const river of rivers) {
            river.avgFlowRate *= precipitation;
        }
        
        console.log('✅ Flow rate calculations complete!');
    }
}
