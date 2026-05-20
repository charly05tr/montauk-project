import * as CANNON from 'cannon-es';

export class PhysicsWorld {
    constructor() {
        this.world = new CANNON.World();
        this.world.gravity.set(0, -9.81, 0); // Gravedad realista hacia abajo (eje Y)
        
        // Materiales de contacto: qué pasa cuando el jugador toca el suelo/paredes
        const defaultMaterial = new CANNON.Material('default');
        const defaultContactMaterial = new CANNON.ContactMaterial(
            defaultMaterial, defaultMaterial,
            { friction: 0.1, restitution: 0.0 } // Baja fricción para no quedarse pegado a las paredes
        );
        this.world.addContactMaterial(defaultContactMaterial);
        this.world.defaultMaterial = defaultMaterial;
    }

    // Se llama en cada frame para actualizar las matemáticas
    step(deltaTime) {
        this.world.step(1 / 60, deltaTime, 3);
    }
}