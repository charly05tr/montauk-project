import * as THREE from 'three';
import { loadRoom, updateScene1 } from '../scenes/Scene1/index.js';
import { loadRoomScene2, updateScene2 } from '../scenes/Scene2/index.js';
import { AtmosphereManager } from './AtmosphereManager.js';
import { cameraLight } from './Lights.js';
import { setHelpText } from '../ui/Overlay/index.js';

class SceneManager {
    constructor() {
        this.currentScene = new THREE.Scene();
        this.atmosphere = new AtmosphereManager();
        this.activeSceneId = 'scene1'; // Iniciamos en la Escena 1 por defecto
    }

    initScene(physicsWorld, player) {
        // Cargar habitación según la escena activa
        if (this.activeSceneId === 'scene1') {
            loadRoom(this.currentScene, physicsWorld, player);
        } else {
            loadRoomScene2(this.currentScene, physicsWorld, player);
        }
        
        // Inyectar la atmósfera en la escena actual
        this.atmosphere.injectIntoScene(this.currentScene);
        
        return this.currentScene;
    }

    getScene() {
        return this.currentScene;
    }

    updateCurrentScene(time) {
        if (this.activeSceneId === 'scene1') {
            updateScene1(time);
        } else if (this.activeSceneId === 'scene2') {
            updateScene2(time);
        }
    }

    switchScene(sceneId, physicsWorld, player) {
        if (sceneId === this.activeSceneId) return;

        setHelpText('Cargando nueva escena...');
        this.activeSceneId = sceneId;

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
        } else {
            loadRoomScene2(this.currentScene, physicsWorld, player);
        }

        // 4. Volver a inyectar la atmósfera
        this.atmosphere.injectIntoScene(this.currentScene);
    }
}

// Exportamos una instancia global (Singleton)
export const sceneManager = new SceneManager();
