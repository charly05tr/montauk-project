import * as THREE from 'three'

export let cameraLight

export function initGlobalLights(scene) {
  // UNIFICACIÓN DE DIFUMINADO: Transición Cinemática y Suave

  // 1. Color y Potencia: Mantenemos el blanco azulado gélido y limpio (0xccf0ff) 
  // y la intensidad de 15.0 para conservar la visibilidad y el frío del mundo a escala 1:1.

  // 2. FIX DE DIFUMINADO (Penumbra): Subimos de 0.5 a 1.0.
  // La penumbra controla la suavidad del borde del foco. Al ponerla en 1.0 (valor máximo),
  // logramos que no haya un círculo definido y duro,
  // sino una transición suave y difusa que se mezcla con el ambiente.

  // 3. FIX DE ÁNGULO Y DISTANCIA:
  // Ángulo a Math.PI / 5 (36 grados) para un cono realista.
  // AUMENTO DE DISTANCIA: Cambiamos el tercer parámetro de 20.0 a 40.0 metros 
  // para que la linterna ilumine mucha más profundidad en los pasillos largos.
  cameraLight = new THREE.SpotLight(0xccf0ff, 15.0, 12.0, Math.PI / 5, 1.0, 2.0)

  scene.add(cameraLight)
  scene.add(cameraLight.target) // El objetivo del foco también debe estar en la escena
}

export function updateGlobalLights(camera) {
  if (cameraLight && camera) {
    // 1. Obtener la dirección hacia donde mira la cámara
    const direction = new THREE.Vector3()
    camera.getWorldDirection(direction)

    // 2. EL FIX DEFINITIVO DE CERCANÍA: Desplazamos la luz DETRÁS del jugador.
    // Al restar 1.2 metros en la dirección de la cámara, evitamos la singularidad matemática
    // que causa el efecto de sobreexposición (blooming) cuando estás pegado a la pared.
    cameraLight.position.copy(camera.position).addScaledVector(direction, -1.2)

    // 3. Proyectamos el target a 5 metros frente a la cámara para estabilizar el cono
    cameraLight.target.position.copy(camera.position).add(direction.multiplyScalar(5))
  }
}