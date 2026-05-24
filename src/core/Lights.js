import * as THREE from 'three'

let ambientLight
let cameraLight
let dimFillLight

export function initGlobalLights(scene) {
  ambientLight = new THREE.AmbientLight(0xffb178, 0.45)
  scene.add(ambientLight)

  cameraLight = new THREE.PointLight(0xff7a2b, 0.65, 18, 1.6)
  scene.add(cameraLight)

  dimFillLight = new THREE.HemisphereLight(0x08060d, 0x160703, 0.08)
  scene.add(dimFillLight)
}

export function updateGlobalLights(cameraPosition) {
  if (cameraLight && cameraPosition) {
    cameraLight.position.copy(cameraPosition)
  }
}
