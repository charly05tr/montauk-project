import * as THREE from 'three'
import { getRenderer } from './Renderer.js'
import { setHelpTextVisible } from '../ui/Overlay/index.js'

let camera
let minCameraY          = -5.0
let maxCameraY          =  5.0
let startPosition       = new THREE.Vector3(0, 0, 0)
let startLookTarget     = new THREE.Vector3(0, 0, -1)
let roomCollisionBounds = null

const keys = {}
let yaw = 0, pitch = 0, mouseLocked = false

export function initCamera() {
  camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.02,
    180
  )
  camera.position.set(0, 1.4, 5.5)

  window.addEventListener('keydown', (e) => {
    keys[e.code] = true
    if (e.code === 'KeyR') {
      camera.position.copy(startPosition)
      camera.lookAt(startLookTarget)
      pitch = camera.rotation.x
      yaw   = camera.rotation.y
    }
  })

  window.addEventListener('keyup', (e) => { keys[e.code] = false })

  const renderer = getRenderer()
  document.body.addEventListener('click', () => {
    renderer.domElement.requestPointerLock()
  })

  document.addEventListener('pointerlockchange', () => {
    mouseLocked = document.pointerLockElement === renderer.domElement
    setHelpTextVisible(!mouseLocked)
  })

  document.addEventListener('mousemove', (e) => {
    if (!mouseLocked) return
    yaw   -= e.movementX * 0.001
    pitch -= e.movementY * 0.001
    pitch  = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch))
    camera.rotation.order = 'YXZ'
    camera.rotation.y = yaw
    camera.rotation.x = pitch
  })

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
  })

  return camera
}

export function getCamera() {
  return camera
}

function clampCameraToRoom(pos) {
  if (!roomCollisionBounds) return pos
  pos.x = THREE.MathUtils.clamp(pos.x, roomCollisionBounds.min.x, roomCollisionBounds.max.x)
  pos.z = THREE.MathUtils.clamp(pos.z, roomCollisionBounds.min.z, roomCollisionBounds.max.z)
  return pos
}

function tryMoveCamera(dx, dz) {
  camera.position.x += dx
  camera.position.z += dz
  clampCameraToRoom(camera.position)
}

const _forward   = new THREE.Vector3()
const _right     = new THREE.Vector3()
const _direction = new THREE.Vector3()

export function moveCamera(delta) {
  if (!camera) return
  const step = 0.32 * delta

  _direction.set(0, 0, 0)
  if (keys['KeyW']) _direction.z -= 1
  if (keys['KeyS']) _direction.z += 1
  if (keys['KeyA']) _direction.x -= 1
  if (keys['KeyD']) _direction.x += 1
  if (keys['Space'])      _direction.y += 1
  if (keys['ControlLeft'] || keys['ControlRight'] || keys['ShiftLeft'] || keys['ShiftRight']) _direction.y -= 1
  _direction.normalize()

  camera.getWorldDirection(_forward)
  _forward.y = 0; _forward.normalize()
  _right.crossVectors(_forward, camera.up).normalize()

  tryMoveCamera(-_direction.z * _forward.x * step, -_direction.z * _forward.z * step)
  tryMoveCamera( _direction.x * _right.x   * step,  _direction.x * _right.z   * step)

  camera.position.y += _direction.y * step * 0.55
  camera.position.y  = Math.max(minCameraY, Math.min(maxCameraY, camera.position.y))
  clampCameraToRoom(camera.position)
}

export function applySceneCamera(roomBox, roomSize, roomCenter, heightFactor = 0.36) {
  minCameraY = roomBox.min.y + 0.05
  maxCameraY = roomBox.max.y - 0.1
  const margin = 0.02
  roomCollisionBounds = new THREE.Box3(
    new THREE.Vector3(roomBox.min.x + margin, roomBox.min.y, roomBox.min.z + margin),
    new THREE.Vector3(roomBox.max.x - margin, roomBox.max.y, roomBox.max.z - margin)
  )
  startPosition.set(roomCenter.x, roomBox.min.y + roomSize.y * heightFactor, roomCenter.z)
  startLookTarget.set(roomCenter.x, startPosition.y, roomCenter.z - 1)
  camera.position.copy(startPosition)
  camera.lookAt(startLookTarget)
  pitch = camera.rotation.x
  yaw   = camera.rotation.y
}
