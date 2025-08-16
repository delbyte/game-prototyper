
import { state } from './state';
import { TerrainGenerator } from './terrain';
import * as THREE from 'three';
import { updateSkybox, updateLighting } from './renderer';

import { sampleTerrainParameters } from './sample-terrain-parameters';
import { generateTerrainParameters } from './api';

export function setupUI(terrainGenerator: TerrainGenerator, scene: THREE.Scene) {
    const cameraButton = document.getElementById('cameraMode');
    const playerButton = document.getElementById('playerMode');
    const regenerateButton = document.getElementById('regenerate');
    const generateButton = document.getElementById('generate') as HTMLButtonElement;
    const defaultButton = document.getElementById('default') as HTMLButtonElement;
    const promptInput = document.getElementById('promptInput') as HTMLInputElement;
    const statusElement = document.getElementById('status');

    const updateStatus = (message: string, isLoading = false) => {
        if (statusElement) {
            statusElement.textContent = message;
        }
        if (generateButton) {
            if (isLoading) {
                generateButton.classList.add('loading');
                generateButton.disabled = true;
                generateButton.textContent = 'Generating...';
            } else {
                generateButton.classList.remove('loading');
                generateButton.disabled = false;
                generateButton.textContent = 'Generate';
            }
        }
    };

    cameraButton?.addEventListener('click', () => {
        setControlMode('camera', terrainGenerator);
        cameraButton.classList.add('active');
        playerButton?.classList.remove('active');
    });

    playerButton?.addEventListener('click', () => {
        setControlMode('player', terrainGenerator);
        playerButton.classList.add('active');
        cameraButton?.classList.remove('active');
    });

    regenerateButton?.addEventListener('click', () => {
        updateStatus('Regenerating terrain...');
        try {
            regenerateTerrain(terrainGenerator, scene, null);
            updateStatus('Terrain regenerated');
        } catch (error) {
            updateStatus('Error regenerating terrain');
            console.error('Regeneration error:', error);
        }
    });

    generateButton.addEventListener('click', async () => {
        const prompt = promptInput.value.trim();
        if (!prompt) {
            alert('Please enter a description for the world you want to create.');
            return;
        }
        
        // Show loading state
        generateButton.disabled = true;
        generateButton.textContent = 'Generating...';
        
        try {
            const params = await generateTerrainParameters(prompt);
            console.log('Full generated parameters:', JSON.stringify(params, null, 2));
            regenerateTerrain(terrainGenerator, scene, params);
            console.log('Generated terrain with parameters:', params);
        } catch (error) {
            console.error('Error generating terrain:', error);
            alert(`Failed to generate terrain: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            // Reset button state
            generateButton.disabled = false;
            generateButton.textContent = 'Generate';
        }
    });

    defaultButton?.addEventListener('click', () => {
        updateStatus('Loading default terrain...');
        try {
            regenerateTerrain(terrainGenerator, scene, sampleTerrainParameters);
            updateStatus('Default terrain loaded');
        } catch (error) {
            updateStatus('Error loading default terrain');
            console.error('Default terrain error:', error);
        }
    });

    // Allow Enter key to trigger generation
    promptInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            generateButton?.click();
        }
    });
}

function setControlMode(mode: string, terrainGenerator: TerrainGenerator) {
    state.controlMode = mode;
    if (mode === 'player') {
        // Reset velocity when switching to player mode
        state.velocity.set(0, 0, 0);
        // Position player above ground
        const groundHeight = terrainGenerator.getHeightAtPosition(
            state.cameraPosition.x,
            state.cameraPosition.z
        );
        state.cameraPosition.y = Math.max(state.cameraPosition.y, groundHeight + state.playerHeight);
    }
}

function regenerateTerrain(terrainGenerator: TerrainGenerator, scene: THREE.Scene, params: any) {
    // Remove old terrain
    const terrain = scene.getObjectByName('terrain');
    if (terrain) {
        scene.remove(terrain);
        // Properly dispose of geometry and materials to prevent memory leaks
        if (terrain instanceof THREE.Mesh) {
            terrain.geometry.dispose();
            if (Array.isArray(terrain.material)) {
                terrain.material.forEach(material => material.dispose());
            } else {
                terrain.material.dispose();
            }
        }
    }

    // Generate new terrain
    const newTerrain = terrainGenerator.regenerate(params);
    newTerrain.name = 'terrain';
    scene.add(newTerrain);
    
    // Update skybox and lighting if params are provided
    if (params) {
        if (params.skybox) {
            updateSkybox(params.skybox);
            console.log('Updated skybox with:', params.skybox);
        }
        if (params.lighting) {
            updateLighting(params.lighting);
            console.log('Updated lighting with:', params.lighting);
        }
    }
}
