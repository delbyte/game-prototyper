
import './style.css';
import { initRenderer, startAnimationLoop } from './renderer';
import { initCamera } from './camera';
import { setupControls } from './controls';
import { setupUI } from './ui';
import { TerrainGenerator } from './terrain';
import { updateMovement } from './player';

import { sampleTerrainParameters } from './sample-terrain-parameters';

const { renderer, scene } = initRenderer(sampleTerrainParameters.skybox, sampleTerrainParameters.lighting);
const camera = initCamera();
const terrainGenerator = new TerrainGenerator(sampleTerrainParameters);
const terrain = terrainGenerator.generateTerrain();
terrain.name = 'terrain';
scene.add(terrain);

setupControls(renderer.domElement);
setupUI(terrainGenerator, scene);

startAnimationLoop(terrainGenerator);
