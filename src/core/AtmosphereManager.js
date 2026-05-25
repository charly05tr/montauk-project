import * as THREE from 'three';

export class AtmosphereManager {
    constructor() {
        // Paleta base: Tonos GÉLIDOS (Azules y Cianes oscuros)
        this.skyColor = 0x5a7ba3;    // Azul frío (Luz de luna/TV)
        // FIX DE TECHO OSCURO: En una HemisphereLight, el groundColor es la luz que va "de abajo hacia arriba" (ilumina los techos). Lo aclaramos.
        this.groundColor = 0x3a4b66; // Gris azulado más claro para que el techo no se vea negro
        this.fogColor = 0x050a12;    // Azul casi negro profundo

        // FIX AMBIENTAL: Más luz de relleno
        // Aumentamos a 1.2 a petición tuya para dar un poco más de luz ambiental general.
        this.hemisphereLight = new THREE.HemisphereLight(this.skyColor, this.groundColor, 3);
        this.hemisphereLight.name = "GlobalAtmosphereLight";

        // La niebla se mantiene igual, pero ahora usará el nuevo fogColor azulado
        this.fog = new THREE.FogExp2(this.fogColor, 0.05);
    }

    injectIntoScene(scene) {
        scene.fog = this.fog;
        scene.background = new THREE.Color(this.fogColor);

        const existingLight = scene.getObjectByName("GlobalAtmosphereLight");
        if (!existingLight) {
            scene.add(this.hemisphereLight);
        }
    }
}