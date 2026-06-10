import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { loadRoom as loadScene1, updateScene1 } from '../scenes/Scene1/index.js';
import { loadRoomScene2 as loadScene2, updateScene2 } from '../scenes/Scene2/index.js';
import { loadTunnelScene as loadScene3, updateScene3 } from '../scenes/Scene3/index.js';
import { loadSchoolScene as loadScene4, updateScene4 } from '../scenes/Scene4/index.js';
import { AtmosphereManager } from './AtmosphereManager.js';
import { cameraLight } from './Lights.js';
import { setHelpText, fadeToBlack, fadeInFromBlack } from '../ui/Overlay/index.js';
import { soundManager } from './SoundManager.js';
import { eventBus } from '../utils/eventBus.js';
import { getRenderer } from './Renderer.js';
import { assetCache } from '../utils/AssetCache.js';

class SceneManager {
    constructor() {
        this.currentScene = new THREE.Scene();
        this.atmosphere = new AtmosphereManager();
        this.activeSceneId = 'scene1';
        this.previousSceneId = null;
        this.isTransitioning = false;
    }

    initScene(physicsWorld, player) {
        this.currentScene.background = null;
        this.currentScene.fog = null;
        player.setMovementBounds?.(null);
        player.setMovementProfile?.(null);

        if (this.activeSceneId === 'scene1') {
            loadScene1(this.currentScene, physicsWorld, player, this);
        } else if (this.activeSceneId === 'scene2') {
            loadScene2(this.currentScene, physicsWorld, player, this);
        } else if (this.activeSceneId === 'scene3') {
            loadScene3(this.currentScene, physicsWorld, player, this);
        } else if (this.activeSceneId === 'scene4') {
            loadScene4(this.currentScene, physicsWorld, player);
        }

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

    switchScene(sceneId, physicsWorld, player) {
        if (sceneId === this.activeSceneId) return;

        setHelpText('Loading new scene...');
        this.previousSceneId = this.activeSceneId;
        this.activeSceneId = sceneId;
        player.setMovementBounds?.(null);
        player.setMovementProfile?.(null);
        player.movementSpeed = 8.0;
        player.allowLateral = true;

        soundManager.stopAllAmbient();
        soundManager.stopAllPositional();

        const childrenToRemove = [];
        for (const child of this.currentScene.children) {
            if (
                child !== player.camera &&
                child !== cameraLight &&
                child !== (cameraLight ? cameraLight.target : null)
            ) {
                childrenToRemove.push(child);
            }
        }

        childrenToRemove.forEach(child => {
            this.currentScene.remove(child);
        });

        this.currentScene.background = null;
        this.currentScene.fog = null;

        const bodies = [...physicsWorld.world.bodies];
        for (const body of bodies) {
            if (body !== player.body) {
                physicsWorld.world.removeBody(body);
            }
        }

        if (this.activeSceneId === 'scene1') {
            loadScene1(this.currentScene, physicsWorld, player, this);
        } else if (this.activeSceneId === 'scene2') {
            loadScene2(this.currentScene, physicsWorld, player, this);
        } else if (this.activeSceneId === 'scene3') {
            loadScene3(this.currentScene, physicsWorld, player, this);
        } else if (this.activeSceneId === 'scene4') {
            loadScene4(this.currentScene, physicsWorld, player);
        }

        this.atmosphere.injectIntoScene(this.currentScene);
    }


    async switchSceneWithTransition(sceneId, physicsWorld, player) {
        if (sceneId === this.activeSceneId) return;
        if (this.isTransitioning) return;
        this.isTransitioning = true;

        if (player.controls) {
            player.controls.enabled = false;
        }
        player.body.velocity.set(0, 0, 0);
        player.body.angularVelocity.set(0, 0, 0);

        player.body.type = CANNON.Body.KINEMATIC;

        await fadeToBlack(1200);

        const sceneLoadPromise = new Promise((resolve) => {
            const onSceneReady = (e) => {
                if (e.detail.sceneId === sceneId) {
                    eventBus.off('sceneReady', onSceneReady);
                    resolve();
                }
            };
            eventBus.on('sceneReady', onSceneReady);
        });

        this.switchScene(sceneId, physicsWorld, player);

        await sceneLoadPromise;

        const renderer = getRenderer();
        if (renderer) {
            renderer.compile(this.currentScene, player.camera);
        }

        player.body.type = CANNON.Body.DYNAMIC;
        player.body.velocity.set(0, 0, 0);
        player.body.angularVelocity.set(0, 0, 0);
        await new Promise((resolve) => setTimeout(resolve, 200));
        await fadeInFromBlack(1200);

        if (player.controls) {
            player.controls.enabled = true;
        }

        this.isTransitioning = false;
    }

    /**
     * Precarga TODOS los assets pesados de todas las escenas al inicio,
     * usando el loadingManager para que la barra de carga refleje el progreso total.
     * @param {THREE.LoadingManager} loadingManager - Manejador de carga de la UI.
     * @returns {Promise<void>}
     */
    async preloadAllAssets(loadingManager) {
        const preloadTasks = [];

        console.log(`[SceneManager] Iniciando precarga masiva de assets...`);

        // Scene 1
        preloadTasks.push(assetCache.loadGLTF('/models/stranger_things_room/scene.gltf', loadingManager));
        
        // Scene 2
        preloadTasks.push(assetCache.loadGLTF('/models/Velez_Paiz.glb', loadingManager));
        preloadTasks.push(assetCache.loadGLTF('/models/demogorgon.glb', loadingManager));

        // Scene 3
        preloadTasks.push(assetCache.loadGLTF('/models/Tunel/tunelST.glb', loadingManager));
        preloadTasks.push(new Promise((resolve) => {
            const loader = new THREE.TextureLoader(loadingManager);
            loader.load('/models/Tunel/texture/text_tunel.jpeg', resolve, undefined, resolve);
        }));

        // Scene 4
        preloadTasks.push(assetCache.loadGLTF('/models/Escuela.glb', loadingManager));

        await Promise.all(preloadTasks);
        console.log(`[SceneManager] Precarga masiva completada.`);
    }
}

// Exportamos una instancia global (Singleton)
export const sceneManager = new SceneManager();
