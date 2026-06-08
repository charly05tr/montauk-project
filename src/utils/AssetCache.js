import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

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
    async loadGLTF(url, loadingManager = null) {
        if (this.cache.has(url)) {
            // Ya está en memoria. Clonamos instantáneamente usando SkeletonUtils para soportar animaciones (si hubiese)
            // y para asegurar que cada instancia de la escena tenga su propia jerarquía de nodos.
            const originalGLTF = this.cache.get(url);
            const clonedScene = SkeletonUtils.clone(originalGLTF.scene);
            return { scene: clonedScene };
        }

        // Si no está en memoria, usamos una Promesa para envolver el GLTFLoader
        return new Promise((resolve, reject) => {
            const loader = new GLTFLoader(loadingManager);
            loader.load(
                url,
                (gltf) => {
                    // Guardamos el objeto gltf original en caché
                    this.cache.set(url, gltf);
                    
                    // Devolvemos un clon para que la escena original nunca sea mutada por error
                    const clonedScene = SkeletonUtils.clone(gltf.scene);
                    resolve({ scene: clonedScene });
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
