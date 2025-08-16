
import './style.css';
import { initRenderer, startAnimationLoop } from './renderer';
import { initCamera } from './camera';
import { setupControls } from './controls';
import { setupUI } from './ui';
import { TerrainGenerator } from './terrain';
import { updateMovement } from './player';

const { renderer, scene } = initRenderer();
const camera = initCamera();
const terrainGenerator = new TerrainGenerator();
const terrain = terrainGenerator.generateTerrain();
terrain.name = 'terrain';
scene.add(terrain);

setupControls(renderer.domElement);
setupUI(terrainGenerator, scene);

startAnimationLoop(terrainGenerator);
