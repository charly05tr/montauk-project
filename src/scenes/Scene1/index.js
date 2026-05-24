import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { loadingManager, setMainSceneReady } from '../../ui/Loading/index.js'
import { setHelpText } from '../../ui/Overlay/index.js'
import { ENABLE_SHADOWS } from '../../utils/constants.js'
import { applySceneCamera } from '../../core/Camera.js'
import { getMaterialName, tuneRoomMaterial, isRoomSurfaceMaterial } from './objects.js'

export const xmasLights = []
let redLight, orangeLight

export function loadRoom(scene) {
  redLight = new THREE.PointLight(0xff2a12, 2.2, 22, 1.7)
  redLight.position.set(-12, 8, 4)
  scene.add(redLight)

  orangeLight = new THREE.PointLight(0xff6a18, 1.7, 20, 1.7)
  orangeLight.position.set(10, 6, -10)
  scene.add(orangeLight)

  const gltfLoader = new GLTFLoader(loadingManager)

  gltfLoader.load(
    '/models/stranger_things_room/scene.gltf',
    (gltf) => {
      const model = gltf.scene
      model.scale.setScalar(0.04)

      model.traverse((child) => {
        if (!child.isMesh) return
        const materialName = getMaterialName(child.material)
        child.material = Array.isArray(child.material)
          ? child.material.map(tuneRoomMaterial)
          : tuneRoomMaterial(child.material)
        child.frustumCulled = !isRoomSurfaceMaterial(materialName)
        child.castShadow    = ENABLE_SHADOWS
        child.receiveShadow = ENABLE_SHADOWS
        if (child.geometry && !child.geometry.attributes.normal) {
          child.geometry.computeVertexNormals()
        }
      })

      const box    = new THREE.Box3().setFromObject(model)
      const center = box.getCenter(new THREE.Vector3())
      model.position.x -= center.x
      model.position.z -= center.z
      model.position.y -= center.y

      scene.add(model)

      const roomBox    = new THREE.Box3().setFromObject(model)
      const roomSize   = roomBox.getSize(new THREE.Vector3())
      const roomCenter = roomBox.getCenter(new THREE.Vector3())

      const wallZ  = roomBox.min.z + roomSize.z * 0.02
      const lightY = roomCenter.y + roomSize.y * 0.08
      xmasLights.forEach((light) => {
        light.position.y = lightY
        light.position.z = wallZ + 0.15
        light.userData.active = true
      })

      applySceneCamera(roomBox, roomSize, roomCenter, 0.36)
      setMainSceneReady()

      setHelpText('Click para entrar | WASD moverte | R reiniciar | Esc salir')
    },
    undefined,
    (error) => {
      console.error(error)
      setHelpText('No se pudo cargar el modelo de la sala.')
    }
  )
}

export function updateScene1(time) {
  xmasLights.forEach((light) => {
    if (!light.userData.active) return
    light.intensity = light.userData.baseIntensity * (0.75 + 0.25 * Math.sin(time * 3.5 + light.userData.phase))
  })
}
