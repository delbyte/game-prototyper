
import * as THREE from 'three';

export const state = {
    keys: {} as Record<string, boolean | undefined>,
    mouse: { x: 0, y: 0, prevX: 0, prevY: 0 },
    isPointerLocked: false,
    controlMode: 'camera', // 'camera' or 'player'
    cameraPosition: new THREE.Vector3(0, 50, 50),
    cameraRotation: new THREE.Euler(0, 0, 0),
    moveSpeed: 0.5,
    mouseSensitivity: 0.002,
    playerHeight: 2,
    gravity: -0.8,
    velocity: new THREE.Vector3(0, 0, 0),
    isGrounded: false,
    jump: false,
};
