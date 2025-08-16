
import { state } from './state';
import { updateCameraRotation } from './camera';

export function setupControls(rendererDomElement: HTMLElement) {
    // Keyboard events
    document.addEventListener('keydown', (event) => {
        state.keys[event.code] = true;
        if (event.code === 'Space') {
            state.jump = true;
        }
    });

    document.addEventListener('keyup', (event) => {
        state.keys[event.code] = false;
    });

    // Mouse events
    document.addEventListener('click', () => {
        if (!state.isPointerLocked) {
            rendererDomElement.requestPointerLock();
        }
    });

    document.addEventListener('pointerlockchange', () => {
        state.isPointerLocked = document.pointerLockElement === rendererDomElement;
    });

    document.addEventListener('mousemove', (event) => {
        if (state.isPointerLocked) {
            state.mouse.x = event.movementX || 0;
            state.mouse.y = event.movementY || 0;
            updateCameraRotation();
        }
    });
}
