import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';

// DRACOLoader compartido para decodificar los modelos comprimidos con Draco
// (hospital y raíces). El decoder vive en /public/draco/ (servido en /draco/).
let _dracoLoader = null;
function getDracoLoader() {
    if (!_dracoLoader) {
        _dracoLoader = new DRACOLoader();
        _dracoLoader.setDecoderPath('/draco/');
    }
    return _dracoLoader;
}

class AssetCache {
    constructor() {
        this.cache = new Map();
        this.loadingPromises = new Map();
    }

    /** Crea un GLTFLoader con soporte Draco habilitado. */
    createLoader(loadingManager) {
        const loader = loadingManager ? new GLTFLoader(loadingManager) : new GLTFLoader();
        loader.setDRACOLoader(getDracoLoader());
        return loader;
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
     * @param {Object} [options]
     * @param {boolean} [options.clone=true] Si es false, devuelve el GLTF original (sin clonar).
     *   Útil para modelos con esqueleto/animación de los que solo hay UNA instancia
     *   (p.ej. el Demogorgon): SkeletonUtils.clone puede romper el skinning de ciertos
     *   rigs y dejar la malla invisible. Al no clonar se evita ese problema.
     * @returns {Promise<Object>} Un objeto GLTF ({ scene, animations, ... }).
     */
    async loadGLTF(url, loadingManager = undefined, options = {}) {
        const { clone = true } = options;
        const prepare = (gltf) => (clone ? this.cloneGLTF(gltf) : gltf);

        if (this.cache.has(url)) {
            return prepare(this.cache.get(url));
        }

        if (this.loadingPromises.has(url)) {
            return this.loadingPromises.get(url).then(prepare);
        }

        const promise = new Promise((resolve, reject) => {
            const loader = this.createLoader(loadingManager);
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
        return promise.then(prepare);
    }

    /**
     * Libera de la GPU (VRAM) y del cache un modelo que ya no se usa.
     *
     * Como los clones de cada escena (cloneSkeleton) comparten geometrías,
     * materiales y texturas con el GLTF original cacheado, disponer el original
     * libera los buffers de GPU que esos clones estaban usando. Por eso SOLO debe
     * llamarse cuando ya no queda ningún clon montado en la escena (p.ej. al salir
     * de una escena). El asset se vuelve a cargar desde disco si hace falta luego.
     *
     * @param {string} url La ruta del modelo a descargar.
     * @returns {boolean} true si había algo en cache que liberar.
     */
    unload(url) {
        const gltf = this.cache.get(url);
        if (!gltf) return false;

        if (gltf.scene) {
            gltf.scene.traverse((child) => {
                if (!child.isMesh && !child.isSkinnedMesh) return;
                child.geometry?.dispose();
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                for (const material of materials) this.disposeMaterial(material);
            });
        }

        this.cache.delete(url);
        return true;
    }

    /**
     * Dispone un material y todas las texturas que referencia.
     * @param {THREE.Material} material
     */
    disposeMaterial(material) {
        if (!material) return;
        for (const key in material) {
            const value = material[key];
            if (value && value.isTexture) value.dispose();
        }
        material.dispose();
    }
}

export const assetCache = new AssetCache();
