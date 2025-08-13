class TerrainApp {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.terrain = null;
        this.terrainGenerator = null;
        
        // Control state
        this.keys = {};
        this.mouse = { x: 0, y: 0, prevX: 0, prevY: 0 };
        this.isPointerLocked = false;
        this.controlMode = 'camera'; // 'camera' or 'player'
        
        // Camera/Player properties
        this.cameraPosition = new THREE.Vector3(0, 50, 50);
        this.cameraRotation = new THREE.Euler(0, 0, 0);
        this.moveSpeed = 0.5;
        this.mouseSensitivity = 0.002;
        this.playerHeight = 2;
        this.gravity = -0.8;
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.isGrounded = false;
        
        this.init();
        this.setupControls();
        this.animate();
    }

    init() {
        // Create scene
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(0x87CEEB, 50, 300);

        // Create camera
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.copy(this.cameraPosition);

        // Create renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x87CEEB);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.getElementById('container').appendChild(this.renderer.domElement);

        // Create lighting
        this.setupLighting();

        // Create skybox
        this.createSkybox();

        // Generate terrain
        this.terrainGenerator = new TerrainGenerator();
        this.terrain = this.terrainGenerator.generateTerrain();
        this.scene.add(this.terrain);

        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize());
        
        // Setup UI
        this.setupUI();
    }

    setupLighting() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        this.scene.add(ambientLight);

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
        this.scene.add(directionalLight);
    }

    createSkybox() {
        const skyGeometry = new THREE.SphereGeometry(500, 32, 32);
        
        // Create gradient texture for sky
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const context = canvas.getContext('2d');
        
        // Create gradient
        const gradient = context.createLinearGradient(0, 0, 0, 256);
        gradient.addColorStop(0, '#87CEEB'); // Sky blue
        gradient.addColorStop(0.7, '#98D8E8'); // Lighter blue
        gradient.addColorStop(1, '#F0F8FF'); // Almost white
        
        context.fillStyle = gradient;
        context.fillRect(0, 0, 256, 256);
        
        const texture = new THREE.CanvasTexture(canvas);
        
        const skyMaterial = new THREE.MeshBasicMaterial({
            map: texture,
            side: THREE.BackSide
        });
        
        const skybox = new THREE.Mesh(skyGeometry, skyMaterial);
        this.scene.add(skybox);
    }

    setupControls() {
        // Keyboard events
        document.addEventListener('keydown', (event) => {
            this.keys[event.code] = true;
        });

        document.addEventListener('keyup', (event) => {
            this.keys[event.code] = false;
        });

        // Mouse events
        document.addEventListener('click', () => {
            if (!this.isPointerLocked) {
                this.renderer.domElement.requestPointerLock();
            }
        });

        document.addEventListener('pointerlockchange', () => {
            this.isPointerLocked = document.pointerLockElement === this.renderer.domElement;
        });

        document.addEventListener('mousemove', (event) => {
            if (this.isPointerLocked) {
                this.mouse.x = event.movementX || 0;
                this.mouse.y = event.movementY || 0;
                this.updateCameraRotation();
            }
        });
    }

    setupUI() {
        const cameraButton = document.getElementById('cameraMode');
        const playerButton = document.getElementById('playerMode');
        const regenerateButton = document.getElementById('regenerate');

        cameraButton.addEventListener('click', () => {
            this.setControlMode('camera');
            cameraButton.classList.add('active');
            playerButton.classList.remove('active');
        });

        playerButton.addEventListener('click', () => {
            this.setControlMode('player');
            playerButton.classList.add('active');
            cameraButton.classList.remove('active');
        });

        regenerateButton.addEventListener('click', () => {
            this.regenerateTerrain();
        });
    }

    setControlMode(mode) {
        this.controlMode = mode;
        if (mode === 'player') {
            // Reset velocity when switching to player mode
            this.velocity.set(0, 0, 0);
            // Position player above ground
            const groundHeight = this.terrainGenerator.getHeightAtPosition(
                this.cameraPosition.x, 
                this.cameraPosition.z
            );
            this.cameraPosition.y = Math.max(this.cameraPosition.y, groundHeight + this.playerHeight);
        }
    }

    updateCameraRotation() {
        this.cameraRotation.y -= this.mouse.x * this.mouseSensitivity;
        this.cameraRotation.x -= this.mouse.y * this.mouseSensitivity;
        
        // Clamp vertical rotation to prevent over-rotation
        this.cameraRotation.x = Math.max(
            -Math.PI / 2, 
            Math.min(Math.PI / 2, this.cameraRotation.x)
        );
    }

    updateMovement() {
        const moveVector = new THREE.Vector3(0, 0, 0);
        
        // Calculate movement direction based on camera rotation
        const forward = new THREE.Vector3(0, 0, -1);
        const right = new THREE.Vector3(1, 0, 0);
        
        forward.applyQuaternion(
            new THREE.Quaternion().setFromEuler(
                new THREE.Euler(0, this.cameraRotation.y, 0)
            )
        );
        right.crossVectors(forward, new THREE.Vector3(0, 1, 0));

        // WASD movement
        if (this.keys['KeyW']) moveVector.add(forward);
        if (this.keys['KeyS']) moveVector.sub(forward);
        if (this.keys['KeyA']) moveVector.sub(right);
        if (this.keys['KeyD']) moveVector.add(right);

        moveVector.normalize();
        moveVector.multiplyScalar(this.moveSpeed);

        if (this.controlMode === 'camera') {
            // Free camera movement
            if (this.keys['KeyQ']) moveVector.y -= this.moveSpeed;
            if (this.keys['KeyE']) moveVector.y += this.moveSpeed;
            
            this.cameraPosition.add(moveVector);
        } else {
            // Player movement with collision
            this.updatePlayerMovement(moveVector);
        }
    }

    updatePlayerMovement(moveVector) {
        // Apply gravity
        this.velocity.y += this.gravity * 0.016; // Assuming 60fps

        // Apply horizontal movement
        this.velocity.x = moveVector.x;
        this.velocity.z = moveVector.z;

        // Calculate new position
        const newPosition = this.cameraPosition.clone().add(
            this.velocity.clone().multiplyScalar(0.016 * 60)
        );

        // Ground collision
        const groundHeight = this.terrainGenerator.getHeightAtPosition(
            newPosition.x, 
            newPosition.z
        );

        if (newPosition.y <= groundHeight + this.playerHeight) {
            newPosition.y = groundHeight + this.playerHeight;
            this.velocity.y = 0;
            this.isGrounded = true;
        } else {
            this.isGrounded = false;
        }

        this.cameraPosition.copy(newPosition);
    }

    regenerateTerrain() {
        if (this.terrain) {
            this.scene.remove(this.terrain);
            this.terrain.geometry.dispose();
            this.terrain.material.dispose();
        }
        
        this.terrain = this.terrainGenerator.regenerate();
        this.scene.add(this.terrain);
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        // Update movement
        this.updateMovement();

        // Update camera with proper rotation order
        this.camera.position.copy(this.cameraPosition);
        
        // Apply rotations in correct order: Y (yaw) first, then X (pitch)
        this.camera.rotation.set(0, 0, 0); // Reset rotation
        this.camera.rotateY(this.cameraRotation.y); // Yaw around world Y-axis
        this.camera.rotateX(this.cameraRotation.x); // Pitch around local X-axis

        // Render
        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize the application when the page loads
window.addEventListener('load', () => {
    new TerrainApp();
});
