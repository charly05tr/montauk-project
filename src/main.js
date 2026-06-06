import * as THREE from 'three'
import { initLoadingScreen } from './ui/Loading/index.js'
import { initOverlay } from './ui/Overlay/index.js'
import { initRenderer } from './core/Renderer.js'
import { initGlobalLights, updateGlobalLights } from './core/Lights.js'
import { sceneManager } from './core/SceneManager.js'
import { PhysicsWorld } from './physics/PhysicsWorld.js'
import { Player } from './core/Player.js'

// --- POST-PROCESSING IMPORTS ---
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { FilmPass } from 'three/examples/jsm/postprocessing/FilmPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { VignetteShader } from 'three/examples/jsm/shaders/VignetteShader.js';

const app = document.querySelector('#app')

// 1. Inicializar UI
initLoadingScreen()
initOverlay()

// 2. Físicas
const physicsWorld = new PhysicsWorld()

// 3. Crear escena y Jugador a través del SceneManager
// Usamos una escena dummy para el jugador primero para evitar errores en su constructor,
// pero luego la reemplazamos cuando obtenemos la escena real
const player = new Player(sceneManager.getScene(), physicsWorld)
const scene = sceneManager.initScene(physicsWorld, player)

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
const sceneOrder = ['scene1', 'scene2', 'scene3']
window.addEventListener('keydown', (e) => {
  if (e.key.length !== 1) return // Ignorar teclas especiales (Shift, Ctrl, etc.)
  
  typedBuffer += e.key.toLowerCase()
  if (typedBuffer.length > 4) {
    typedBuffer = typedBuffer.substring(typedBuffer.length - 4)
  }
  
  if (typedBuffer === 'help') {
    const currentIndex = sceneOrder.indexOf(sceneManager.activeSceneId)
    const nextScene = sceneOrder[(currentIndex + 1) % sceneOrder.length]
    console.log(`Codi/Atajo detectado. Cambiando de escena a: ${nextScene}`)
    sceneManager.switchScene(nextScene, physicsWorld, player)
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
