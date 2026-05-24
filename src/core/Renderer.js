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

  return renderer
}

export function getRenderer() {
  return renderer
}
