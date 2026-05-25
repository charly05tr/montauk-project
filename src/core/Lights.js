import * as THREE from 'three'

let cameraLight

export function initGlobalLights(scene) {
  // UNIFICACIÓN DE DIFUMINADO: Transición Cinemática y Suave

  // 1. Color y Potencia: Mantenemos el blanco azulado gélido y limpio (0xccf0ff) 
  // y la intensidad de 40.0 para conservar la visibilidad y el frío del mundo a escala 1:1.

  // 2. FIX DE DIFUMINADO (Penumbra): Subimos de 0.5 a 1.0.
  // La penumbra controla la suavidad del borde del foco. Al ponerla en 1.0 (valor máximo),
  // logramos que no haya un círculo definido y duro (como en la primera imagen),
  // sino una transición suave y difusa que se mezcla con el ambiente,
  // clavando la estética de la segunda imagen de referencia.

  // 3. FIX DE ÁNGULO: Para que no se vea el "círculo" en la pared, hacemos el cono mucho más ancho.
  // Math.PI / 2.5 (72 grados) asegura que los bordes queden fuera de la vista central.
  cameraLight = new THREE.SpotLight(0xccf0ff, 30.0, 25.0, Math.PI / 2.5, 1.0, 2.0)

  scene.add(cameraLight)
  scene.add(cameraLight.target) // El objetivo del foco también debe estar en la escena
}

export function updateGlobalLights(camera) {
  if (cameraLight && camera) {
    // 1. Obtener la dirección hacia donde mira la cámara
    const direction = new THREE.Vector3()
    camera.getWorldDirection(direction)

    // 2. EL FIX DEFINITIVO DE CERCANÍA: Mover la luz 0.5 metros DETRÁS de la cámara.
    // Lo ponemos a 0.5 (en vez de 0.8) para evitar que la luz atraviese la pared si te pegas de espaldas.
    cameraLight.position.copy(camera.position).addScaledVector(direction, -0.5)

    // 3. Proyectamos el target a 5 metros frente a la cámara para estabilizar el cono
    cameraLight.target.position.copy(camera.position).add(direction.multiplyScalar(5))
  }
}