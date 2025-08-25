import * as THREE from 'three';
import { state } from './state';
import { TerrainGenerator } from './terrain';
import { AssetManager } from './asset-manager';
import { camera } from './camera';

const clock = new THREE.Clock();

function updatePlayerMode(delta: number, terrainGenerator: TerrainGenerator, assetManager: AssetManager) {
    const moveSpeed = 5.0;
    const jumpHeight = 8.0;
    const gravity = -20.0;

    // Apply gravity
    if (!state.isGrounded) {
        state.velocity.y += gravity * delta;
    }

    // Determine movement direction from input
    const moveDirection = new THREE.Vector3();
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    const right = new THREE.Vector3().crossVectors(camera.up, forward).normalize();

    if (state.keys['KeyW']) moveDirection.add(forward);
    if (state.keys['KeyS']) moveDirection.sub(forward);
    if (state.keys['KeyD']) moveDirection.add(right.clone().negate()); // A = left (negative right)
    if (state.keys['KeyA']) moveDirection.add(right); // D = right (positive right)

    moveDirection.normalize();

    const horizontalDisplacement = moveDirection.multiplyScalar(moveSpeed * delta);
    
    // Jumping
    if (state.jump && state.isGrounded) {
        state.velocity.y = jumpHeight;
    }
    state.jump = false;

    const verticalDisplacement = new THREE.Vector3(0, state.velocity.y * delta, 0);

    // ## Precise Mesh Collision Detection ##
    const playerRadius = 0.5;
    const originalPosition = state.cameraPosition.clone();
    
    // Helper function to check collision with mesh surfaces using raycasting
    function checkMeshCollision(newPosition: THREE.Vector3, direction: THREE.Vector3): boolean {
        const raycaster = new THREE.Raycaster();
        
        // Get real-time collision meshes (always up-to-date with transforms)
        const collisionMeshes = assetManager.getCollisionMeshes();
        
        // Early exit if no collision meshes
        if (collisionMeshes.length === 0) return false;
        
        // Cast rays in multiple directions to check for collision
        const testDirections = [
            direction.clone().normalize(), // Primary movement direction
            new THREE.Vector3(0, -1, 0), // Downward (for ground collision)
        ];
        
        // Add more directions for more thorough checking if moving fast
        const movementSpeed = direction.length();
        if (movementSpeed > 0.1) {
            testDirections.push(
                direction.clone().normalize().multiplyScalar(-1), // Backward direction
                new THREE.Vector3(0, 1, 0),  // Upward (for ceiling collision)
            );
        }
        
        // Test from player center and key offset positions
        const testPositions = [
            newPosition.clone(),
            newPosition.clone().add(new THREE.Vector3(playerRadius * 0.7, 0, 0)),
            newPosition.clone().add(new THREE.Vector3(-playerRadius * 0.7, 0, 0)),
            newPosition.clone().add(new THREE.Vector3(0, 0, playerRadius * 0.7)),
            newPosition.clone().add(new THREE.Vector3(0, 0, -playerRadius * 0.7)),
        ];
        
        // Add vertical test positions if checking vertical movement
        if (Math.abs(direction.y) > 0.01) {
            testPositions.push(
                newPosition.clone().add(new THREE.Vector3(0, state.playerHeight * 0.4, 0)),
                newPosition.clone().add(new THREE.Vector3(0, -state.playerHeight * 0.4, 0)),
            );
        }
        
        for (const testPos of testPositions) {
            for (const testDir of testDirections) {
                raycaster.set(testPos, testDir);
                const intersections = raycaster.intersectObjects(collisionMeshes, false);
                
                // Check if any intersection is within player radius
                for (const intersection of intersections) {
                    if (intersection.distance < playerRadius) {
                        return true; // Collision detected
                    }
                }
            }
        }
        
        return false; // No collision
    }

    // Move on X axis with mesh collision
    const newPosX = state.cameraPosition.clone();
    newPosX.x += horizontalDisplacement.x;
    
    if (checkMeshCollision(newPosX, new THREE.Vector3(horizontalDisplacement.x, 0, 0))) {
        // Collision detected, don't move
    } else {
        state.cameraPosition.x = newPosX.x;
    }

    // Move on Z axis with mesh collision
    const newPosZ = state.cameraPosition.clone();
    newPosZ.z += horizontalDisplacement.z;
    
    if (checkMeshCollision(newPosZ, new THREE.Vector3(0, 0, horizontalDisplacement.z))) {
        // Collision detected, don't move
    } else {
        state.cameraPosition.z = newPosZ.z;
    }

    // Move on Y axis (Gravity) with mesh collision
    const newPosY = state.cameraPosition.clone();
    newPosY.y += verticalDisplacement.y;
    
    if (checkMeshCollision(newPosY, new THREE.Vector3(0, verticalDisplacement.y, 0))) {
        // Collision detected
        state.velocity.y = 0;
        if (verticalDisplacement.y < 0) {
            // Hit ground
            state.isGrounded = true;
        }
    } else {
        state.cameraPosition.y = newPosY.y;
    }

    // ## Terrain Collision ##
    const terrainHeight = terrainGenerator.getHeightAtPosition(state.cameraPosition.x, state.cameraPosition.z);
    if (state.cameraPosition.y < terrainHeight + state.playerHeight) {
        state.cameraPosition.y = terrainHeight + state.playerHeight;
        state.velocity.y = 0;
        state.isGrounded = true;
    } else {
        state.isGrounded = false;
    }
}

function updateCameraMode(delta: number) {
    const moveSpeed = 15.0 * delta; // Camera mode is faster

    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    const right = new THREE.Vector3().crossVectors(camera.up, forward).normalize();

    if (state.keys['KeyW']) state.cameraPosition.addScaledVector(forward, moveSpeed);
    if (state.keys['KeyS']) state.cameraPosition.addScaledVector(forward, -moveSpeed);
    if (state.keys['KeyD']) state.cameraPosition.addScaledVector(right, -moveSpeed); // A = left (negative right)
    if (state.keys['KeyA']) state.cameraPosition.addScaledVector(right, moveSpeed); // D = right (positive right)
    if (state.keys['KeyE']) state.cameraPosition.y += moveSpeed;
    if (state.keys['KeyQ']) state.cameraPosition.y -= moveSpeed;
}

export function updateMovement(terrainGenerator: TerrainGenerator, assetManager: AssetManager) {
    if (!clock.running) clock.start();
    const delta = clock.getDelta();

    if (state.isPlayerMode) {
        updatePlayerMode(delta, terrainGenerator, assetManager);
    } else {
        updateCameraMode(delta);
    }
}