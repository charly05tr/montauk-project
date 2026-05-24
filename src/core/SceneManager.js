import * as THREE from 'three'
import { loadRoom, updateScene1 } from '../scenes/Scene1/index.js'

let currentScene

export function initSceneManager() {
  currentScene = new THREE.Scene()
  currentScene.background = new THREE.Color(0x020006)
  
  loadRoom(currentScene)
  
  return currentScene
}

export function getScene() {
  return currentScene
}

export function updateCurrentScene(time) {
  // Lógica para actualizar la escena actual, si aplica.
  updateScene1(time)
}
