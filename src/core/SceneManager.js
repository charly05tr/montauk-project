import * as THREE from 'three';
import { loadRoom, updateScene1 } from '../scenes/Scene1/index.js';
import { AtmosphereManager } from './AtmosphereManager.js';

class SceneManager {
    constructor() {
        this.currentScene = new THREE.Scene();
        this.atmosphere = new AtmosphereManager();
    }

    initScene(physicsWorld, player) {
        // Cargar habitación
        loadRoom(this.currentScene, physicsWorld, player);
        
        // Inyectar la atmósfera en la escena actual
        this.atmosphere.injectIntoScene(this.currentScene);
        
        return this.currentScene;
    }

    getScene() {
        return this.currentScene;
    }

    updateCurrentScene(time) {
        // Lógica para actualizar la escena actual, si aplica.
        updateScene1(time);
    }
}

// Exportamos una instancia global (Singleton)
export const sceneManager = new SceneManager();

