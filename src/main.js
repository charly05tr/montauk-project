import * as THREE from 'three'
import { initLoadingScreen, loadingManager } from './ui/Loading/index.js'
import { initOverlay, setExitCallback, setExitButtonVisible } from './ui/Overlay/index.js'
import { soundManager } from './core/SoundManager.js'
import { initRenderer } from './core/Renderer.js'
import { initGlobalLights, updateGlobalLights } from './core/Lights.js'
import { sceneManager } from './core/SceneManager.js'
import { PhysicsWorld } from './physics/PhysicsWorld.js'
import { Player } from './core/Player.js'
import { initMobileControls } from './ui/MobileControls/index.js'
import { initPauseMenu } from './ui/PauseMenu/index.js'
import { isMobile } from './utils/deviceDetection.js'

// --- POST-PROCESSING IMPORTS ---
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { FilmPass } from 'three/examples/jsm/postprocessing/FilmPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { VignetteShader } from 'three/examples/jsm/shaders/VignetteShader.js';
import { initLandingPage } from './ui/Landing/index.js';
import { initOrientationLock } from './utils/orientationLock.js';

// Activar el bloqueo de orientación para dispositivos móviles
initOrientationLock();

// Inicializar todos los sistemas core del juego inmediatamente para pre-cargar la escena
const app = document.querySelector('#app')

// 1. Inicializar UI
initOverlay()
initLoadingScreen()

// Empezar a precargar absolutamente todos los modelos al iniciar
sceneManager.preloadAllAssets(loadingManager);

// 2. Físicas
const physicsWorld = new PhysicsWorld()

// 3. Crear escena y Jugador a través del SceneManager
const player = new Player(sceneManager.getScene(), physicsWorld)
const scene = sceneManager.initScene(physicsWorld, player)

// 3.5. Inicializar controles móviles si es un dispositivo táctil
initMobileControls(player)

// 3.6. Inicializar menú de pausa
initPauseMenu(player, physicsWorld, exitToLanding);

// 3.7. Configurar PointerLock handlers para PC
if (!isMobile()) {
  player.controls.addEventListener('lock', () => {
    setExitButtonVisible(false);
  });
  player.controls.addEventListener('unlock', () => {
    setExitButtonVisible(true);
  });
}

// 4. Inicializar Core (Renderer)
const renderer = initRenderer(app)

// 5. Configurar Post-procesado (EffectComposer)
const composer = new EffectComposer(renderer);

// RenderPass: Dibuja la escena base
const renderPass = new RenderPass(scene, player.camera);
composer.addPass(renderPass);

// FilmPass: Ruido estático y scanlines para look vintage/VHS
const filmPass = new FilmPass(0.35, 0.4, 648, false);
composer.addPass(filmPass);

// ShaderPass: Viñeteado agresivo (bordes muy oscuros) para claustrofobia
const vignettePass = new ShaderPass(VignetteShader);
vignettePass.uniforms["offset"].value = 1.0;
vignettePass.uniforms["darkness"].value = 1.1;
composer.addPass(vignettePass);

// Resize handler para composer
window.addEventListener('resize', () => {
  composer.setSize(window.innerWidth, window.innerHeight);
});

// 6. Inicializar Luces Globales Prácticas
initGlobalLights(scene)

// 7. Atajo de teclado especial para alternar escenas ("HELP")
let typedBuffer = ''
const sceneOrder = ['scene1', 'scene2', 'scene3', 'scene4']
window.addEventListener('keydown', (e) => {
  if (e.key.length !== 1) return // Ignorar teclas especiales (Shift, Ctrl, etc.)

  // No interceptar teclas cuando estamos en Scene 1 (el abecedario las maneja)
  if (sceneManager.activeSceneId === 'scene1') return;

  typedBuffer += e.key.toLowerCase()
  if (typedBuffer.length > 4) {
    typedBuffer = typedBuffer.substring(typedBuffer.length - 4)
  }

  if (typedBuffer === 'help') {
    const currentIndex = sceneOrder.indexOf(sceneManager.activeSceneId)
    const nextScene = sceneOrder[(currentIndex + 1) % sceneOrder.length]
    console.log(`Codi/Atajo detectado. Cambiando de escena a: ${nextScene}`)
    sceneManager.switchSceneWithTransition(nextScene, physicsWorld, player)
    typedBuffer = '' // Limpiar buffer tras activar
  }
})

// 8. Reloj y Loop de Animación
const clock = new THREE.Clock()

function animate() {
  requestAnimationFrame(animate)
  const dt = Math.min(clock.getDelta(), 0.05)

  // Avanzar simulación física
  physicsWorld.step(dt)

  // Actualizar controles y cámara del jugador
  player.update()

  // Sincronizar luz de jugador (linterna) con la cámara
  updateGlobalLights(player.camera)

  // Actualizar lógica de la escena actual
  sceneManager.updateCurrentScene(clock.elapsedTime, player, dt);

  // Renderizar frame con Post-procesado
  composer.render()
}

animate()

// Cargar la Landing Page pasando el objeto jugador para el PointerLock instantáneo
initLandingPage(null, player);

async function exitToLanding() {
  player.flashlightEnabled = false;
  player.flashlight.intensity = 0.0;

  if (player.keys) {
    for (const k in player.keys) {
      player.keys[k] = false;
    }
  }

  soundManager.stopAllAmbient();
  soundManager.stopAllPositional();

  sceneManager.activeSceneId = null;
  sceneManager.switchScene('scene1', physicsWorld, player);

  setExitButtonVisible(false);

  initLandingPage(null, player);
}

setExitCallback(exitToLanding);
