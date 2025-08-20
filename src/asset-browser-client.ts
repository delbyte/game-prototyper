import * as THREE from 'three';
import { AssetManager } from './asset-manager';
import type { AssetMetadata } from './asset-manager';
import { searchSketchfab } from './api';
import type { Asset } from './types';

export class AssetBrowserClient {
    private assetManager: AssetManager;
    private camera: THREE.Camera;
    private domElement: HTMLElement;
    private container: HTMLElement;
    private panel?: HTMLElement;
    private selectedMetadata?: AssetMetadata;
    private selectedPlacedId?: string;
    private raycaster = new THREE.Raycaster();
    private dragging = false;
    private dragPlacedId?: string;
    private dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    private pointerDownPos: { x: number; y: number } | null = null;
    private dragMoved = false;

    constructor(assetManager: AssetManager, camera: THREE.Camera, domElement: HTMLElement, container: HTMLElement = document.body) {
        this.assetManager = assetManager;
        this.camera = camera;
        this.domElement = domElement;
        this.container = container;

        this.createButton();
        this.setupSelectionListener();
    }

    private createButton() {
        const btn = document.createElement('button');
        btn.textContent = 'Assets';
        btn.style.position = 'fixed';
        btn.style.left = '10px';
        btn.style.top = '10px';
        btn.style.zIndex = '1000';
        btn.style.padding = '8px 12px';
        btn.style.background = '#007acc';
        btn.style.color = 'white';
        btn.style.border = 'none';
        btn.style.borderRadius = '4px';
        btn.style.cursor = 'pointer';
        btn.addEventListener('click', () => this.togglePanel());
        this.container.appendChild(btn);
    }

    private togglePanel() {
        if (this.panel && this.panel.parentElement) {
            this.panel.remove();
            this.panel = undefined;
            return;
        }
        this.createPanel();
    }

    private createPanel() {
        this.panel = document.createElement('div');
        this.panel.style.position = 'fixed';
        this.panel.style.right = '20px';
        this.panel.style.top = '20px';
        this.panel.style.width = '360px';
        this.panel.style.maxHeight = '70vh';
        this.panel.style.overflow = 'auto';
        this.panel.style.background = 'rgba(0,0,0,0.85)';
        this.panel.style.color = 'white';
        this.panel.style.zIndex = '1000';
        this.panel.style.padding = '12px';
        this.panel.style.borderRadius = '6px';
        this.panel.style.boxShadow = '0 6px 18px rgba(0,0,0,0.6)';

        const title = document.createElement('h3');
        title.textContent = 'Asset Browser';
        title.style.marginTop = '0';
        this.panel.appendChild(title);

        const searchRow = document.createElement('div');
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Search assets...';
        input.style.width = '70%';
        input.style.padding = '6px';
        input.style.marginRight = '6px';
        const searchBtn = document.createElement('button');
        searchBtn.textContent = 'Search';
        searchBtn.style.padding = '6px 8px';
        searchBtn.addEventListener('click', () => this.search(input.value.trim()));
        searchRow.appendChild(input);
        searchRow.appendChild(searchBtn);
        this.panel.appendChild(searchRow);

        const results = document.createElement('div');
        results.id = 'asset-browser-results';
        results.style.marginTop = '10px';
        this.panel.appendChild(results);

        const close = document.createElement('button');
        close.textContent = 'Close';
        close.style.marginTop = '10px';
        close.addEventListener('click', () => this.togglePanel());
        this.panel.appendChild(close);

        this.container.appendChild(this.panel);

        // Load default (all) results
        this.search('');
    }

    private async search(query: string) {
        const resultsDiv = this.panel?.querySelector('#asset-browser-results') as HTMLElement;
        if (!resultsDiv) return;
        resultsDiv.innerHTML = 'Searching...';

        try {
            const results = await searchSketchfab(query);

            resultsDiv.innerHTML = '';
            if (results.length === 0) {
                resultsDiv.textContent = 'No results';
                return;
            }

            for (const r of results) {
                const item = document.createElement('div');
                item.style.display = 'flex';
                item.style.gap = '8px';
                item.style.marginBottom = '8px';
                item.style.alignItems = 'center';

                const thumb = document.createElement('img');
                thumb.src = r.thumbnailUrl || '';
                thumb.style.width = '64px';
                thumb.style.height = '64px';
                thumb.style.objectFit = 'cover';
                thumb.style.background = '#222';
                thumb.alt = r.name || 'asset';

                const meta = document.createElement('div');
                meta.style.flex = '1';
                const name = document.createElement('div');
                name.textContent = r.name || 'Unnamed';
                name.style.fontWeight = 'bold';
                const desc = document.createElement('div');
                desc.textContent = r.description || '';
                desc.style.fontSize = '12px';
                desc.style.opacity = '0.9';
                meta.appendChild(name);
                meta.appendChild(desc);

                const actions = document.createElement('div');
                const downloadBtn = document.createElement('button');
                downloadBtn.textContent = 'Fetch & Place';
                downloadBtn.style.padding = '6px 8px';
                downloadBtn.addEventListener('click', () => this.fetchAndPlace(r));
                actions.appendChild(downloadBtn);

                item.appendChild(thumb);
                item.appendChild(meta);
                item.appendChild(actions);

                resultsDiv.appendChild(item);
            }
        } catch (err) {
            resultsDiv.textContent = 'Search failed';
            console.error('Asset search failed', err);
        }
    }

    private async fetchAndPlace(record: Asset) {
        const resultsDiv = this.panel?.querySelector('#asset-browser-results') as HTMLElement;
        if (resultsDiv) resultsDiv.textContent = 'Downloading model...';

        try {
            // Build metadata object for AssetManager.
            // The asset manager will now handle fetching the download URL internally.
            const metadata: AssetMetadata = {
                id: record.id, // Use the original Sketchfab UID
                name: record.name || record.id,
                description: record.description || '',
                source: 'sketchfab',
                url: record.url, // The persistent viewer URL
                thumbnailUrl: record.thumbnailUrl,
                tags: record.tags || []
            };

            // Preload model to calculate bounding box / size
            resultsDiv.textContent = 'Loading model into scene (preview)...';
            await this.assetManager.loadAsset(metadata);

            // Enter placement mode
            resultsDiv.textContent = 'Click on terrain to place the model or press ESC to cancel';
            this.selectedMetadata = metadata;
            this.domElement.style.cursor = 'crosshair';

            const onClick = (ev: MouseEvent) => this.onCanvasClick(ev, onClick, onEsc);
            const onEsc = (ev: KeyboardEvent) => {
                if (ev.key === 'Escape') {
                    this.cancelPlacement(onClick, onEsc);
                }
            };

            this.domElement.addEventListener('click', onClick);
            window.addEventListener('keydown', onEsc);
        } catch (err) {
            console.error('Fetch & place failed', err);
            if (resultsDiv) resultsDiv.textContent = 'Failed to download or load model';
        }
    }

    // Selection: allow clicking existing placed meshes to edit them
    private setupSelectionListener() {
        // Pointer down starts selection or drag
        this.domElement.addEventListener('pointerdown', (ev) => {
            // Ignore when in placement mode
            if (this.selectedMetadata) return;

            const rect = (this.domElement as HTMLCanvasElement).getBoundingClientRect();
            const x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
            const y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
            const mouse = new THREE.Vector2(x, y);
            this.raycaster.setFromCamera(mouse, this.camera);

            const intersects = this.raycaster.intersectObjects(this.assetManager['scene'].children, true);
            if (intersects.length === 0) return;
            const first = intersects[0];
            // Ask AssetManager to find placed asset for this object
            const placed = this.assetManager.findPlacedAssetByObject(first.object);
            if (!placed) return;

            // Start dragging if left button
            if (ev.button === 0) {
                this.dragging = true;
                this.dragPlacedId = placed.id;
                this.dragMoved = false;
                this.pointerDownPos = { x: ev.clientX, y: ev.clientY };
                // compute drag plane at placed object's current Y
                this.dragPlane.set(new THREE.Vector3(0, 1, 0), -placed.position.y);
                // capture pointer events
                (this.domElement as HTMLElement).setPointerCapture((ev as any).pointerId);
            }

            this.showTransformEditor(placed);
        });

        // Pointer move -> when dragging, update position by intersecting with drag plane
        this.domElement.addEventListener('pointermove', (ev) => {
            if (!this.dragging || !this.dragPlacedId) return;
            const rect = (this.domElement as HTMLCanvasElement).getBoundingClientRect();
            const x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
            const y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
            const mouse = new THREE.Vector2(x, y);
            this.raycaster.setFromCamera(mouse, this.camera);

            const origin = this.raycaster.ray.origin;
            const dir = this.raycaster.ray.direction;
            const target = new THREE.Vector3();
            const hit = this.dragPlane.intersectLine(new THREE.Line3(origin, origin.clone().add(dir.clone().multiplyScalar(10000))), target);
            if (hit) {
                // update placed asset X/Z (and Y stays aligned to ground/base)
                const placed = this.assetManager.getPlacedAssets().find(p => p.id === this.dragPlacedId);
                if (!placed) return;
                // Set new x,z and keep y as provided (treated as desired base Y)
                const newPos = new THREE.Vector3(target.x, placed.position.y, target.z);
                this.assetManager.updatePlacedAssetTransforms(placed.id, { position: newPos });
                this.dragMoved = true;
            }
        });

        // Pointer up ends drag
        this.domElement.addEventListener('pointerup', (ev) => {
            if (this.dragging) {
                this.dragging = false;
                if ((this.domElement as HTMLElement).hasPointerCapture((ev as any).pointerId)) {
                    try { (this.domElement as HTMLElement).releasePointerCapture((ev as any).pointerId); } catch(e) {}
                }
                // clear drag state
                this.dragPlacedId = undefined;
                this.pointerDownPos = null;
                this.dragMoved = false;
            }
        });
    }

    private showTransformEditor(placed: any) {
        this.selectedPlacedId = placed.id;
        // Create simple floating panel
        let panel = document.getElementById('asset-transform-panel') as HTMLElement | null;
        if (panel) panel.remove();

        panel = document.createElement('div');
        panel.id = 'asset-transform-panel';
        panel.style.position = 'fixed';
        panel.style.left = '10px';
        panel.style.bottom = '10px';
        panel.style.background = 'rgba(0,0,0,0.85)';
        panel.style.color = 'white';
        panel.style.padding = '10px';
        panel.style.zIndex = '1000';
        panel.style.borderRadius = '6px';

        const title = document.createElement('div');
        title.textContent = `Edit: ${placed.metadata.name}`;
        title.style.fontWeight = 'bold';
        title.style.marginBottom = '6px';
        panel.appendChild(title);

        const pos = placed.position;
        const rot = placed.rotation;
        const scl = placed.scale;

        // Helper to create labeled slider
        const makeSlider = (labelText: string, min: number, max: number, step: number, value: number, onChange: (v: number) => void) => {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.flexDirection = 'column';
            row.style.gap = '4px';
            row.style.marginBottom = '8px';

            const labRow = document.createElement('div');
            labRow.style.display = 'flex';
            labRow.style.justifyContent = 'space-between';
            const lab = document.createElement('div');
            lab.textContent = labelText;
            const valLabel = document.createElement('div');
            valLabel.textContent = value.toFixed(2);
            valLabel.style.opacity = '0.9';
            labRow.appendChild(lab);
            labRow.appendChild(valLabel);

            const input = document.createElement('input');
            input.type = 'range';
            input.min = String(min);
            input.max = String(max);
            input.step = String(step);
            input.value = String(value);
            input.addEventListener('input', () => {
                const v = parseFloat(input.value);
                valLabel.textContent = v.toFixed(2);
                onChange(v);
            });

            row.appendChild(labRow);
            row.appendChild(input);
            panel!.appendChild(row);
            return { input, valLabel };
        };

        // Position sliders (default range will be adjustable below)
        const posRange = { min: -500, max: 500 };
        makeSlider('pos x', posRange.min, posRange.max, 0.1, pos.x, (v) => this.updatePlaced({ x: v }, 'position'));
        makeSlider('pos y', posRange.min, posRange.max, 0.1, pos.y, (v) => this.updatePlaced({ y: v }, 'position'));
        makeSlider('pos z', posRange.min, posRange.max, 0.1, pos.z, (v) => this.updatePlaced({ z: v }, 'position'));

        // Rotation sliders (degrees, -180..180)
        makeSlider('rot x', -180, 180, 0.5, rot.x * 180 / Math.PI, (v) => this.updatePlaced({ x: v * Math.PI / 180 }, 'rotation'));
        makeSlider('rot y', -180, 180, 0.5, rot.y * 180 / Math.PI, (v) => this.updatePlaced({ y: v * Math.PI / 180 }, 'rotation'));
        makeSlider('rot z', -180, 180, 0.5, rot.z * 180 / Math.PI, (v) => this.updatePlaced({ z: v * Math.PI / 180 }, 'rotation'));

        // Uniform scale slider (single slider controlling all axes)
        const defaultScaleRange = { min: 0.01, max: 10 };
        const uniformScale = (scl.x + scl.y + scl.z) / 3;
        const scaleSlider = makeSlider('scale', defaultScaleRange.min, defaultScaleRange.max, 0.01, uniformScale, (v) => {
            this.updatePlaced({ x: v, y: v, z: v }, 'scale');
        });

        // Allow adjusting slider ranges (small inputs)
        const limitsRow = document.createElement('div');
        limitsRow.style.display = 'flex';
        limitsRow.style.gap = '6px';
        limitsRow.style.marginTop = '6px';
        const limitsLabel = document.createElement('div');
        limitsLabel.textContent = 'Ranges:';
        limitsLabel.style.alignSelf = 'center';
        const rangePosInput = document.createElement('input');
        rangePosInput.type = 'text';
        rangePosInput.placeholder = 'posRange e.g. -500,500';
        rangePosInput.style.flex = '1';
        const rangeScaleInput = document.createElement('input');
        rangeScaleInput.type = 'text';
        rangeScaleInput.placeholder = 'scaleRange e.g. 0.01,10';
        rangeScaleInput.style.flex = '1';
        const applyRangesBtn = document.createElement('button');
        applyRangesBtn.textContent = 'Apply';
        applyRangesBtn.addEventListener('click', () => {
            try {
                const p = rangePosInput.value.split(',').map(s => parseFloat(s.trim()));
                if (p.length === 2 && !isNaN(p[0]) && !isNaN(p[1])) {
                    // update pos sliders
                    const inputs = panel!.querySelectorAll('input[type="range"]');
                    // first 3 are pos, next 3 rotation, then scale -> update first 3 and last
                    (inputs[0] as HTMLInputElement).min = String(p[0]);
                    (inputs[0] as HTMLInputElement).max = String(p[1]);
                    (inputs[1] as HTMLInputElement).min = String(p[0]);
                    (inputs[1] as HTMLInputElement).max = String(p[1]);
                    (inputs[2] as HTMLInputElement).min = String(p[0]);
                    (inputs[2] as HTMLInputElement).max = String(p[1]);
                }
                const s = rangeScaleInput.value.split(',').map(s => parseFloat(s.trim()));
                if (s.length === 2 && !isNaN(s[0]) && !isNaN(s[1])) {
                    const inputs = panel!.querySelectorAll('input[type="range"]');
                    const scaleIndex = inputs.length - 1;
                    (inputs[scaleIndex] as HTMLInputElement).min = String(s[0]);
                    (inputs[scaleIndex] as HTMLInputElement).max = String(s[1]);
                }
            } catch (e) { /* ignore */ }
        });
        limitsRow.appendChild(limitsLabel);
        limitsRow.appendChild(rangePosInput);
        limitsRow.appendChild(rangeScaleInput);
        limitsRow.appendChild(applyRangesBtn);
        panel.appendChild(limitsRow);

        const removeBtn = document.createElement('button');
        removeBtn.textContent = 'Remove';
        removeBtn.style.marginTop = '6px';
        removeBtn.addEventListener('click', () => {
            this.assetManager.removeAsset(placed.id);
            panel?.remove();
        });
        panel.appendChild(removeBtn);

        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        closeBtn.style.marginLeft = '6px';
        closeBtn.addEventListener('click', () => panel?.remove());
        panel.appendChild(closeBtn);

        this.container.appendChild(panel);
    }

    private updatePlaced(vals: { x?: number; y?: number; z?: number }, kind: 'position' | 'rotation' | 'scale') {
        if (!this.selectedPlacedId) return;
        const placed = this.assetManager.getPlacedAssets().find(p => p.id === this.selectedPlacedId);
        if (!placed) return;

        if (kind === 'position') {
            const p = placed.position.clone();
            if (typeof vals.x === 'number') p.x = vals.x;
            if (typeof vals.y === 'number') p.y = vals.y;
            if (typeof vals.z === 'number') p.z = vals.z;
            this.assetManager.updatePlacedAssetTransforms(placed.id, { position: p });
        } else if (kind === 'rotation') {
            const r = placed.rotation.clone();
            if (typeof vals.x === 'number') r.x = vals.x;
            if (typeof vals.y === 'number') r.y = vals.y;
            if (typeof vals.z === 'number') r.z = vals.z;
            this.assetManager.updatePlacedAssetTransforms(placed.id, { rotation: r });
        } else if (kind === 'scale') {
            const s = placed.scale.clone();
            if (typeof vals.x === 'number') s.x = vals.x;
            if (typeof vals.y === 'number') s.y = vals.y;
            if (typeof vals.z === 'number') s.z = vals.z;
            this.assetManager.updatePlacedAssetTransforms(placed.id, { scale: s });
        }
    }

    private cancelPlacement(onClick: (ev: MouseEvent) => void, onEsc: (ev: KeyboardEvent) => void) {
        this.selectedMetadata = undefined;
        this.domElement.style.cursor = 'default';
        this.domElement.removeEventListener('click', onClick);
        window.removeEventListener('keydown', onEsc);
        const resultsDiv = this.panel?.querySelector('#asset-browser-results') as HTMLElement;
        if (resultsDiv) resultsDiv.textContent = 'Placement cancelled';
    }

    private async onCanvasClick(ev: MouseEvent, onClick: (ev: MouseEvent) => void, onEsc: (ev: KeyboardEvent) => void) {
        ev.preventDefault();
        if (!this.selectedMetadata) return;

        const rect = (this.domElement as HTMLCanvasElement).getBoundingClientRect();
        const x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;

        const mouse = new THREE.Vector2(x, y);
        this.raycaster.setFromCamera(mouse, this.camera);

        // Intersect terrain mesh (named 'terrain')
        const intersects = this.raycaster.intersectObjects(this.assetManager['scene'].children, true);
        let point: THREE.Vector3 | null = null;
        for (const i of intersects) {
            if (i.object && i.object.name === 'terrain') {
                point = i.point.clone();
                break;
            }
        }

        // Fallback: use first intersection
        if (!point && intersects.length > 0) {
            point = intersects[0].point.clone();
        }

        // If still no intersection, place near camera
        if (!point) {
            const camPos = (this.camera as THREE.PerspectiveCamera).position;
            point = new THREE.Vector3(camPos.x + 10, camPos.y - 2, camPos.z);
        }

        // Adjust Y to terrain height if terrainGenerator is available on AssetManager
        const tg: any = (this.assetManager as any).terrainGenerator;
        if (tg && typeof tg.getHeightAtPosition === 'function') {
            const h = tg.getHeightAtPosition(point.x, point.z);
            point.y = h;
        }

        try {
            await this.assetManager.placeAsset(this.selectedMetadata, point);
            const resultsDiv = this.panel?.querySelector('#asset-browser-results') as HTMLElement;
            if (resultsDiv) resultsDiv.textContent = 'Placed model';
        } catch (err) {
            console.error('Placement failed', err);
            const resultsDiv = this.panel?.querySelector('#asset-browser-results') as HTMLElement;
            if (resultsDiv) resultsDiv.textContent = 'Failed to place model';
        }

        // Cleanup listeners
        this.domElement.style.cursor = 'default';
        this.domElement.removeEventListener('click', onClick);
        window.removeEventListener('keydown', onEsc);
        this.selectedMetadata = undefined;
    }
}
