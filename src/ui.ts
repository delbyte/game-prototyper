
import { state } from './state';
import { TerrainGenerator } from './terrain';
import * as THREE from 'three';

export function setupUI(terrainGenerator: TerrainGenerator, scene: THREE.Scene) {
    const cameraButton = document.getElementById('cameraMode');
    const playerButton = document.getElementById('playerMode');
    const regenerateButton = document.getElementById('regenerate');

    cameraButton.addEventListener('click', () => {
        setControlMode('camera', terrainGenerator);
        cameraButton.classList.add('active');
        playerButton.classList.remove('active');
    });

    playerButton.addEventListener('click', () => {
        setControlMode('player', terrainGenerator);
        playerButton.classList.add('active');
        cameraButton.classList.remove('active');
    });

    regenerateButton.addEventListener('click', () => {
        regenerateTerrain(terrainGenerator, scene);
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

function regenerateTerrain(terrainGenerator: TerrainGenerator, scene: THREE.Scene) {
    const terrain = scene.getObjectByName('terrain');
    if (terrain) {
        scene.remove(terrain);
        (terrain as THREE.Mesh).geometry.dispose();
        ((terrain as THREE.Mesh).material as THREE.Material).dispose();
    }

    const newTerrain = terrainGenerator.regenerate();
    newTerrain.name = 'terrain';
    scene.add(newTerrain);
}
