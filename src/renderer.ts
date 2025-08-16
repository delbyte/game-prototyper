
import * as THREE from 'three';
import { state } from './state';
import { camera } from './camera';
import { updateMovement } from './player';
import { TerrainGenerator } from './terrain';

let renderer: THREE.WebGLRenderer;
let scene: THREE.Scene;
let skybox: THREE.Mesh;
let skyMaterial: THREE.ShaderMaterial;

export function initRenderer() {
    // Create scene
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x87CEEB, 1000, 10000);

    // Create renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x87CEEB);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const container = document.getElementById('container');
    if (container) {
        container.appendChild(renderer.domElement);
    }

    setupLighting();
    createSkybox();

    window.addEventListener('resize', onWindowResize);

    return { renderer, scene };
}

function setupLighting() {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    // Directional light (sun)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(100, 100, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.camera.left = -100;
    directionalLight.shadow.camera.right = 100;
    directionalLight.shadow.camera.top = 100;
    directionalLight.shadow.camera.bottom = -100;
    scene.add(directionalLight);
}

function createSkybox() {
    // Create a fullscreen quad for the procedural sky
    const skyGeometry = new THREE.PlaneGeometry(2, 2);

    skyMaterial = new THREE.ShaderMaterial({
        uniforms: {
            cameraWorldMatrix: { value: new THREE.Matrix4() },
            cameraProjectionMatrixInverse: { value: new THREE.Matrix4() }
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = vec4(position.xy, 1.0, 1.0);
            }
        `,
        fragmentShader: `
            uniform mat4 cameraWorldMatrix;
            uniform mat4 cameraProjectionMatrixInverse;
            varying vec2 vUv;
            
            void main() {
                // Convert screen coordinates to world ray direction
                vec2 screenPos = vUv * 2.0 - 1.0;
                vec4 ndcPos = vec4(screenPos, 1.0, 1.0);
                vec4 worldPos = cameraWorldMatrix * cameraProjectionMatrixInverse * ndcPos;
                vec3 rayDir = normalize(worldPos.xyz);
                
                // Calculate elevation angle (0 = horizon, 1 = zenith)
                float elevation = rayDir.y * 0.5 + 0.5;
                elevation = smoothstep(0.0, 1.0, elevation);
                
                // Sky colors
                vec3 horizonColor = vec3(0.94, 0.85, 1.0); // Light blue/white at horizon
                vec3 zenithColor = vec3(0.53, 0.81, 0.92);  // Sky blue at zenith
                
                // Create gradient
                vec3 skyColor = mix(horizonColor, zenithColor, elevation);
                
                // Add subtle atmospheric effect
                float atmosphere = 1.0 - abs(rayDir.y);
                atmosphere = pow(atmosphere, 2.0);
                skyColor = mix(skyColor, vec3(0.9, 0.95, 1.0), atmosphere * 0.1);
                
                gl_FragColor = vec4(skyColor, 1.0);
            }
        `,
        depthWrite: false,
        depthTest: false,
        side: THREE.DoubleSide
    });

    skybox = new THREE.Mesh(skyGeometry, skyMaterial);
    skybox.renderOrder = -1;
    skybox.frustumCulled = false;
    scene.add(skybox);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

export function startAnimationLoop(terrainGenerator: TerrainGenerator) {
    requestAnimationFrame(() => startAnimationLoop(terrainGenerator));

    updateMovement(terrainGenerator);

    camera.position.copy(state.cameraPosition);
    camera.rotation.set(0, 0, 0);
    camera.rotateY(state.cameraRotation.y);
    camera.rotateX(state.cameraRotation.x);

    if (skyMaterial) {
        camera.updateMatrixWorld();
        skyMaterial.uniforms.cameraWorldMatrix.value.copy(camera.matrixWorld);
        skyMaterial.uniforms.cameraProjectionMatrixInverse.value.copy(camera.projectionMatrixInverse);
    }

    renderer.render(scene, camera);
}
