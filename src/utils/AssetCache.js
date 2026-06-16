import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';

class AssetCache {
    constructor() {
        this.cache = new Map();
        this.loadingPromises = new Map();
    }

    cloneGLTF(gltf) {
        if (!gltf?.scene) {
            return gltf;
        }

        return {
            ...gltf,
            // Cada carga recibe una escena independiente para evitar que
            // transformaciones, materiales o visibilidades se acumulen
            // sobre el original cacheado entre transiciones.
            scene: cloneSkeleton(gltf.scene),
        };
    }

    /**
     * Carga un modelo GLTF usando la URL. 
     * Si ya se cargó o está cargándose, devuelve el mismo resultado.
     * @param {string} url La ruta del modelo GLTF.
     * @param {THREE.LoadingManager} loadingManager Opcional, LoadingManager para trackear el progreso la primera vez.
     * @returns {Promise<Object>} Un objeto { scene } clonado del GLTF original.
     */
    async loadGLTF(url, loadingManager = undefined) {
        if (this.cache.has(url)) {
            return this.cloneGLTF(this.cache.get(url));
        }

        if (this.loadingPromises.has(url)) {
            return this.loadingPromises.get(url).then((gltf) => this.cloneGLTF(gltf));
        }

        const promise = new Promise((resolve, reject) => {
            const loader = loadingManager ? new GLTFLoader(loadingManager) : new GLTFLoader();
            loader.load(
                url,
                (gltf) => {
                    this.cache.set(url, gltf);
                    this.loadingPromises.delete(url);
                    resolve(gltf);
                },
                undefined,
                (error) => {
                    console.error(`[AssetCache] Error cargando modelo: ${url}`, error);
                    this.loadingPromises.delete(url);
                    reject(error);
                }
            );
        });

        this.loadingPromises.set(url, promise);
        return promise.then((gltf) => this.cloneGLTF(gltf));
    }
}

export const assetCache = new AssetCache();
