
import { state } from './state';
import { TerrainGenerator } from './terrain';
import * as THREE from 'three';
import { updateSkybox, updateLighting } from './renderer';

import { sampleTerrainParameters } from './sample-terrain-parameters';
import { generateTerrainParameters } from './api';

export function setupUI(terrainGenerator: TerrainGenerator, scene: THREE.Scene) {
    const uiContainer = document.getElementById('ui');
    if (!uiContainer) {
        console.error('UI container not found in index.html');
        return;
    }

    // Dev Mode Button
    const devModeButton = createButton('Toggle Dev Mode (OFF)', () => {
        state.devMode = !state.devMode;
        devModeButton.textContent = `Toggle Dev Mode (${state.devMode ? 'ON' : 'OFF'})`;
        console.log(`Dev Mode is now: ${state.devMode ? 'ON' : 'OFF'}`);
        // Potentially re-trigger asset browser setup if it's open
        // or provide a way to refresh assets based on dev mode
    });
    uiContainer.appendChild(devModeButton);

    // Get references to buttons from index.html
    const cameraModeButton = document.getElementById('cameraMode') as HTMLButtonElement;
    const playerModeButton = document.getElementById('playerMode') as HTMLButtonElement;
    const regenerateButton = document.getElementById('regenerate') as HTMLButtonElement;
    const promptInput = document.getElementById('promptInput') as HTMLInputElement;
    const generateButton = document.getElementById('generate') as HTMLButtonElement;
    const defaultButton = document.getElementById('default') as HTMLButtonElement;

    // Event Listeners for buttons from index.html
    cameraModeButton.addEventListener('click', () => setControlMode('camera', terrainGenerator));
    playerModeButton.addEventListener('click', () => setControlMode('player', terrainGenerator));
    regenerateButton.addEventListener('click', () => regenerateTerrain(terrainGenerator, scene, sampleTerrainParameters));

    generateButton.addEventListener('click', async () => {
        const prompt = promptInput.value;
        if (prompt) {
            const statusDiv = document.getElementById('status');
            if (statusDiv) statusDiv.textContent = 'Generating...';
            generateButton.disabled = true;
            generateButton.classList.add('loading');
            try {
                const generatedParams = await generateTerrainParameters(prompt);
                regenerateTerrain(terrainGenerator, scene, generatedParams);
                if (statusDiv) statusDiv.textContent = 'Generated!';
            } catch (error) {
                console.error('Error generating terrain:', error);
                if (statusDiv) statusDiv.textContent = 'Generation failed.';
            } finally {
                generateButton.disabled = false;
                generateButton.classList.remove('loading');
            }
        }
    });

    defaultButton.addEventListener('click', () => {
        regenerateTerrain(terrainGenerator, scene, sampleTerrainParameters);
        const statusDiv = document.getElementById('status');
        if (statusDiv) statusDiv.textContent = 'Default terrain loaded.';
    });

    // Initial state for control mode buttons
    if (state.controlMode === 'camera') {
        cameraModeButton.classList.add('active');
        playerModeButton.classList.remove('active');
    } else {
        cameraModeButton.classList.remove('active');
        playerModeButton.classList.add('active');
    }

    // Helper function to create buttons (used for devModeButton)
    function createButton(text: string, onClick: () => void) {
        const button = document.createElement('button');
        button.textContent = text;
        button.className = 'ui-button'; // Use a common class for styling
        button.onclick = onClick;
        return button;
    }

    // The rest of the helper functions (createPanel, createSlider) remain as they were
    // ...
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
