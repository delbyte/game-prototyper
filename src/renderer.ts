
import * as THREE from 'three';
import { state } from './state';
import { camera } from './camera';
import { updateMovement } from './player';
import { TerrainGenerator } from './terrain';

import { AssetManager } from './asset-manager';

let renderer: THREE.WebGLRenderer;
let scene: THREE.Scene;
let skybox: THREE.Mesh;
let skyMaterial: THREE.ShaderMaterial;

export function initRenderer(skyboxParams: any = null, lightingParams: any = null) {
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

    setupLighting(lightingParams);
    createSkybox(skyboxParams);

    window.addEventListener('resize', onWindowResize);

    return { renderer, scene };
}

function setupLighting(params: any) {
    // Ambient light
    const ambientColor = params ? new THREE.Color(params.ambient.color.r, params.ambient.color.g, params.ambient.color.b) : new THREE.Color(0x404040);
    const ambientIntensity = params ? params.ambient.intensity : 0.6;
    const ambientLight = new THREE.AmbientLight(ambientColor, ambientIntensity);
    scene.add(ambientLight);

    // Directional light (sun)
    const directionalColor = params ? new THREE.Color(params.directional.color.r, params.directional.color.g, params.directional.color.b) : new THREE.Color(0xffffff);
    const directionalIntensity = params ? params.directional.intensity : 0.8;
    const directionalLight = new THREE.DirectionalLight(directionalColor, directionalIntensity);
    directionalLight.position.set(params ? params.directional.position.x : 100, params ? params.directional.position.y : 100, params ? params.directional.position.z : 50);
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

function createSkybox(params: any) {
    // Create a fullscreen quad for the procedural sky
    const skyGeometry = new THREE.PlaneGeometry(2, 2);

    const horizonColor = params ? new THREE.Color(params.horizonColor.r, params.horizonColor.g, params.horizonColor.b) : new THREE.Color(0.94, 0.85, 1.0);
    const zenithColor = params ? new THREE.Color(params.zenithColor.r, params.zenithColor.g, params.zenithColor.b) : new THREE.Color(0.53, 0.81, 0.92);
    const atmosphereColor = params ? new THREE.Color(params.atmosphereColor.r, params.atmosphereColor.g, params.atmosphereColor.b) : new THREE.Color(0.9, 0.95, 1.0);
    const atmosphereStrength = params ? params.atmosphereStrength : 0.1;

    skyMaterial = new THREE.ShaderMaterial({
        uniforms: {
            cameraWorldMatrix: { value: new THREE.Matrix4() },
            cameraProjectionMatrixInverse: { value: new THREE.Matrix4() },
            horizonColor: { value: horizonColor },
            zenithColor: { value: zenithColor },
            atmosphereColor: { value: atmosphereColor },
            atmosphereStrength: { value: atmosphereStrength },
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
            uniform vec3 horizonColor;
            uniform vec3 zenithColor;
            uniform vec3 atmosphereColor;
            uniform float atmosphereStrength;
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
                vec3 skyColor = mix(horizonColor, zenithColor, elevation);
                
                // Add subtle atmospheric effect
                float atmosphere = 1.0 - abs(rayDir.y);
                atmosphere = pow(atmosphere, 2.0);
                skyColor = mix(skyColor, atmosphereColor, atmosphere * atmosphereStrength);
                
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

export function startAnimationLoop(terrainGenerator: TerrainGenerator, assetManager: AssetManager) {
    requestAnimationFrame(() => startAnimationLoop(terrainGenerator, assetManager));

    updateMovement(terrainGenerator, assetManager);

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

export function updateSkybox(params: any) {
    if (!skyMaterial) return;
    
    const horizonColor = params ? new THREE.Color(params.horizonColor.r, params.horizonColor.g, params.horizonColor.b) : new THREE.Color(0.94, 0.85, 1.0);
    const zenithColor = params ? new THREE.Color(params.zenithColor.r, params.zenithColor.g, params.zenithColor.b) : new THREE.Color(0.53, 0.81, 0.92);
    const atmosphereColor = params ? new THREE.Color(params.atmosphereColor.r, params.atmosphereColor.g, params.atmosphereColor.b) : new THREE.Color(0.9, 0.95, 1.0);
    const atmosphereStrength = params ? params.atmosphereStrength : 0.1;

    skyMaterial.uniforms.horizonColor.value = horizonColor;
    skyMaterial.uniforms.zenithColor.value = zenithColor;
    skyMaterial.uniforms.atmosphereColor.value = atmosphereColor;
    skyMaterial.uniforms.atmosphereStrength.value = atmosphereStrength;
    
    console.log('Updated skybox with params:', params);
}

export function updateLighting(params: any) {
    // Remove existing lights
    const lightsToRemove = scene.children.filter(child => 
        child instanceof THREE.AmbientLight || child instanceof THREE.DirectionalLight
    );
    lightsToRemove.forEach(light => scene.remove(light));
    
    // Add new lights with new parameters
    setupLighting(params);
    
    console.log('Updated lighting with params:', params);
}
