import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { setHelpTextVisible } from '../ui/Overlay/index.js';

export class Player {
    constructor(scene, physicsWorld) {
        this.scene = scene;
        this.physicsWorld = physicsWorld;

        // Configuraciones de proporciones humanas (Escala 1:1 en metros)
        this.radius = 0.3;
        this.eyeHeight = 1.50; // Altura de los ojos desde el suelo

        // 1. CÁMARA (Mundo Visual)
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.02, 180);
        if (this.scene) {
            this.scene.add(this.camera);
        }

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

        document.body.addEventListener('click', () => {
            if (!this.controls.isLocked) {
                this.controls.lock();
            }
        });

        this.controls.addEventListener('lock', () => setHelpTextVisible(false));
        this.controls.addEventListener('unlock', () => setHelpTextVisible(true));

        // 4. MOVIMIENTO (Teclado)
        this.keys = { w: false, a: false, s: false, d: false };

        window.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            if (this.keys.hasOwnProperty(key)) this.keys[key] = true;
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

    setPosition(x, y, z) {
        // Reiniciamos las físicas en el punto de spawn
        this.body.position.set(x, y, z);
        this.body.velocity.set(0, 0, 0);

        // Sincronización inicial perfecta de la cámara
        const eyeLevel = y - this.radius + this.eyeHeight;
        this.camera.position.set(x, eyeLevel, z);
        this.camera.lookAt(x, eyeLevel, z - 1);
    }

    update() {
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

        if (!this.controls.isLocked) return;

        // 3. VECTORES DE DIRECCIÓN (WASD)
        const x = Number(this.keys.d) - Number(this.keys.a);
        const z = Number(this.keys.s) - Number(this.keys.w);

        const moveDir = new THREE.Vector3(x, 0, z);
        if (moveDir.lengthSq() > 0) moveDir.normalize();

        // 4. ALINEACIÓN DE CÁMARA
        const euler = new THREE.Euler(0, 0, 0, 'YXZ');
        euler.setFromQuaternion(this.camera.quaternion);
        moveDir.applyEuler(new THREE.Euler(0, euler.y, 0));

        const speed = 8.0; // Velocidad estándar (m/s)

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