import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

class AssetCache {
    constructor() {
        this.cache = new Map();
    }

    /**
     * Carga un modelo GLTF usando la URL. 
     * Si ya se cargó previamente, devuelve un clon inmediato (0.01s).
     * @param {string} url La ruta del modelo GLTF.
     * @param {THREE.LoadingManager} loadingManager Opcional, LoadingManager para trackear el progreso la primera vez.
     * @returns {Promise<Object>} Un objeto { scene } clonado del GLTF original.
     */
    async loadGLTF(url, loadingManager = undefined) {
        if (this.cache.has(url)) {
            // Ya está en memoria. Como solo mostramos una escena a la vez y no hemos destruido sus materiales,
            // podemos devolver el objeto original intacto, ahorrando cualquier problema de clonación de SkinnedMeshes.
            return this.cache.get(url);
        }

        // Si no está en memoria, usamos una Promesa para envolver el GLTFLoader
        return new Promise((resolve, reject) => {
            const loader = loadingManager ? new GLTFLoader(loadingManager) : new GLTFLoader();
            loader.load(
                url,
                (gltf) => {
                    // Guardamos el objeto gltf original en caché
                    this.cache.set(url, gltf);
                    resolve(gltf);
                },
                undefined, // Progreso interno no expuesto en la promesa pura
                (error) => {
                    console.error(`[AssetCache] Error cargando modelo: ${url}`, error);
                    reject(error);
                }
            );
        });
    }
}

export const assetCache = new AssetCache();
