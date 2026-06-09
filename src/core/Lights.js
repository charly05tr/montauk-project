import * as THREE from 'three'

export let cameraLight

export function initGlobalLights(scene) {

  cameraLight = new THREE.SpotLight(0xccf0ff, 15.0, 12.0, Math.PI / 5, 1.0, 2.0)

  scene.add(cameraLight)
  scene.add(cameraLight.target)
}

export function updateGlobalLights(camera) {
  if (cameraLight && camera) {
    const direction = new THREE.Vector3()
    camera.getWorldDirection(direction)

    cameraLight.position.copy(camera.position).addScaledVector(direction, -1.2)

    cameraLight.target.position.copy(camera.position).add(direction.multiplyScalar(5))
  }
}