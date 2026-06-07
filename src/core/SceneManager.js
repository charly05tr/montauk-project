import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { loadRoom, updateScene1 } from '../scenes/Scene1/index.js';
import { loadRoomScene2, updateScene2 } from '../scenes/Scene2/index.js';
import { loadTunnelScene, updateScene3 } from '../scenes/Scene3/index.js';
import { loadSchoolScene, updateScene4 } from '../scenes/Scene4/index.js';
import { AtmosphereManager } from './AtmosphereManager.js';
import { cameraLight } from './Lights.js';
import { setHelpText, fadeToBlack, fadeInFromBlack } from '../ui/Overlay/index.js';
import { soundManager } from './SoundManager.js';
import { eventBus } from '../utils/eventBus.js';

class SceneManager {
    constructor() {
        this.currentScene = new THREE.Scene();
        this.atmosphere = new AtmosphereManager();
        this.activeSceneId = 'scene1'; // Iniciamos en la Escena 1 por defecto
        this.isTransitioning = false;
    }

    initScene(physicsWorld, player) {
        this.currentScene.background = null;
        this.currentScene.fog = null;
        player.setMovementBounds?.(null);
        player.setMovementProfile?.(null);

        // Cargar habitación según la escena activa
        if (this.activeSceneId === 'scene1') {
            loadRoom(this.currentScene, physicsWorld, player);
        } else if (this.activeSceneId === 'scene2') {
            loadRoomScene2(this.currentScene, physicsWorld, player);
        } else if (this.activeSceneId === 'scene3') {
            loadTunnelScene(this.currentScene, physicsWorld, player);
        } else if (this.activeSceneId === 'scene4') {
            loadSchoolScene(this.currentScene, physicsWorld, player);
        }
        
        // Inyectar la atmósfera en la escena actual
        this.atmosphere.injectIntoScene(this.currentScene);
        
        return this.currentScene;
    }

    getScene() {
        return this.currentScene;
    }

    updateCurrentScene(time, player, dt) {
        if (this.activeSceneId === 'scene1') {
            updateScene1(time, player, dt);
        } else if (this.activeSceneId === 'scene2') {
            updateScene2(time, player, dt);
        } else if (this.activeSceneId === 'scene3') {
            updateScene3(time, player, dt);
        } else if (this.activeSceneId === 'scene4') {
            updateScene4(time);
        }
        }
    }

    switchScene(sceneId, physicsWorld, player) {
        if (sceneId === this.activeSceneId) return;

        setHelpText('Cargando nueva escena...');
        this.activeSceneId = sceneId;
        player.setMovementBounds?.(null);
        player.setMovementProfile?.(null);

        // Detener todos los audios de la escena anterior
        soundManager.stopAllAmbient();
        soundManager.stopAllPositional();

        // 1. Limpiar objetos de la escena de Three.js
        // Mantenemos la cámara del jugador, la luz del jugador y su target
        const children = [...this.currentScene.children];
        for (const child of children) {
            if (
                child !== player.camera && 
                child !== cameraLight && 
                child !== (cameraLight ? cameraLight.target : null)
            ) {
                this.currentScene.remove(child);
            }
        }

        this.currentScene.background = null;
        this.currentScene.fog = null;

        // 2. Limpiar cuerpos del mundo físico (Cannon.js)
        // Mantenemos el cuerpo físico del jugador
        const bodies = [...physicsWorld.world.bodies];
        for (const body of bodies) {
            if (body !== player.body) {
                physicsWorld.world.removeBody(body);
            }
        }

        // 3. Cargar la nueva escena
        if (this.activeSceneId === 'scene1') {
            loadRoom(this.currentScene, physicsWorld, player);
        } else if (this.activeSceneId === 'scene2') {
            loadRoomScene2(this.currentScene, physicsWorld, player);
        } else if (this.activeSceneId === 'scene3') {
            loadTunnelScene(this.currentScene, physicsWorld, player);
        } else if (this.activeSceneId === 'scene4') {
            loadSchoolScene(this.currentScene, physicsWorld, player);
        }

        // 4. Volver a inyectar la atmósfera
        this.atmosphere.injectIntoScene(this.currentScene);
    }

    async switchSceneWithTransition(sceneId, physicsWorld, player) {
        if (sceneId === this.activeSceneId) return;
        if (this.isTransitioning) return;
        this.isTransitioning = true;

        // 1. Desbloquear el mouse / controles del jugador y detener movimiento
        if (player.controls && player.controls.isLocked) {
            player.controls.unlock();
        }
        player.body.velocity.set(0, 0, 0);
        player.body.angularVelocity.set(0, 0, 0);
        
        // Ponemos el cuerpo físico como KINEMATIC para que no sea afectado por la gravedad
        // y se quede flotando/estático durante la pantalla en negro (evita caídas al vacío)
        player.body.type = CANNON.Body.KINEMATIC;

        // 2. Fundido a negro suave
        await fadeToBlack(1200);

        // 3. Crear promesa para esperar a que la nueva escena se cargue (gltfLoader complete)
        const sceneLoadPromise = new Promise((resolve) => {
            const onSceneReady = (e) => {
                if (e.detail.sceneId === sceneId) {
                    eventBus.off('sceneReady', onSceneReady);
                    resolve();
                }
            };
            eventBus.on('sceneReady', onSceneReady);
        });

        // 4. Disparar el cambio de escena real (destruye lo viejo e inicia la carga GLTF de lo nuevo)
        this.switchScene(sceneId, physicsWorld, player);

        // 5. Esperar a que la escena esté completamente lista
        await sceneLoadPromise;

        // 6. Volver a activar la física dinámica del jugador
        player.body.type = CANNON.Body.DYNAMIC;
        player.body.velocity.set(0, 0, 0);
        player.body.angularVelocity.set(0, 0, 0);

        // 7. Esperar un instante corto de seguridad y fundir a la imagen de la nueva escena
        await new Promise((resolve) => setTimeout(resolve, 200));
        await fadeInFromBlack(1200);

        this.isTransitioning = false;
    }
}

// Exportamos una instancia global (Singleton)
export const sceneManager = new SceneManager();
