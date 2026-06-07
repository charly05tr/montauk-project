import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { setHelpTextVisible } from '../ui/Overlay/index.js';
import { soundManager } from './SoundManager.js';

export class Player {
    constructor(scene, physicsWorld) {
        this.scene = scene;
        this.physicsWorld = physicsWorld;

        // Configuraciones de proporciones humanas (Escala 1:1 en metros)
        this.radius = 0.3;
        this.eyeHeight = 1.50; // Altura de los ojos desde el suelo
        this.movementSpeed = 4.5; // Velocidad estándar (más controlada y realista)
        this.allowLateral = true; // Permite moverse con A y D

        // 1. CÁMARA (Mundo Visual)
        // Aumentamos el FOV de 60 a 80 para un lente más angular que dé mayor percepción de espacio y amplitud
        this.camera = new THREE.PerspectiveCamera(80, window.innerWidth / window.innerHeight, 0.02, 420);
        if (this.scene) {
            this.scene.add(this.camera);
        }

        // 1.1 OYENTE DE AUDIO (Mundo Auditivo)
        this.listener = new THREE.AudioListener();
        this.camera.add(this.listener);
        soundManager.setListener(this.listener);

        // 1.2 LINTERNA (Mundo Visual)
        // Aumentamos el ángulo (Math.PI / 3) para hacerla más amplia/redonda
        // y el penumbra (0.8) para suavizar los bordes. Distancia aumentada a 45.0.
        this.flashlight = new THREE.SpotLight(0xffffff, 0.0, 20.0, Math.PI / 5, 0.8, 1.0);
        this.flashlight.position.set(0, 0, 0); // Atada a la cámara
        this.flashlight.target.position.set(0, 0, -1);
        this.camera.add(this.flashlight);
        this.camera.add(this.flashlight.target);
        this.flashlightEnabled = false;
        // 2. CUERPO FÍSICO (Mundo Físico)
        this.body = new CANNON.Body({
            mass: 75,
            shape: new CANNON.Sphere(this.radius),
            position: new CANNON.Vec3(0, 2.0, 0), // Spawn inicial de seguridad
            fixedRotation: true,
            linearDamping: 0.0,
            allowSleep: false
        });

        const physicsMaterial = new CANNON.Material('playerMaterial');
        this.body.material = physicsMaterial;
        physicsWorld.world.addBody(this.body);

        const playerContactMat = new CANNON.ContactMaterial(
            physicsWorld.world.defaultMaterial,
            physicsMaterial,
            { friction: 0.0, restitution: 0.0 }
        );
        physicsWorld.world.addContactMaterial(playerContactMat);

        // 3. CONTROLES DE VISIÓN (Mouse)
        this.controls = new PointerLockControls(this.camera, document.body);
        this.controls.pointerSpeed = 0.70; // Suaviza la sensibilidad del ratón (antes era 1.0)
        this.speed = 4.5; // Velocidad de caminata más controlada y realista (m/s)

        document.body.addEventListener('click', () => {
            soundManager.resumeContext();
            if (!this.controls.isLocked) {
                this.controls.lock();
            }
        });

        this.controls.addEventListener('lock', () => setHelpTextVisible(false));
        this.controls.addEventListener('unlock', () => setHelpTextVisible(true));

        // 4. MOVIMIENTO Y ACCIONES (Teclado)
        this.keys = { w: false, a: false, s: false, d: false, e: false };
        this.movementBounds = null;
        this.movementProfile = null;

        window.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            if (this.keys.hasOwnProperty(key)) this.keys[key] = true;
            
            // Toggle Linterna
            if (key === 'f') {
                this.flashlightEnabled = !this.flashlightEnabled;
                // Intensidad incrementada a 8.0 para que sea más brillante
                this.flashlight.intensity = this.flashlightEnabled ? 10.0 : 0.0;
                
                // Reproducir clic de teclado
                soundManager.playKeyboardSlice('/sounds/keyboard.mp3', 0.8);
            }
        });
        window.addEventListener('keyup', (e) => {
            const key = e.key.toLowerCase();
            if (this.keys.hasOwnProperty(key)) this.keys[key] = false;
        });

        // 5. RESIZE DE LA CÁMARA
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
        });
    }

    setPosition(x, y, z, lookAt = null) {
        // Reiniciamos las físicas en el punto de spawn
        this.body.position.set(x, y, z);
        this.body.velocity.set(0, 0, 0);

        // Sincronización inicial perfecta de la cámara
        const eyeLevel = y - this.radius + this.eyeHeight;
        this.camera.position.set(x, eyeLevel, z);
        if (lookAt) {
            this.camera.lookAt(lookAt.x, lookAt.y ?? eyeLevel, lookAt.z);
        } else {
            this.camera.lookAt(x, eyeLevel, z - 1);
        }
    }

    setMovementBounds(bounds = null) {
        this.movementBounds = bounds;
    }

    setMovementProfile(profile = null) {
        this.movementProfile = profile;
    }

    applyMovementProfile() {
        if (!this.movementProfile || this.movementProfile.mode !== 'linearTunnel') return false;

        const {
            axis,
            forwardSign = 1,
            lateralLock,
            lookAhead = 8,
            eyeYOffset = 0
        } = this.movementProfile;

        const directionInput = Number(this.keys.s) - Number(this.keys.w);
        const speed = 6.0;
        const velocity = directionInput * speed * forwardSign;

        if (axis === 'x') {
            this.body.velocity.x = velocity;
            this.body.velocity.z *= 0.12;
            if (typeof lateralLock === 'number') {
                this.body.position.z = lateralLock;
                this.body.velocity.z = 0;
            }
        } else {
            this.body.velocity.z = velocity;
            this.body.velocity.x *= 0.12;
            if (typeof lateralLock === 'number') {
                this.body.position.x = lateralLock;
                this.body.velocity.x = 0;
            }
        }

        if (directionInput === 0) {
            if (axis === 'x') {
                this.body.velocity.x *= 0.65;
            } else {
                this.body.velocity.z *= 0.65;
            }
        }

        const eyeLevel = this.body.position.y - this.radius + this.eyeHeight + eyeYOffset;
        const targetX = axis === 'x'
            ? this.body.position.x + forwardSign * lookAhead
            : this.body.position.x;
        const targetZ = axis === 'z'
            ? this.body.position.z + forwardSign * lookAhead
            : this.body.position.z;

        this.camera.lookAt(targetX, eyeLevel, targetZ);
        return true;
    }

    enforceMovementBounds() {
        if (!this.movementBounds) return;

        const {
            minX, maxX, minY, maxY, minZ, maxZ, safePosition
        } = this.movementBounds;

        const x = this.body.position.x;
        const y = this.body.position.y;
        const z = this.body.position.z;

        const escaped =
            y < minY - 1.5 ||
            x < minX - 1.0 || x > maxX + 1.0 ||
            z < minZ - 1.0 || z > maxZ + 1.0;

        if (escaped && safePosition) {
            this.body.position.set(safePosition.x, safePosition.y, safePosition.z);
            this.body.velocity.set(0, 0, 0);
        }

        this.body.position.x = Math.min(Math.max(this.body.position.x, minX), maxX);
        this.body.position.y = Math.min(Math.max(this.body.position.y, minY), maxY);
        this.body.position.z = Math.min(Math.max(this.body.position.z, minZ), maxZ);

        if (this.body.velocity.y < 0 && this.body.position.y <= minY + 0.001) {
            this.body.velocity.y = 0;
        }
    }

    update() {
        this.enforceMovementBounds();

        // Forzar rotación fija y vertical para evitar inclinaciones o volteretas físicas (ponerse de cabeza)
        this.body.quaternion.set(0, 0, 0, 1);
        this.body.angularVelocity.set(0, 0, 0);

        // 1. SINCRONIZACIÓN VISUAL (Ejes X y Z atados sin input lag)
        this.camera.position.x = this.body.position.x;
        this.camera.position.z = this.body.position.z;

        // 2. INTERPOLACIÓN VERTICAL (Suaviza escalones y caídas)
        const eyeLevel = this.body.position.y - this.radius + this.eyeHeight;
        this.camera.position.y = THREE.MathUtils.lerp(
            this.camera.position.y,
            eyeLevel,
            0.15
        );

        if (this.applyMovementProfile()) {
            if (this.body.velocity.y < -25.0) {
                this.body.velocity.y = -25.0;
            }
            return;
        }

        if (!this.controls.isLocked) return;

        // 3. VECTORES DE DIRECCIÓN (WASD)
        const x = this.allowLateral ? (Number(this.keys.d) - Number(this.keys.a)) : 0;
        const z = Number(this.keys.s) - Number(this.keys.w);

        const moveDir = new THREE.Vector3(x, 0, z);
        if (moveDir.lengthSq() > 0) moveDir.normalize();

        // 4. ALINEACIÓN DE CÁMARA
        const euler = new THREE.Euler(0, 0, 0, 'YXZ');
        euler.setFromQuaternion(this.camera.quaternion);
        moveDir.applyEuler(new THREE.Euler(0, euler.y, 0));

        const speed = this.movementSpeed; // Usar propiedad de instancia (velocidad controlada de 4.5 m/s)

        // 5. APLICAR VELOCIDAD Y FRICCIÓN (Dejando el eje Y libre para la gravedad)
        if (moveDir.lengthSq() > 0) {
            this.body.velocity.x = moveDir.x * speed;
            this.body.velocity.z = moveDir.z * speed;
        } else {
            this.body.velocity.x *= 0.8;
            this.body.velocity.z *= 0.8;
        }

        // 6. LÍMITE DE VELOCIDAD TERMINAL (Evita caídas que rompan el mapa)
        if (this.body.velocity.y < -25.0) {
            this.body.velocity.y = -25.0;
        }
    }
}