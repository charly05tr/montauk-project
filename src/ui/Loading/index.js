import * as THREE from 'three'

let loadingScreen
let loadingBar
let loadingText

let initialAssetsLoaded = false
let mainSceneReady = false
let loadingScreenHidden = false

export function initLoadingScreen() {
  loadingScreen = document.createElement('div')
  loadingScreen.style.cssText = `
    position:fixed;inset:0;background:#020006;
    display:flex;flex-direction:column;
    align-items:center;justify-content:center;
    z-index:9999;color:#ff7a2b;font-family:Georgia,serif;
  `
  loadingScreen.innerHTML = `
    <div style="font-size:2rem;margin-bottom:1rem;letter-spacing:4px;">STRANGER THINGS</div>
    <div style="width:300px;height:4px;background:#1a0a00;border-radius:2px;overflow:hidden;">
      <div id="loading-bar" style="height:100%;width:0%;background:#ff7a2b;transition:width 0.2s;"></div>
    </div>
    <div id="loading-text" style="margin-top:0.75rem;font-size:0.9rem;opacity:0.7;">Cargando...</div>
  `
  document.body.appendChild(loadingScreen)
  loadingBar = loadingScreen.querySelector('#loading-bar')
  loadingText = loadingScreen.querySelector('#loading-text')
}

export function hideLoadingScreenWhenReady() {
  if (loadingScreenHidden || !initialAssetsLoaded || !mainSceneReady) return
  loadingScreenHidden = true
  loadingBar.style.width = '100%'
  loadingText.textContent = 'Listo'
  setTimeout(() => {
    loadingScreen.style.opacity = '0'
    loadingScreen.style.transition = 'opacity 0.5s'
    setTimeout(() => loadingScreen.remove(), 500)
  }, 300)
}

export function setMainSceneReady() {
  mainSceneReady = true
  hideLoadingScreenWhenReady()
}

export const loadingManager = new THREE.LoadingManager(
  () => {
    initialAssetsLoaded = true
    hideLoadingScreenWhenReady()
  },
  (url, loaded, total) => {
    const pct = total > 0 ? Math.round((loaded / total) * 100) : 0
    if (loadingBar) loadingBar.style.width = pct + '%'
    if (loadingText) loadingText.textContent = `Cargando... ${pct}%`
  },
  (url) => { if (loadingText) loadingText.textContent = `Error: ${url}` }
)
