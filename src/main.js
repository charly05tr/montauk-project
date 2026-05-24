import * as THREE from 'three'
import { initLoadingScreen } from './ui/Loading/index.js'
import { initOverlay } from './ui/Overlay/index.js'
import { initRenderer } from './core/Renderer.js'
import { initCamera, getCamera, moveCamera } from './core/Camera.js'
import { initGlobalLights, updateGlobalLights } from './core/Lights.js'
import { initSceneManager, getScene, updateCurrentScene } from './core/SceneManager.js'

const app = document.querySelector('#app')

// 1. Inicializar UI
initLoadingScreen()
initOverlay()

// 2. Inicializar Core
const renderer = initRenderer(app)
const camera = initCamera()
const scene = initSceneManager()

// 3. Inicializar Luces Globales
initGlobalLights(scene)

// 4. Reloj y Loop de Animación
const clock = new THREE.Clock()

function animate() {
  requestAnimationFrame(animate)
  const dt = Math.min(clock.getDelta(), 0.05)
  
  // Actualizar movimiento de la cámara
  moveCamera(dt)
  
  // Sincronizar luz con la posición de la cámara
  updateGlobalLights(camera.position)
  
  // Actualizar lógica de la escena actual (ej. luces navideñas)
  updateCurrentScene(clock.elapsedTime)
  
  // Renderizar frame
  renderer.render(scene, camera)
}

animate()
