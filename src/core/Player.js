import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { soundManager } from './SoundManager.js';
import { isMobile } from '../utils/deviceDetection.js';

export class Player {
    constructor(scene, physicsWorld) {
        this.scene = scene;
        this.physicsWorld = physicsWorld;

        this.radius = 0.3;
        this.eyeHeight = 1.50; // Altura de los ojos desde el suelo
        this.movementSpeed = 8.0; // Velocidad estándar (8.0 m/s)
        this.allowLateral = true; // Permite moverse con A y D

        this.camera = new THREE.PerspectiveCamera(80, window.innerWidth / window.innerHeight, 0.02, 420);
        if (this.scene) {
            this.scene.add(this.camera);
        }

        this.listener = new THREE.AudioListener();
        this.camera.add(this.listener);
        soundManager.setListener(this.listener);

        this.flashlight = new THREE.SpotLight(0xffffff, 0.0, 20.0, Math.PI / 5, 0.8, 1.0);
        this.flashlight.position.set(0, 0, 0);
        this.flashlight.target.position.set(0, 0, -1);
        this.camera.add(this.flashlight);
        this.camera.add(this.flashlight.target);
        this.flashlightEnabled = false;

        this.body = new CANNON.Body({
            mass: 75,
            shape: new CANNON.Sphere(this.radius),
            position: new CANNON.Vec3(0, 2.0, 0),
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

        this.controls = new PointerLockControls(this.camera, document.body);
        this.controls.pointerSpeed = 0.70;
        this.speed = 8.0;

        const isMobileDevice = isMobile();
        if (!isMobileDevice) {
            document.body.addEventListener('click', () => {
                soundManager.resumeContext();
                if (!this.controls.isLocked) {
                    this.controls.lock();
                }
            });
        } else {
            // En móvil, reanudar contexto de audio al tocar la pantalla por primera vez
            document.body.addEventListener('touchstart', () => {
                soundManager.resumeContext();
            }, { once: true, passive: false });
        }

        this.keys = { w: false, a: false, s: false, d: false, e: false };
        this.movementBounds = null;
        this.movementProfile = null;

        window.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            if (this.keys.hasOwnProperty(key)) this.keys[key] = true;

            if (key === 'f') {
                this.flashlightEnabled = !this.flashlightEnabled;
                this.flashlight.intensity = this.flashlightEnabled ? 10.0 : 0.0;

                soundManager.playKeyboardSlice('/sounds/keyboard.mp3', 0.8);
            }
        });
        window.addEventListener('keyup', (e) => {
            const key = e.key.toLowerCase();
            if (this.keys.hasOwnProperty(key)) this.keys[key] = false;
        });

        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
        });
    }

    setPosition(x, y, z, lookAt = null) {
        this.body.position.set(x, y, z);
        this.body.velocity.set(0, 0, 0);

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

        this.body.quaternion.set(0, 0, 0, 1);
        this.body.angularVelocity.set(0, 0, 0);

        this.camera.position.x = this.body.position.x;
        this.camera.position.z = this.body.position.z;

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

        if (!isMobile() && !this.controls.isLocked) return;

        const x = this.allowLateral ? (Number(this.keys.d) - Number(this.keys.a)) : 0;
        const z = Number(this.keys.s) - Number(this.keys.w);

        const moveDir = new THREE.Vector3(x, 0, z);
        if (moveDir.lengthSq() > 0) moveDir.normalize();

        const euler = new THREE.Euler(0, 0, 0, 'YXZ');
        euler.setFromQuaternion(this.camera.quaternion);
        moveDir.applyEuler(new THREE.Euler(0, euler.y, 0));

        const speed = this.movementSpeed;

        if (moveDir.lengthSq() > 0) {
            this.body.velocity.x = moveDir.x * speed;
            this.body.velocity.z = moveDir.z * speed;
        } else {
            this.body.velocity.x *= 0.8;
            this.body.velocity.z *= 0.8;
        }

        if (this.body.velocity.y < -25.0) {
            this.body.velocity.y = -25.0;
        }
    }
}