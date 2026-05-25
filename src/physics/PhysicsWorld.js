import * as CANNON from 'cannon-es';

export class PhysicsWorld {
    constructor() {
        this.world = new CANNON.World();

        // 1. Gravedad Realista (Tierra)
        // Ya no necesitamos -20.0 ahora que el mundo está en escala 1:1.
        this.world.gravity.set(0, -9.81, 0);

        // --- OPTIMIZACIONES CRÍTICAS DE RENDIMIENTO ---

        // 2. Algoritmo de Fase Amplia (Broadphase)
        // Por defecto Cannon usa NaiveBroadphase (comprueba todos los objetos contra todos, O(n^2)).
        // SAPBroadphase (Sweep And Prune) es inmensamente más rápido en escenarios estáticos.
        this.world.broadphase = new CANNON.SAPBroadphase(this.world);

        // 3. Gestión de CPU (Sleep)
        // Permite que el motor deje de calcular físicas para objetos que ya no se mueven.
        this.world.allowSleep = true;

        // --- MATERIALES ---

        const defaultMaterial = new CANNON.Material('default');

        const defaultContactMaterial = new CANNON.ContactMaterial(
            defaultMaterial, defaultMaterial,
            {
                // FIX: Fricción en 0.0. 
                // Como el jugador frena manualmente (velocity *= 0.8 en Player.js), 
                // no queremos que el motor físico lo pegue a las paredes si choca de lado.
                friction: 0.0,
                restitution: 0.0 // Sin rebote
            }
        );

        this.world.addContactMaterial(defaultContactMaterial);
        this.world.defaultMaterial = defaultMaterial;
    }

    step(deltaTime) {
        // Parámetros: FixedTimeStep, deltaTime real, MaxSubSteps
        this.world.step(1 / 60, deltaTime, 3);
    }
}