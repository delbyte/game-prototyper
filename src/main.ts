
import './style.css';
import { initRenderer, startAnimationLoop } from './renderer';
import { initCamera } from './camera';
import { setupControls } from './controls';
import { setupUI } from './ui';
import { TerrainGenerator } from './terrain';
import { updateMovement } from './player';
import { state } from './state';
import { sampleTerrainParameters } from './sample-terrain-parameters';

const { renderer, scene } = initRenderer(sampleTerrainParameters.skybox, sampleTerrainParameters.lighting);
const camera = initCamera();
const terrainGenerator = new TerrainGenerator(sampleTerrainParameters);
const terrain = terrainGenerator.generateTerrain();
terrain.name = 'terrain';
scene.add(terrain);

setupControls(renderer.domElement);
setupUI(terrainGenerator, scene);

startAnimationLoop(() => {
    updateMovement(terrainGenerator);
    if (state.cameraPosition) {
        camera.position.copy(state.cameraPosition);
    }
    if (state.cameraRotation) {
        camera.rotation.set(state.cameraRotation.x || 0, state.cameraRotation.y || 0, 0);
    }
});
