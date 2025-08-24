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

    // ## Enhanced Ground and Surface Detection ##
    const playerRadius = 0.5;
    
    // Helper function to find the highest surface (terrain or asset) beneath a position
    function findGroundHeight(position: THREE.Vector3): { height: number; isAsset: boolean; normal?: THREE.Vector3 } {
        const raycaster = new THREE.Raycaster();
        const collisionMeshes = assetManager.getCollisionMeshes();
        
        // Cast ray downward from well above the position
        const rayOrigin = new THREE.Vector3(position.x, position.y + 50, position.z);
        const rayDirection = new THREE.Vector3(0, -1, 0);
        raycaster.set(rayOrigin, rayDirection);
        
        let highestAssetHeight = -Infinity;
        let assetNormal: THREE.Vector3 | undefined;
        
        // Check for asset surfaces
        if (collisionMeshes.length > 0) {
            const intersections = raycaster.intersectObjects(collisionMeshes, false);
            for (const intersection of intersections) {
                if (intersection.point.y > highestAssetHeight) {
                    highestAssetHeight = intersection.point.y;
                    assetNormal = intersection.face?.normal?.clone();
                }
            }
        }
        
        // Get terrain height
        const terrainHeight = terrainGenerator.getHeightAtPosition(position.x, position.z);
        
        // Return the highest surface
        if (highestAssetHeight > terrainHeight) {
            return { 
                height: highestAssetHeight, 
                isAsset: true, 
                normal: assetNormal 
            };
        } else {
            return { 
                height: terrainHeight, 
                isAsset: false 
            };
        }
    }
    
    // Helper function to check for horizontal collisions (walls, etc.)
    function checkHorizontalCollision(fromPosition: THREE.Vector3, toPosition: THREE.Vector3): boolean {
        const raycaster = new THREE.Raycaster();
        const collisionMeshes = assetManager.getCollisionMeshes();
        
        if (collisionMeshes.length === 0) return false;
        
        const direction = toPosition.clone().sub(fromPosition);
        const distance = direction.length();
        direction.normalize();
        
        // Cast rays at different heights to check for wall collisions
        const testHeights = [
            fromPosition.y - state.playerHeight * 0.1, // Near feet
            fromPosition.y, // Center
            fromPosition.y + state.playerHeight * 0.7  // Near head
        ];
        
        for (const testHeight of testHeights) {
            const testOrigin = new THREE.Vector3(fromPosition.x, testHeight, fromPosition.z);
            raycaster.set(testOrigin, direction);
            
            const intersections = raycaster.intersectObjects(collisionMeshes, false);
            for (const intersection of intersections) {
                // Check if collision is within movement distance + player radius
                if (intersection.distance < distance + playerRadius) {
                    return true;
                }
            }
        }
        
        return false;
    }

    // Store original position for collision rollback
    const originalPosition = state.cameraPosition.clone();

    // ## Horizontal Movement with Wall Collision ##
    
    // Calculate new horizontal position
    const newHorizontalPos = state.cameraPosition.clone();
    newHorizontalPos.x += horizontalDisplacement.x;
    newHorizontalPos.z += horizontalDisplacement.z;
    
    // Check for horizontal collision
    if (!checkHorizontalCollision(state.cameraPosition, newHorizontalPos)) {
        // No horizontal collision, apply movement
        state.cameraPosition.x = newHorizontalPos.x;
        state.cameraPosition.z = newHorizontalPos.z;
    }
    
    // ## Vertical Movement and Ground Detection ##
    
    // Apply gravity
    state.cameraPosition.y += verticalDisplacement.y;
    
    // Find the ground height at current position
    const groundInfo = findGroundHeight(state.cameraPosition);
    const requiredHeight = groundInfo.height + state.playerHeight;
    
    // Check if player is below ground level
    if (state.cameraPosition.y <= requiredHeight) {
        // Player is on or below ground
        state.cameraPosition.y = requiredHeight;
        state.velocity.y = 0;
        state.isGrounded = true;
        
        // If we're on an asset surface, add a small buffer for smooth movement
        if (groundInfo.isAsset) {
            state.cameraPosition.y += 0.01; // Small buffer to prevent jittering
        }
    } else {
        // Player is in the air
        state.isGrounded = false;
    }
    
    // ## Special handling for walking up gentle slopes ##
    if (state.isGrounded && groundInfo.normal) {
        // Calculate the slope angle
        const slopeAngle = Math.acos(groundInfo.normal.dot(new THREE.Vector3(0, 1, 0)));
        const maxWalkableAngle = Math.PI / 6; // 30 degrees
        
        if (slopeAngle > maxWalkableAngle) {
            // Surface too steep, treat as wall - slide down
            const slideDirection = groundInfo.normal.clone().projectOnPlane(new THREE.Vector3(0, 1, 0)).normalize();
            const slideSpeed = 2.0 * delta;
            state.cameraPosition.add(slideDirection.multiplyScalar(slideSpeed));
        }
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