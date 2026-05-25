import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { loadingManager, setMainSceneReady } from '../../ui/Loading/index.js'
import { setHelpText } from '../../ui/Overlay/index.js'
import { ENABLE_SHADOWS } from '../../utils/constants.js'
import { getMaterialName, tuneRoomMaterial, isRoomSurfaceMaterial } from './objects.js'
import { createStaticBox } from '../../physics/Collider.js'

export const xmasLights = []
let redLight, orangeLight

export function loadRoom(scene, physicsWorld, player) {
  // Luces de la sala reducidas en intensidad a nivel microscópico para ajustarse a la escala minúscula (0.04)
  // y evitar sobreexposición con decay: 2
  redLight = new THREE.PointLight(0xff2a12, 0.005, 2, 2)
  redLight.position.set(-0.12, 0.2, 0.04)
  scene.add(redLight)

  orangeLight = new THREE.PointLight(0xff6a18, 0.005, 2, 2)
  orangeLight.position.set(0.1, 0.15, -0.1)
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
        child.castShadow = ENABLE_SHADOWS
        child.receiveShadow = ENABLE_SHADOWS
        if (child.geometry && !child.geometry.attributes.normal) {
          child.geometry.computeVertexNormals()
        }
      })

      const box = new THREE.Box3().setFromObject(model)
      const center = box.getCenter(new THREE.Vector3())
      model.position.x -= center.x
      model.position.z -= center.z
      model.position.y -= center.y

      scene.add(model)

      const roomBox = new THREE.Box3().setFromObject(model)
      const roomSize = roomBox.getSize(new THREE.Vector3())
      const roomCenter = roomBox.getCenter(new THREE.Vector3())

      const wallZ = roomBox.min.z + roomSize.z * 0.02
      const lightY = roomCenter.y + roomSize.y * 0.08
      xmasLights.forEach((light) => {
        light.position.y = lightY
        light.position.z = wallZ + 0.15
        light.userData.active = true
      })

      // FÍSICAS: Crear colisionadores (Suelo y 4 paredes invisibles)
      const w = roomSize.x;
      const h = roomSize.y;
      const d = roomSize.z;
      const t = 1.0; // Grosor

      createStaticBox(physicsWorld, w, t, d, { x: roomCenter.x, y: roomBox.min.y - t / 2, z: roomCenter.z }); // Suelo
      createStaticBox(physicsWorld, w, t, d, { x: roomCenter.x, y: roomBox.max.y + t / 2, z: roomCenter.z }); // Techo

      createStaticBox(physicsWorld, t, h, d, { x: roomBox.min.x - t / 2, y: roomCenter.y, z: roomCenter.z }); // Pared Izq
      createStaticBox(physicsWorld, t, h, d, { x: roomBox.max.x + t / 2, y: roomCenter.y, z: roomCenter.z }); // Pared Der
      createStaticBox(physicsWorld, w, h, t, { x: roomCenter.x, y: roomCenter.y, z: roomBox.min.z - t / 2 }); // Frente
      createStaticBox(physicsWorld, w, h, t, { x: roomCenter.x, y: roomCenter.y, z: roomBox.max.z + t / 2 }); // Atrás

      // JUGADOR: Posicionarlo dentro de la sala
      // Usamos un porcentaje de la altura de la sala para asegurar que nacemos DENTRO de ella, y no en el techo
      player.setPosition(roomCenter.x, roomBox.min.y + (roomSize.y * 0.25), roomCenter.z);

      setMainSceneReady()

      setHelpText('Click para entrar | WASD moverte | Esc salir')
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
