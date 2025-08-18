
import * as THREE from 'three';
import { state } from './state';
import { TerrainGenerator } from './terrain';

export function updateMovement(terrainGenerator: TerrainGenerator) {
    const moveVector = new THREE.Vector3(0, 0, 0);

    // Calculate movement direction based on camera rotation
    const forward = new THREE.Vector3(0, 0, -1);
    const right = new THREE.Vector3(1, 0, 0);

    forward.applyQuaternion(
        new THREE.Quaternion().setFromEuler(
            new THREE.Euler(0, state.cameraRotation?.y || 0, 0)
        )
    );
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0));

    // WASD movement
    if (state.keys) {
        if (state.keys['KeyW']) moveVector.add(forward);
        if (state.keys['KeyS']) moveVector.sub(forward);
        if (state.keys['KeyA']) moveVector.sub(right);
        if (state.keys['KeyD']) moveVector.add(right);
    }

    moveVector.normalize();
    moveVector.multiplyScalar(state.moveSpeed || 0);

    if (state.controlMode === 'camera') {
        // Free camera movement
        if (state.keys) {
            if (state.keys['KeyQ']) moveVector.y -= (state.moveSpeed || 0);
            if (state.keys['KeyE']) moveVector.y += (state.moveSpeed || 0);
        }

        state.cameraPosition.add(moveVector);
    } else {
        // Player movement with collision
        updatePlayerMovement(moveVector, terrainGenerator);
    }
}

function updatePlayerMovement(moveVector: THREE.Vector3, terrainGenerator: TerrainGenerator) {
    // Apply horizontal movement
    if (state.cameraPosition) {
        state.cameraPosition.x += moveVector.x;
        state.cameraPosition.z += moveVector.z;
    }

    // Jump
    if (state.jump && state.isGrounded) {
        if (state.velocity) state.velocity.y += 0.2; // Jump impulse
        state.isGrounded = false;
        state.jump = false;
    }

    // Apply gravity
    if (state.velocity) state.velocity.y += (state.gravity || 0) * 0.016; // Assuming 60fps
    if (state.cameraPosition && state.velocity) state.cameraPosition.y += state.velocity.y;

    // Ground collision
    if (state.cameraPosition) {
        const groundHeight = terrainGenerator.getHeightAtPosition(
            state.cameraPosition.x,
            state.cameraPosition.z
        );

        const playerHeight = state.playerHeight || 1.8; // Default player height
        if (state.cameraPosition.y <= groundHeight + playerHeight) {
            state.cameraPosition.y = groundHeight + playerHeight;
            if (state.velocity) state.velocity.y = 0;
            state.isGrounded = true;
        } else {
            state.isGrounded = false;
        }
    }
}
