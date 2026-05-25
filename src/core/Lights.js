import * as THREE from 'three'

let cameraLight

export function initGlobalLights(scene) {
  // Linterna personal del jugador: SpotLight(color, intensidad, distancia, ángulo, penumbra, decay)
  // Color más frío y realista, con penumbra suave en los bordes y decaimiento físico realista
  cameraLight = new THREE.SpotLight(0xcce8ff, 0.02, 1.5, Math.PI / 5, 0.8, 2.0)
  scene.add(cameraLight)
  scene.add(cameraLight.target) // El objetivo del foco también debe estar en la escena
}

export function updateGlobalLights(camera) {
  if (cameraLight && camera) {
    // 1. Mover la linterna a la posición de la cámara
    cameraLight.position.copy(camera.position)
    
    // 2. Apuntar el objetivo de la linterna hacia donde mira la cámara
    const direction = new THREE.Vector3()
    camera.getWorldDirection(direction)
    cameraLight.target.position.copy(camera.position).add(direction)
  }
}
