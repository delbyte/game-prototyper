
import * as THREE from 'three';

// Define the state type to include the isPlayerMode property
interface StateType {
    keys: Record<string, boolean | undefined>;
    mouse: { x: number; y: number; prevX: number; prevY: number };
    isPointerLocked: boolean;
    controlMode: 'camera' | 'player';
    cameraPosition: THREE.Vector3;
    cameraRotation: THREE.Euler;
    moveSpeed: number;
    mouseSensitivity: number;
    playerHeight: number;
    gravity: number;
    velocity: THREE.Vector3;
    isGrounded: boolean;
    jump: boolean;
    devMode: boolean;
    isPlayerMode: boolean; // Add this to the type definition
}

export const state = {
    keys: {} as Record<string, boolean | undefined>,
    mouse: { x: 0, y: 0, prevX: 0, prevY: 0 },
    isPointerLocked: false,
    controlMode: 'camera' as 'camera' | 'player', // 'camera' or 'player'
    cameraPosition: new THREE.Vector3(0, 50, 50),
    cameraRotation: new THREE.Euler(0, 0, 0),
    moveSpeed: 0.5,
    mouseSensitivity: 0.002,
    playerHeight: 2,
    gravity: -0.8,
    velocity: new THREE.Vector3(0, 0, 0),
    isGrounded: false,
    jump: false,
    devMode: true,
} as StateType;

// Add a getter/setter for player mode to simplify logic
Object.defineProperty(state, 'isPlayerMode', {
    get: function() {
        return this.controlMode === 'player';
    },
    set: function(value: boolean) {
        this.controlMode = value ? 'player' : 'camera';
    }
});
