import * as THREE from 'three';

export class AtmosphereManager {
    constructor() {

        this.skyColor = 0x5a7ba3;
        this.groundColor = 0x3a4b66;
        this.fogColor = 0x050a12;

        this.hemisphereLight = new THREE.HemisphereLight(this.skyColor, this.groundColor, 3);
        this.hemisphereLight.name = "GlobalAtmosphereLight";

        this.fog = new THREE.FogExp2(this.fogColor, 0.05);
    }

    injectIntoScene(scene) {
        if (!scene.fog) {
            scene.fog = this.fog;
        }

        if (!scene.background) {
            scene.background = new THREE.Color(this.fogColor);
        }

        const existingLight = scene.getObjectByName("GlobalAtmosphereLight");
        if (!existingLight) {
            scene.add(this.hemisphereLight);
        }
    }
}
