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

// Assets pesados por escena. Se usa para liberar VRAM/RAM de la escena que
// abandonamos (sin tocar los que la escena destino también necesita).
const SCENE_HEAVY_ASSETS = {
    scene1: ['/models/stranger_things_room/scene.gltf'],
    scene2: ['/models/Velez_Paiz.glb', '/models/demogorgon.glb', '/models/root.glb'],
    scene3: ['/models/Tunel/tunelST.glb'],
    scene4: ['/models/Escuela.glb', '/models/root.glb'],
};

class SceneManager {
    constructor() {
        this.currentScene = new THREE.Scene();
        this.atmosphere = new AtmosphereManager();
        this.activeSceneId = 'scene1';
        this.previousSceneId = null;
        this.isTransitioning = false;
        this.isUpsideDownActive = false; // Global state for Upside Down
        this._preloadTimer = null;

        // Precarga predictiva: cuando una escena queda lista, calentamos en segundo
        // plano el cache de la PRÓXIMA escena probable para que su transición sea
        // instantánea (sin espera con pantalla negra). Se retrasa un poco para no
        // competir con la carga/fundido de la escena que acaba de entrar.
        eventBus.on('sceneReady', () => {
            if (this._preloadTimer) clearTimeout(this._preloadTimer);
            this._preloadTimer = setTimeout(() => this.preloadNextScene(), 1200);
        });
    }

    /**
     * Devuelve las URLs de assets de la próxima escena probable según el flujo del
     * juego (sala -> túnel -> hospital -> túnel -> escuela). El túnel es el "hub":
     * su destino depende de la escena de la que venías.
     * @returns {string[]|null}
     */
    getPredictedNextAssets() {
        switch (this.activeSceneId) {
            case 'scene1': return SCENE_HEAVY_ASSETS.scene3; // sala -> túnel
            case 'scene2': return SCENE_HEAVY_ASSETS.scene3; // hospital -> túnel
            case 'scene3': // túnel -> destino según de dónde se venía
                return this.previousSceneId === 'scene2'
                    ? SCENE_HEAVY_ASSETS.scene4   // venías del hospital -> escuela
                    : SCENE_HEAVY_ASSETS.scene2;  // venías de la sala -> hospital
            default: return null;
        }
    }

    /**
     * Calienta el cache (en segundo plano) con los assets de la próxima escena.
     * No usa loadingManager para no afectar la barra de carga, y usa clone:false
     * para solo poblar el cache sin clonar (el clon real se hace al entrar).
     */
    preloadNextScene() {
        const urls = this.getPredictedNextAssets();
        if (!urls) return;
        for (const url of urls) {
            assetCache.loadGLTF(url, undefined, { clone: false })
                .then(() => console.log(`[SceneManager] Precargado (próxima escena): ${url}`))
                .catch((e) => console.warn(`[SceneManager] Falló precarga de ${url}`, e));
        }
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
            loadScene4(this.currentScene, physicsWorld, player, this);
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
            updateScene4(time, player, dt);
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

        // Liberar VRAM/RAM de los assets pesados de la escena anterior que la
        // nueva escena NO necesita. Los hijos ya se quitaron del grafo, así que
        // ningún clon sigue usando estos buffers de GPU.
        const prevAssets = SCENE_HEAVY_ASSETS[this.previousSceneId] || [];
        const keepAssets = new Set(SCENE_HEAVY_ASSETS[this.activeSceneId] || []);
        for (const url of prevAssets) {
            if (!keepAssets.has(url)) {
                const freed = assetCache.unload(url);
                if (freed) console.log(`[SceneManager] VRAM liberada: ${url}`);
            }
        }

        if (this.activeSceneId === 'scene1') {
            loadScene1(this.currentScene, physicsWorld, player, this);
        } else if (this.activeSceneId === 'scene2') {
            loadScene2(this.currentScene, physicsWorld, player, this);
        } else if (this.activeSceneId === 'scene3') {
            loadScene3(this.currentScene, physicsWorld, player, this);
        } else if (this.activeSceneId === 'scene4') {
            loadScene4(this.currentScene, physicsWorld, player, this);
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
     * Precarga SOLO los assets de la escena inicial (Scene1).
     *
     * Antes se precargaban las 4 escenas de golpe (~242MB de GLB sin comprimir),
     * lo que disparaba la memoria y provocaba la pérdida de contexto WebGL (crash)
     * en móvil al entrar al hospital. Ahora cada escena carga sus assets bajo
     * demanda durante su transición (sus funciones de carga ya usan assetCache),
     * y SceneManager libera los de la escena anterior al cambiar (ver switchScene).
     *
     * @param {THREE.LoadingManager} loadingManager - Manejador de carga de la UI.
     * @returns {Promise<void>}
     */
    async preloadInitialAssets(loadingManager) {
        console.log(`[SceneManager] Precargando assets de la escena inicial...`);
        await assetCache.loadGLTF('/models/stranger_things_room/scene.gltf', loadingManager);
        console.log(`[SceneManager] Precarga inicial completada.`);
    }
}

// Exportamos una instancia global (Singleton)
export const sceneManager = new SceneManager();
