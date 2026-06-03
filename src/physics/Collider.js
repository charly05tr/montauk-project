import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// ------------------------------------------------------------------------
// VARIABLES TEMPORALES GLOBALES (Optimización de Memoria)
// Evitan la instanciación masiva de objetos al recorrer modelos con muchos nodos
// ------------------------------------------------------------------------
const _position = new THREE.Vector3();
const _quaternion = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _size = new THREE.Vector3();
const _localCenter = new THREE.Vector3();

/**
 * Crea una caja estática manual en el mundo físico (Ideal para suelos y paredes invisibles).
 */
export function createStaticBox(physicsWorld, width, height, depth, position) {
    // Cannon.js utiliza half-extents (la mitad de las dimensiones totales)
    const shape = new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, depth / 2));

    const body = new CANNON.Body({
        mass: 0, // Inamovible
        shape: shape,
        position: new CANNON.Vec3(position.x, position.y, position.z)
    });

    physicsWorld.world.addBody(body);
    return body;
}

/**
 * Genera automáticamente un colisionador estático exacto a partir de una malla 3D.
 * Respeta la escala y rotación (quaternions) globales del objeto.
 */
export function createBoxFromMesh(physicsWorld, mesh) {
    // 1. Asegurarnos de que existe el Bounding Box local sin clonarlo innecesariamente
    if (!mesh.geometry.boundingBox) {
        mesh.geometry.computeBoundingBox();
    }
    const box3 = mesh.geometry.boundingBox;

    // 2. Extraer los transformadores globales directamente a nuestros vectores cacheados
    mesh.matrixWorld.decompose(_position, _quaternion, _scale);

    // 3. Calcular tamaño real basado en la escala global
    box3.getSize(_size);
    _size.multiply(_scale);

    // 4. Calcular el centro exacto del Bounding Box en el espacio global
    box3.getCenter(_localCenter);
    _localCenter.multiply(_scale);
    _localCenter.applyQuaternion(_quaternion);
    _localCenter.add(_position);

    // 5. Protección contra cajas planas (Tunneling Prevention)
    // En escala 1:1 (Metros), forzamos un grosor mínimo de 2cm (0.02)
    const minThickness = 0.02;
    const halfX = Math.max(_size.x, minThickness) / 2;
    const halfY = Math.max(_size.y, minThickness) / 2;
    const halfZ = Math.max(_size.z, minThickness) / 2;

    // 6. Crear el cuerpo físico
    const shape = new CANNON.Box(new CANNON.Vec3(halfX, halfY, halfZ));
    const body = new CANNON.Body({
        mass: 0,
        shape: shape,
        position: new CANNON.Vec3(_localCenter.x, _localCenter.y, _localCenter.z),
        quaternion: new CANNON.Quaternion(_quaternion.x, _quaternion.y, _quaternion.z, _quaternion.w)
    });

    physicsWorld.world.addBody(body);
    return body;
}

/**
 * Genera un colisionador exacto a nivel de polígono (Trimesh).
 * Ideal para paredes con formas irregulares (forma de L) donde una caja bloquearía el espacio vacío.
 */
export function createTrimeshFromMesh(physicsWorld, mesh) {
    const geometry = mesh.geometry;
    if (!geometry || !geometry.attributes.position) return;

    // Extraer transformadores globales
    mesh.matrixWorld.decompose(_position, _quaternion, _scale);

    // Escalar vértices
    const vertices = Array.from(geometry.attributes.position.array);
    for (let i = 0; i < vertices.length; i += 3) {
        vertices[i] *= _scale.x;
        vertices[i + 1] *= _scale.y;
        vertices[i + 2] *= _scale.z;
    }

    // Extraer índices
    let indices = [];
    if (geometry.index) {
        indices = Array.from(geometry.index.array);
    } else {
        for (let i = 0; i < vertices.length / 3; i++) {
            indices.push(i);
        }
    }

    const trimesh = new CANNON.Trimesh(vertices, indices);
    const body = new CANNON.Body({
        mass: 0,
        shape: trimesh,
        position: new CANNON.Vec3(_position.x, _position.y, _position.z),
        quaternion: new CANNON.Quaternion(_quaternion.x, _quaternion.y, _quaternion.z, _quaternion.w)
    });

    physicsWorld.world.addBody(body);
    return body;
}