import * as THREE from 'three'
import { LOW_QUALITY, ENABLE_SHADOWS } from '../utils/constants.js'

let renderer

export function initRenderer(appElement) {
  renderer = new THREE.WebGLRenderer({
    antialias: false,
    powerPreference: 'high-performance',
    precision: LOW_QUALITY ? 'mediump' : 'highp',
  })
  renderer.setPixelRatio(1)
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.shadowMap.enabled = ENABLE_SHADOWS
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 0.5
  appElement.appendChild(renderer.domElement)

  window.addEventListener('resize', () => {
    renderer.setPixelRatio(1)
    renderer.setSize(window.innerWidth, window.innerHeight)
  })

  setupContextLossRecovery(renderer.domElement)

  return renderer
}

/**
 * Maneja la pérdida/restauración del contexto WebGL.
 *
 * En móvil, cuando la GPU se queda sin memoria el navegador puede "matar" el
 * contexto WebGL. Sin manejarlo, el canvas queda en negro o el navegador recarga
 * la pestaña (devolviendo al usuario a la landing). Llamando a preventDefault() en
 * 'webglcontextlost' le decimos al navegador que vamos a intentar restaurarlo, lo
 * que habilita el evento 'webglcontextrestored'. Three.js re-sube automáticamente
 * los recursos GPU en el siguiente render, así que el loop de animación se recupera
 * solo sin recargar la página.
 */
function setupContextLossRecovery(canvas) {
  const banner = document.createElement('div')
  banner.style.cssText = `
    position:fixed;inset:0;display:none;z-index:99999;
    align-items:center;justify-content:center;text-align:center;
    background:#020006;color:#ff7a2b;font-family:Georgia,serif;
    font-size:1.1rem;padding:2rem;
  `
  banner.textContent = 'Reconectando con el Upside Down...'
  document.body.appendChild(banner)

  canvas.addEventListener('webglcontextlost', (event) => {
    // Permite que el navegador intente restaurar el contexto en lugar de matarlo.
    event.preventDefault()
    console.warn('[Renderer] Contexto WebGL perdido (probable presión de memoria GPU).')
    banner.style.display = 'flex'
  }, false)

  canvas.addEventListener('webglcontextrestored', () => {
    console.warn('[Renderer] Contexto WebGL restaurado.')
    banner.style.display = 'none'
  }, false)
}

export function getRenderer() {
  return renderer
}
