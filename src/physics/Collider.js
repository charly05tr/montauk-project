import * as CANNON from 'cannon-es';

export function createStaticBox(physicsWorld, width, height, depth, position) {
    // En Cannon.js, las cajas se definen por sus "half-extents" (la mitad de su tamaño)
    const shape = new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, depth / 2));
    
    const body = new CANNON.Body({
        mass: 0, // Masa 0 significa que es estático (pared/piso), inamovible
        shape: shape,
        position: new CANNON.Vec3(position.x, position.y, position.z)
    });
    
    physicsWorld.world.addBody(body);
    return body;
}