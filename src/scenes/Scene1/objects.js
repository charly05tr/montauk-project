import * as THREE from 'three'
import { USE_NORMAL_MAPS, USE_EXTRA_MAPS, LOW_QUALITY } from '../../utils/constants.js'
import { loadingManager } from '../../ui/Loading/index.js'

const textureLoader = new THREE.TextureLoader(loadingManager)

function loadTex(path, rx = 1, ry = 1) {
  const t = textureLoader.load(path)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(rx, ry)
  t.generateMipmaps = true
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.magFilter = THREE.LinearFilter
  return t
}

const ceilingTexture = loadTex('/models/stranger_things_room/textures/wood-planks_baseColor.jpeg', 4, 3)

export const xmasBulbMaterialNames = ['red_lamp', 'blue_lamp', 'yellow_lamp']

export function getMaterialName(m) {
  return Array.isArray(m) ? m[0]?.name : m?.name
}

export function isRoomSurfaceMaterial(n) {
  return ['ceiling','floor_wood','wall_texture','wood-separator','wood-planks','plank','letters','garland_wire'].includes(n)
}

function getBulbColor(name) {
  if (name === 'red_lamp') return new THREE.Color(0xff2514)
  if (name === 'blue_lamp') return new THREE.Color(0x20c7ff)
  if (name === 'yellow_lamp') return new THREE.Color(0xffe05a)
  return new THREE.Color(0xffffff)
}

export function optimizeMaterial(m) {
  if (!m) return m
  if (m.map) {
    m.map.generateMipmaps = true
    m.map.minFilter = THREE.LinearMipmapLinearFilter
    m.map.magFilter = THREE.LinearFilter
    m.map.colorSpace = THREE.SRGBColorSpace
  }
  if (!USE_NORMAL_MAPS && m.normalMap)    m.normalMap = null
  if (!USE_EXTRA_MAPS  && m.roughnessMap) m.roughnessMap = null
  if (!USE_EXTRA_MAPS  && m.metalnessMap) m.metalnessMap = null
  m.needsUpdate = true
  return m
}

export function tuneRoomMaterial(material) {
  if (!material) return material
  const src = material.clone()

  if (src.name === 'letters') {
    optimizeMaterial(src)
    return new THREE.MeshBasicMaterial({
      map: src.map,
      color: 0x5a2a14,
      transparent: true,
      alphaTest: 0.02,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
      name: 'letters',
    })
  }

  if (xmasBulbMaterialNames.includes(src.name)) {
    const color = getBulbColor(src.name)
    return new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9,
      toneMapped: false,
      name: src.name,
    })
  }

  if (src.color)    src.color.multiplyScalar(0.62)
  if (src.emissive) src.emissive.multiplyScalar(0.2)
  if (src.name === 'ceiling') { src.map = ceilingTexture; src.color.set(0x4a3325) }

  if (LOW_QUALITY) {
    return optimizeMaterial(new THREE.MeshLambertMaterial({
      color:    src.color?.clone()    || new THREE.Color(0xffffff),
      map:      src.map               || null,
      emissive: src.emissive?.clone() || new THREE.Color(0x000000),
      side:     THREE.FrontSide,
      name:     src.name             || '',
    }))
  }
  src.side = isRoomSurfaceMaterial(src.name) ? THREE.DoubleSide : THREE.FrontSide
  optimizeMaterial(src)
  return src
}
