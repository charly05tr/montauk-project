import * as THREE from 'three';

export class AtmosphereManager {
    constructor() {
        // Paleta base: tonos fríos y siniestros
        this.skyColor = 0x6a81a4; // Azul grisáceo medio
        this.groundColor = 0x3a4453; // Gris oscuro
        this.fogColor = 0x080c14; // Gris oscuro azulado

        // Luces globales para dar una penumbra visible y que no sea negro total
        this.hemisphereLight = new THREE.HemisphereLight(this.skyColor, this.groundColor, 2.5);
        this.hemisphereLight.name = "GlobalAtmosphereLight";

        // Niebla volumétrica simulada
        this.fog = new THREE.FogExp2(this.fogColor, 0.08);
    }

    /**
     * Inyecta la atmósfera (luces globales y niebla) en la escena proporcionada.
     * @param {THREE.Scene} scene - La escena activa donde se inyectará la atmósfera.
     */
    injectIntoScene(scene) {
        // 1. Aplicar la niebla global
        scene.fog = this.fog;
        
        // El fondo lo igualamos al color de la niebla para ocultar la caja del cielo
        scene.background = new THREE.Color(this.fogColor);

        // 2. Comprobar si la luz ya está inyectada para no duplicar recursos
        const existingLight = scene.getObjectByName("GlobalAtmosphereLight");
        if (!existingLight) {
            scene.add(this.hemisphereLight);
        }
    }
}
