import * as THREE from 'three'
import { getRenderer } from './Renderer.js'
import { setHelpTextVisible } from '../ui/Overlay/index.js'

let camera
let minCameraY = -5.0
let maxCameraY = 5.0
let startPosition = new THREE.Vector3(0, 0, 0)
let startLookTarget = new THREE.Vector3(0, 0, -1)
let roomCollisionBounds = null

const keys = {}
let mouseLocked = false

// Smooth rotation variables (Cinematic Mouse Look)
let targetYaw = 0, currentYaw = 0
let targetPitch = 0, currentPitch = 0

// Momentum and physics variables
const velocity = new THREE.Vector3()
const targetVelocity = new THREE.Vector3()

// Head bobbing variables
let bobbingAccumulator = 0
let bobbingOffset = 0

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
      // Reinicio suave
      camera.position.copy(startPosition)

      const dummyCamera = new THREE.PerspectiveCamera()
      dummyCamera.position.copy(startPosition)
      dummyCamera.lookAt(startLookTarget)

      targetPitch = dummyCamera.rotation.x
      targetYaw = dummyCamera.rotation.y
      currentPitch = targetPitch
      currentYaw = targetYaw
      velocity.set(0, 0, 0)
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
    // Sensibilidad del ratón
    targetYaw -= e.movementX * 0.0015
    targetPitch -= e.movementY * 0.0015
    // Limitar que no dé una vuelta de campana la cabeza
    targetPitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, targetPitch))
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

const _forward = new THREE.Vector3()
const _right = new THREE.Vector3()
const _direction = new THREE.Vector3()

export function moveCamera(delta) {
  if (!camera) return

  // Evitar dts enormes si la pestaña pierde foco
  const dt = Math.min(delta, 0.1)

  // 1. Interpolar la rotación (Cinematic Mouse Look / Lerp)
  // factor 25 = respuesta rápida pero suave (un valor más bajo = más 'flotante')
  const rotLerpFactor = 1.0 - Math.exp(-dt * 25.0)
  currentYaw = THREE.MathUtils.lerp(currentYaw, targetYaw, rotLerpFactor)
  currentPitch = THREE.MathUtils.lerp(currentPitch, targetPitch, rotLerpFactor)

  camera.rotation.order = 'YXZ'
  camera.rotation.y = currentYaw
  camera.rotation.x = currentPitch

  // 2. Calcular el input de dirección
  _direction.set(0, 0, 0)
  if (keys['KeyW']) _direction.z -= 1
  if (keys['KeyS']) _direction.z += 1
  if (keys['KeyA']) _direction.x -= 1
  if (keys['KeyD']) _direction.x += 1
  if (keys['Space']) _direction.y += 1
  if (keys['ControlLeft'] || keys['ControlRight'] || keys['ShiftLeft'] || keys['ShiftRight']) _direction.y -= 1

  if (_direction.lengthSq() > 0) _direction.normalize()

  // 3. Orientar la dirección según hacia dónde mira la cámara
  camera.getWorldDirection(_forward)
  _forward.y = 0; _forward.normalize()
  _right.crossVectors(_forward, camera.up).normalize()

  // 4. Calcular velocidad objetivo
  const baseSpeed = 0.1
  const verticalSpeed = 0.5

  targetVelocity.set(0, 0, 0)
  targetVelocity.addScaledVector(_forward, -_direction.z * baseSpeed)
  targetVelocity.addScaledVector(_right, _direction.x * baseSpeed)
  targetVelocity.y = _direction.y * verticalSpeed

  // 5. Aplicar Inercia / Momentum
  const moveLerpFactor = 1.0 - Math.exp(-dt * 10.0)
  velocity.lerp(targetVelocity, moveLerpFactor)

  // 6. Restar el head bobbing del frame anterior
  camera.position.y -= bobbingOffset

  // 7. Mover al personaje con la física
  tryMoveCamera(velocity.x * dt, velocity.z * dt)
  camera.position.y += velocity.y * dt

  camera.position.y = Math.max(minCameraY, Math.min(maxCameraY, camera.position.y))
  clampCameraToRoom(camera.position)

  // 8. Calcular nuevo Head Bobbing simple (solo Y)
  const horizontalSpeed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z)

  if (horizontalSpeed > 0.1) {
    bobbingAccumulator += horizontalSpeed * dt * 10.0
  }

  const bobAmplitude = 0.5 // Amplitud sutil
  const targetBobbing = horizontalSpeed > 0.1 ? Math.sin(bobbingAccumulator) * bobAmplitude : 0

  // Suavizar la vuelta a la normalidad cuando se detiene
  bobbingOffset = THREE.MathUtils.lerp(bobbingOffset, targetBobbing, dt * 10.0)

  // 9. Aplicar el bobbing actualizado
  camera.position.y += bobbingOffset
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

  targetPitch = camera.rotation.x
  targetYaw = camera.rotation.y
  currentPitch = targetPitch
  currentYaw = targetYaw
  velocity.set(0, 0, 0)
}
