import * as THREE from 'three';
import { loadRoom, updateScene1 } from '../scenes/Scene1/index.js';
import { loadRoomScene2, updateScene2 } from '../scenes/Scene2/index.js';
import { loadTunnelScene, updateScene3 } from '../scenes/Scene3/index.js';
import { AtmosphereManager } from './AtmosphereManager.js';
import { cameraLight } from './Lights.js';
import { setHelpText } from '../ui/Overlay/index.js';
import { soundManager } from './SoundManager.js';

class SceneManager {
    constructor() {
        this.currentScene = new THREE.Scene();
        this.atmosphere = new AtmosphereManager();
        this.activeSceneId = 'scene1'; // Iniciamos en la Escena 1 por defecto
    }

    initScene(physicsWorld, player) {
        this.currentScene.background = null;
        this.currentScene.fog = null;
        player.setMovementBounds?.(null);
        player.setMovementProfile?.(null);

        // Cargar habitación según la escena activa
        if (this.activeSceneId === 'scene1') {
            loadRoom(this.currentScene, physicsWorld, player);
        } else {
            if (this.activeSceneId === 'scene2') {
                loadRoomScene2(this.currentScene, physicsWorld, player);
            } else {
                loadTunnelScene(this.currentScene, physicsWorld, player);
            }
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
        } else {
            loadTunnelScene(this.currentScene, physicsWorld, player);
        }

        // 4. Volver a inyectar la atmósfera
        this.atmosphere.injectIntoScene(this.currentScene);
    }
}

// Exportamos una instancia global (Singleton)
export const sceneManager = new SceneManager();
