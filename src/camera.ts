
import * as THREE from 'three';
import { state } from './state';

let camera: THREE.PerspectiveCamera;

export function initCamera() {
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        10000
    );
    camera.position.copy(state.cameraPosition);
    return camera;
}

export function updateCameraRotation() {
    state.cameraRotation.y -= state.mouse.x * state.mouseSensitivity;
    state.cameraRotation.x -= state.mouse.y * state.mouseSensitivity;

    // Clamp vertical rotation to prevent over-rotation
    state.cameraRotation.x = Math.max(
        -Math.PI / 2,
        Math.min(Math.PI / 2, state.cameraRotation.x)
    );
}

export { camera };
