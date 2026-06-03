import * as THREE from 'three'

export let cameraLight

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
  // 2. Ajustamos la intensidad a 15.0 y el ángulo a Math.PI / 5 (36 grados)
  // Esto crea un cono de linterna mucho más realista y enfocado, evitando que se desborde
  // y queme las paredes que tenemos justo al lado.
  cameraLight = new THREE.SpotLight(0xccf0ff, 15.0, 20.0, Math.PI / 5, 1.0, 2.0)

  scene.add(cameraLight)
  scene.add(cameraLight.target) // El objetivo del foco también debe estar en la escena
}

export function updateGlobalLights(camera) {
  if (cameraLight && camera) {
    // 1. Obtener la dirección hacia donde mira la cámara
    const direction = new THREE.Vector3()
    camera.getWorldDirection(direction)

    // 2. EL FIX DEFINITIVO DE CERCANÍA: Colocamos la luz exactamente en la posición de la cámara (0.0).
    // Como el cuerpo del jugador tiene un radio de colisión de 0.3m, la linterna nunca
    // atravesará las paredes, y al no estar posicionada detrás de la cámara,
    // evita iluminar de forma extrema los muros laterales inmediatos al jugador.
    cameraLight.position.copy(camera.position)

    // 3. Proyectamos el target a 5 metros frente a la cámara para estabilizar el cono
    cameraLight.target.position.copy(camera.position).add(direction.multiplyScalar(5))
  }
}