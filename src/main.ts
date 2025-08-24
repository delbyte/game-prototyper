
import './style.css';
import { initRenderer, startAnimationLoop } from './renderer';
import { initCamera } from './camera';
import { setupControls } from './controls';
import { setupUI } from './ui';
import { TerrainGenerator } from './terrain';
import { updateMovement } from './player';
import { state } from './state';
import { AssetManager } from './asset-manager';
import { AssetBrowserClient } from './asset-browser-client';
import { sampleTerrainParameters } from './sample-terrain-parameters';

const { renderer, scene } = initRenderer(sampleTerrainParameters.skybox, sampleTerrainParameters.lighting);
const camera = initCamera();
const terrainGenerator = new TerrainGenerator(sampleTerrainParameters);
const terrain = terrainGenerator.generateTerrain();
terrain.name = 'terrain';
scene.add(terrain);

// Asset manager + UI
const assetManager = new AssetManager(scene, terrainGenerator);
// Use the existing camera returned earlier
new AssetBrowserClient(assetManager, camera, renderer.domElement, document.body);

setupControls(renderer.domElement);
setupUI(terrainGenerator, scene);

// Start the animation loop and provide the TerrainGenerator instance
startAnimationLoop(terrainGenerator, assetManager);
