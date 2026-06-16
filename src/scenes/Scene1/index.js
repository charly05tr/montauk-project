import * as THREE from 'three';
import { assetCache } from '../../utils/AssetCache.js';
import { loadingManager, setMainSceneReady } from '../../ui/Loading/index.js';

// ... (skipping down to the loadRoom function)
import { setHelpText, setFloatingHelp } from '../../ui/Overlay/index.js';
import { ENABLE_SHADOWS } from '../../utils/constants.js';
import { getMaterialName, tuneRoomMaterial, isRoomSurfaceMaterial, xmasBulbMaterialNames } from './objects.js';
import { createStaticBox, createBoxFromMesh, createTrimeshFromMesh } from '../../physics/Collider.js';
import { eventBus } from '../../utils/eventBus.js';
import { soundManager } from '../../core/SoundManager.js';
import { startPortalSequence, updatePortalSequence, cleanupPortalSequence, isPortalActive } from './PortalSequence.js';

let sceneManagerInstance = null;

export const xmasLights = [];
let redLight, orangeLight;
let activePlayer = null;
let activePhysicsWorld = null;
let finalRoomBox = null;
let blueAmbient = null;
let rootsGroup = null;
let rootViscousTexture = null;

let bulbGlowTexture = null;
const wallPointLights = [];

// Objetos auxiliares creados por loadRoom() que deben limpiarse al re-entrar
const sceneAuxObjects = [];

let isUpsideDownActive = false; // Upside down toggle (U key)

// --- PARTICLES FOR UPSIDE DOWN ---
let upsideDownParticles = null;
let upsideDownParticleGeometry = null;
let upsideDownParticleMaterial = null;
let upsideDownParticleTexture = null;
let upsideDownParticleBasePositions = null;
let upsideDownParticleMotion = null;
const PARTICLE_COUNT = 250; // Aún más reducido

function getParticleTexture() {
  if (upsideDownParticleTexture) return upsideDownParticleTexture;

  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;

  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
  gradient.addColorStop(0.0, 'rgba(255,255,255,1.0)');
  gradient.addColorStop(0.22, 'rgba(200,230,255,0.95)');
  gradient.addColorStop(0.58, 'rgba(100,150,255,0.32)');
  gradient.addColorStop(1.0, 'rgba(50,100,200,0.0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  upsideDownParticleTexture = new THREE.CanvasTexture(canvas);
  upsideDownParticleTexture.colorSpace = THREE.SRGBColorSpace;
  return upsideDownParticleTexture;
}

function getGlowTexture() {
  if (bulbGlowTexture) return bulbGlowTexture;

  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;

  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0.0, 'rgba(255,255,255,1.0)');
  gradient.addColorStop(0.2, 'rgba(255,255,255,0.8)');
  gradient.addColorStop(0.5, 'rgba(255,255,255,0.35)');
  gradient.addColorStop(1.0, 'rgba(255,255,255,0.0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);

  bulbGlowTexture = new THREE.CanvasTexture(canvas);
  bulbGlowTexture.colorSpace = THREE.SRGBColorSpace;
  return bulbGlowTexture;
}

function getBulbNodeColor(node) {
  let color = new THREE.Color(0xffffff);
  node.traverse((child) => {
    if (child.isMesh && child.material) {
      const name = child.material.name;
      if (xmasBulbMaterialNames.includes(name)) {
        color = child.material.color;
      }
    }
  });
  return color;
}

function disposeUpsideDownParticles() {
  if (upsideDownParticles?.parent) {
    upsideDownParticles.parent.remove(upsideDownParticles);
  }
  upsideDownParticleGeometry?.dispose();
  upsideDownParticleMaterial?.dispose();

  upsideDownParticles = null;
  upsideDownParticleGeometry = null;
  upsideDownParticleMaterial = null;
  upsideDownParticleBasePositions = null;
  upsideDownParticleMotion = null;
}

function createUpsideDownParticles(scene, finalRoomCenter, finalRoomSize) {
  disposeUpsideDownParticles();

  upsideDownParticleBasePositions = new Float32Array(PARTICLE_COUNT * 3);
  upsideDownParticleMotion = new Float32Array(PARTICLE_COUNT * 4);
  const positions = new Float32Array(PARTICLE_COUNT * 3);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const posOffset = i * 3;
    const motionOffset = i * 4;

    upsideDownParticleBasePositions[posOffset] = finalRoomCenter.x + (Math.random() - 0.5) * finalRoomSize.x;
    upsideDownParticleBasePositions[posOffset + 1] = finalRoomCenter.y + (Math.random() - 0.5) * finalRoomSize.y;
    upsideDownParticleBasePositions[posOffset + 2] = finalRoomCenter.z + (Math.random() - 0.5) * finalRoomSize.z;

    positions[posOffset] = upsideDownParticleBasePositions[posOffset];
    positions[posOffset + 1] = upsideDownParticleBasePositions[posOffset + 1];
    positions[posOffset + 2] = upsideDownParticleBasePositions[posOffset + 2];

    upsideDownParticleMotion[motionOffset] = Math.random() * Math.PI * 2;
    upsideDownParticleMotion[motionOffset + 1] = THREE.MathUtils.lerp(0.18, 0.6, Math.random());
    upsideDownParticleMotion[motionOffset + 2] = THREE.MathUtils.lerp(0.02, 0.09, Math.random());
    upsideDownParticleMotion[motionOffset + 3] = THREE.MathUtils.lerp(0.02, 0.11, Math.random());
  }

  upsideDownParticleGeometry = new THREE.BufferGeometry();
  upsideDownParticleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  upsideDownParticleMaterial = new THREE.PointsMaterial({
    map: getParticleTexture(),
    color: 0x4488ff, // Azul más profundo, no tan blanco
    size: 0.04,      // Partículas mucho más pequeñas
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
    alphaTest: 0.02,
    fog: true,
  });

  upsideDownParticles = new THREE.Points(upsideDownParticleGeometry, upsideDownParticleMaterial);
  upsideDownParticles.frustumCulled = false;
  upsideDownParticles.visible = false;
  upsideDownParticles.renderOrder = 3;
  scene.add(upsideDownParticles);
}

// --- SISTEMA DE ABECEDARIO INTERACTIVO ---
// Mapeo de foquitos ordenados espacialmente a letras A-Z
const alphabetBulbs = [];      // Array de { mesh, worldPos, letter, pointLight }
let helpBuffer = '';           // Buffer de lo que el usuario ha escrito
const HELP_WORD = 'help';
let helpTriggered = false;     // Para evitar disparar la transición múltiples veces
let activeScene = null;        // Referencia a la escena de Three.js para agregar PointLights
const activeLights = [];       // PointLights activos que iluminan los foquitos

// Colores vibrantes para las letras iluminadas (estilo Stranger Things)
const LETTER_LIGHT_COLORS = {
  h: 0xff2514,  // Rojo intenso
  e: 0x20c7ff,  // Azul eléctrico
  l: 0xff2514,  // Rojo intenso
  p: 0xffe05a,  // Amarillo cálido
};
const DEFAULT_LIGHT_COLOR = 0xffe05a;

function cleanupAlphabetState() {
  helpBuffer = '';
  helpTriggered = false;
  // Remover PointLights activos de la escena
  activeLights.forEach(light => {
    if (light.parent) light.parent.remove(light);
  });
  activeLights.length = 0;

  // Limpiar y liberar sprites de los focos
  alphabetBulbs.forEach(b => {
    if (b.glowSprite) {
      if (b.glowSprite.parent) b.glowSprite.parent.remove(b.glowSprite);
      if (b.glowSprite.material) b.glowSprite.material.dispose();
      b.glowSprite = null;
    }
  });
  alphabetBulbs.length = 0;

  // Limpiar y liberar point lights de la pared
  wallPointLights.forEach(light => {
    if (light.parent) light.parent.remove(light);
    light.dispose();
  });
  wallPointLights.length = 0;

  // Limpiar objetos del portal si existían
  cleanupPortalSequence();

  // Limpiar objetos auxiliares de la carga anterior (luces, parches de pared, etc.)
  sceneAuxObjects.forEach(obj => {
    if (obj.parent) obj.parent.remove(obj);
  });
  sceneAuxObjects.length = 0;

  if (rootsGroup) {
    if (rootsGroup.parent) rootsGroup.parent.remove(rootsGroup);
    rootsGroup = null;
  }

  // Desregistrar listeners de interacción con bombillas
  window.removeEventListener('pointerdown', onBulbPointerDown);
  window.removeEventListener('pointerup', onBulbPointerUp);
}

/**
 * Recolecta los nodos de los foquitos del árbol de navidad del modelo,
 * los ordena espacialmente (3 filas, izquierda a derecha) y los asigna a letras A-Z.
 */
function collectAndMapBulbs(model) {
  alphabetBulbs.length = 0;
  const bulbParents = [];

  // 1. Recolectar nodos
  model.traverse((child) => {
    if (!child.name || !child.name.startsWith('Plane')) return;
    const worldPos = new THREE.Vector3();
    child.getWorldPosition(worldPos);
    bulbParents.push({ node: child, worldPos });
  });

  if (bulbParents.length === 0) return;

  // 2. Ordenar por altura (Filas)
  // Primero ordenamos todos los bulbos por su Y descendente (de más alto a más bajo)
  bulbParents.sort((a, b) => b.worldPos.y - a.worldPos.y);

  const rows = [];
  let currentRow = [bulbParents[0]];
  const ROW_THRESHOLD = 0.15;

  for (let i = 1; i < bulbParents.length; i++) {
    const prevY = currentRow[currentRow.length - 1].worldPos.y;
    const currY = bulbParents[i].worldPos.y;
    if (Math.abs(prevY - currY) < ROW_THRESHOLD) {
      currentRow.push(bulbParents[i]);
    } else {
      rows.push(currentRow);
      currentRow = [bulbParents[i]];
    }
  }
  rows.push(currentRow);

  // 3. Ordenar por Z (Izquierda a Derecha)
  rows.forEach(row => row.sort((a, b) => a.worldPos.z - b.worldPos.z));

  // 4. Aplanar array definitivo
  const flatBulbs = rows.flat();

  const STRANGER_MAP = {
    'h': 4,
    'e': 12,
    'l': 17,
    'p': 7
  };

  flatBulbs.forEach((bulb, i) => {
    const letterEntry = Object.entries(STRANGER_MAP).find(([key, val]) => val === i);
    const letter = letterEntry ? letterEntry[0] : null;

    // El bulbo de la letra L en el modelo original está un poco desalineado visualmente,
    // le aplicamos el ajuste que tenía en el index 17 original.
    if (letter === 'l' && !model.userData.bulbOffsetDone) {
      const offsetVisualDerecha = 0.15; // 15cm
      const offsetHaciaAbajo = 0.04;   // -1cm

      bulb.node.position.z += offsetVisualDerecha;
      bulb.node.position.y += offsetHaciaAbajo;

      bulb.node.updateMatrixWorld(true);
      model.userData.bulbOffsetDone = true;
    }

    const finalWorldPos = new THREE.Vector3();
    bulb.node.getWorldPosition(finalWorldPos);

    alphabetBulbs.push({
      node: bulb.node,
      worldPos: finalWorldPos,
      index: i,
      letter: letter,
      pointLight: null,
    });
  });
}

/**
 * Ilumina el foquito correspondiente a una letra específica.
 */
function illuminateLetter(letter, scene) {
  const entry = alphabetBulbs.find(b => b.letter === letter.toLowerCase());

  // PROTECCIÓN: Si la letra no existe en nuestro mapa (ej. presionan la 'A'), abortamos
  if (!entry || !entry.letter) return;

  // Si ya tiene luz, no crear otra
  if (entry.pointLight) return;

  const color = LETTER_LIGHT_COLORS[letter.toLowerCase()] || DEFAULT_LIGHT_COLOR;

  // Crear PointLight brillante en la posición exacta del foquito
  const light = new THREE.PointLight(color, 8.0, 4.0, 1.5);
  light.position.copy(entry.worldPos);
  scene.add(light);

  entry.pointLight = light;
  activeLights.push(light);

  // Desvincular y cambiar el material del foquito para que brille
  entry.node.traverse((child) => {
    if (!child.isMesh) return;
    const matName = child.material?.name || '';
    if (xmasBulbMaterialNames.includes(matName)) {
      child.material = new THREE.MeshBasicMaterial({
        color: new THREE.Color(color),
        transparent: true,
        opacity: 1.0,
        toneMapped: false,
        name: matName,
      });
    }
  });
}

// Variables para control de interacción con bombillas
let pointerStartPos = { x: 0, y: 0 };
let pointerStartTime = 0;

function onBulbPointerDown(e) {
  pointerStartPos = { x: e.clientX, y: e.clientY };
  pointerStartTime = performance.now();
}

function onBulbPointerUp(e) {
  if (!sceneManagerInstance || sceneManagerInstance.activeSceneId !== 'scene1') return;
  if (helpTriggered) return;

  // Evitar interactuar si se hizo tap en algún botón o contenedor de la interfaz de usuario (mobile/help)
  if (e.target.closest('.mobile-ui') || e.target.closest('#landing-page') || e.target.closest('#loading-screen')) {
    return;
  }

  const deltaX = e.clientX - pointerStartPos.x;
  const deltaY = e.clientY - pointerStartPos.y;
  const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  const elapsed = performance.now() - pointerStartTime;

  // Si fue un toque/click estático (no un arrastre para mirar a los lados)
  if (distance < 8 && elapsed < 350) {
    handleBulbTap(e.clientX, e.clientY);
  }
}

function handleBulbTap(clientX, clientY) {
  if (!activePlayer || !activeScene) return;

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  // Convertir a coordenadas normalizadas
  mouse.x = (clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, activePlayer.camera);

  // Obtener los nodos de colisión de todas las bombillas mapeadas
  const targets = alphabetBulbs.map(b => b.node);
  if (targets.length === 0) return;

  const intersects = raycaster.intersectObjects(targets, true);

  if (intersects.length > 0) {
    const hitObject = intersects[0].object;

    // Buscar a qué bombilla mapeada pertenece el objeto colisionado
    let matchedBulb = null;
    for (const bulb of alphabetBulbs) {
      let curr = hitObject;
      while (curr) {
        if (curr === bulb.node) {
          matchedBulb = bulb;
          break;
        }
        curr = curr.parent;
      }
      if (matchedBulb) break;
    }

    if (matchedBulb && matchedBulb.letter) {
      console.log(`[Bulb Interaction] Tapped bulb: ${matchedBulb.letter.toUpperCase()}`);
      // Simular evento keydown para reutilizar la lógica ya construida
      onAlphabetKeyDown({ key: matchedBulb.letter });
    }
  }
}

/**
 * Maneja el input del teclado para el sistema del abecedario.
 * Se llama desde el listener de keydown.
 */
function onAlphabetKeyDown(e) {
  // Solo funcionar cuando estamos en Scene 1 y no en transición
  if (!sceneManagerInstance || sceneManagerInstance.activeSceneId !== 'scene1') return;
  if (helpTriggered) return;
  if (e.key.length !== 1) return;

  const key = e.key.toLowerCase();

  if (key === 'u') {
    // Upside Down Toggle
    isUpsideDownActive = !isUpsideDownActive;
    if (sceneManagerInstance) sceneManagerInstance.isUpsideDownActive = isUpsideDownActive;
    applyUpsideDownState();
    return;
  }

  if (key < 'a' || key > 'z') return; // Solo letras

  // Reproducir sonido de tecla clic solo para las letras 'h', 'e', 'l', 'p'
  if (['h', 'e', 'l', 'p'].includes(key)) {
    soundManager.playKeyboardSlice('/sounds/keyboard.mp3', 0.8);
  }

  // Verificar si la letra coincide con la siguiente esperada en "help"
  const nextExpected = HELP_WORD[helpBuffer.length];

  if (key === nextExpected) {
    helpBuffer += key;

    // Reproducir timbrado del teléfono que incrementa en volumen
    soundManager.stopAmbient('phone');
    const ringVol = 0.35 + (helpBuffer.length * 0.15); // H (0.50), E (0.65), L (0.80), P (0.95)
    soundManager.playAmbient('phone', '/sounds/phone_ringing.mp3', false, ringVol, 'sfx');

    // Iluminar la letra en el abecedario de la pared
    if (activeScene) {
      illuminateLetter(key, activeScene);
    }

    // Mostrar progreso
    const progress = HELP_WORD.split('').map((ch, i) => {
      if (i < helpBuffer.length) return ch.toUpperCase();
      return '_';
    }).join(' ');
    setHelpText(progress);

    // ¿Se completó la palabra?
    if (helpBuffer === HELP_WORD) {
      helpTriggered = true;
      setHelpText('H E L P');

      // Iniciar la secuencia cinemática del portal
      if (sceneManagerInstance && activePhysicsWorld && activePlayer && finalRoomBox) {
        const roomCenter = finalRoomBox.getCenter(new THREE.Vector3());
        startPortalSequence(
          activeScene,
          activePlayer,
          roomCenter,
          finalRoomBox,
          sceneManagerInstance,
          activePhysicsWorld
        );
      }
    }
  } else {
    // Si la tecla presionada es w, a, s, d (movimiento), l o q (info/ayuda), la ignoramos para no interrumpir
    if (['w', 'a', 's', 'd', 'l', 'q'].includes(key)) {
      return;
    }

    // Si tenía letras correctas y se equivocó, reproducir un timbrado fuerte como jump scare
    if (helpBuffer.length > 0) {
      soundManager.stopAmbient('phone');
      soundManager.playAmbient('phone', '/sounds/phone_ringing.mp3', false, 1.2, 'sfx');
    }

    // Letra incorrecta: reiniciar el progreso y apagar las luces
    helpBuffer = '';
    activeLights.forEach(light => {
      if (light.parent) light.parent.remove(light);
    });
    activeLights.length = 0;
    alphabetBulbs.forEach(b => { b.pointLight = null; });
    setFloatingHelp('<b>Scene: The Anomaly (Joyce Byers`s House)</b><br><br><b>Controls:</b><br>- Click to enter<br>- WASD to move<br><br><b>Hints:</b><br>- Press ESC to unlock pointer<br>- The alphabet wall is waiting. Spell the word that describes what you need to escape...?');
    setHelpText('');
  }
}

// Registrar el listener global (se activa sólo cuando estamos en Scene 1)
window.addEventListener('keydown', onAlphabetKeyDown);

export function applyUpsideDownState() {
  const globalAtmosphere = activeScene ? activeScene.getObjectByName("GlobalAtmosphereLight") : null;

  if (isUpsideDownActive) {
    if (redLight) {
      redLight.color.setHex(0x0033ff);
      redLight.intensity = 1.0; // Fuerte para bañar la casa de azul
    }
    if (orangeLight) {
      orangeLight.color.setHex(0x0033ff);
      orangeLight.intensity = 1.0;
    }

    if (globalAtmosphere) {
      globalAtmosphere.color.setHex(0x001133);
      globalAtmosphere.groundColor.setHex(0x000000);
      globalAtmosphere.intensity = 0.1; // Matar luz global blanca
    }

    if (blueAmbient) {
      blueAmbient.intensity = 1.0; // Luz tenue azul garantizada
    }

    if (activePlayer && activePlayer.flashlight) {
      activePlayer.flashlight.color.setHex(0x0033ff); // Linterna puramente azul oscura
    }

    // Añadir niebla fuertemente azulada
    if (activeScene) {
      activeScene.background = new THREE.Color(0x02081a);
      activeScene.fog = new THREE.FogExp2(0x02081a, 0.10); // Densidad moderada-alta
    }
  } else {
    if (redLight) {
      redLight.color.setHex(0xff2a12);
      redLight.intensity = 0.05;
    }
    if (orangeLight) {
      orangeLight.color.setHex(0xff6a18);
      orangeLight.intensity = 0.05;
    }

    if (globalAtmosphere) {
      globalAtmosphere.color.setHex(0x5a7ba3);
      globalAtmosphere.groundColor.setHex(0x3a4b66);
      globalAtmosphere.intensity = 3;
    }

    if (blueAmbient) {
      blueAmbient.intensity = 0.0;
    }

    if (activePlayer && activePlayer.flashlight) {
      activePlayer.flashlight.color.setHex(0xffffff); // Linterna original
    }

    // Quitar niebla
    // Configurar fondo oscuro base
    if (activeScene) {
      activeScene.background = new THREE.Color(0x050a12);
      activeScene.fog = new THREE.FogExp2(0x050a12, 0.05);
    }
  }

  if (rootsGroup) {
    rootsGroup.visible = isUpsideDownActive;
  }
}

export function loadRoom(scene, physicsWorld, player, sceneManager) {
  sceneManagerInstance = sceneManager;
  isUpsideDownActive = sceneManager.isUpsideDownActive || false;
  
  // Limpiar antes de cargar
  cleanupAlphabetState();
  activePlayer = player;
  activePhysicsWorld = physicsWorld;
  activeScene = scene;

  // Registrar listeners de interacción con bombillas
  window.addEventListener('pointerdown', onBulbPointerDown);
  window.addEventListener('pointerup', onBulbPointerUp);

  // Reproducir el sonido ambiente de la escena de inmediato para que suene durante la carga
  soundManager.playAmbient('room_ambient', '/sounds/scene2.mp3', true, 0.4);

  // Luces Base (La posición se ajustará matemáticamente después de cargar la sala)
  redLight = new THREE.PointLight(0xff2a12, 0.05, 20, 2)
  redLight.position.set(-3, 5, 1)
  scene.add(redLight)
  sceneAuxObjects.push(redLight)

  orangeLight = new THREE.PointLight(0xff6a18, 0.05, 20, 2)
  orangeLight.position.set(2.5, 3.75, -2.5)
  scene.add(orangeLight)
  sceneAuxObjects.push(orangeLight)

  blueAmbient = new THREE.AmbientLight(0x0033ff, 0.0)
  scene.add(blueAmbient)
  sceneAuxObjects.push(blueAmbient)

  assetCache.loadGLTF('/models/stranger_things_room/scene.gltf', loadingManager).then(
    (gltf) => {
      const model = gltf.scene;

      if (!model.userData.isConfigured) {
        // --- 1. ESCALA DINÁMICA PERFECTA ---
        // Calculamos el tamaño original "crudo" que trae el modelo desde Blender
        const initialBox = new THREE.Box3().setFromObject(model);
        const rawHeight = initialBox.getSize(new THREE.Vector3()).y;

        // Forzamos matemáticamente que el techo de la casa de Joyce mida ~3.0 metros
        const targetHeight = 3.0;
        const scaleFactor = targetHeight / rawHeight;
        model.scale.setScalar(scaleFactor);
        model.updateMatrixWorld(true);

        // --- 2. CENTRADO ABSOLUTO ---
        // Calculamos la caja NUEVAMENTE ahora que el modelo tiene el tamaño correcto
        const scaledBox = new THREE.Box3().setFromObject(model);
        const center = scaledBox.getCenter(new THREE.Vector3());

        model.position.x -= center.x;
        model.position.y -= center.y;
        model.position.z -= center.z;
        model.updateMatrixWorld(true);

        model.userData.isConfigured = true;
      }

      scene.add(model);

      // Caja definitiva para armar las paredes y físicas perimetrales
      finalRoomBox = new THREE.Box3().setFromObject(model);
      const finalRoomSize = finalRoomBox.getSize(new THREE.Vector3());
      const finalRoomCenter = finalRoomBox.getCenter(new THREE.Vector3());

      // --- 3. EXTRACCIÓN DE MATERIALES Y COLISIONES ---
      // Solo procesar materiales la primera vez (el modelo cacheado ya tiene los materiales ajustados)
      const needsMaterialSetup = !model.userData.materialsProcessed;

      model.traverse((child) => {
        if (!child.isMesh) return;

        const materialName = getMaterialName(child.material);

        if (needsMaterialSetup) {
          // Aplicar el material refactorizado (que usa el caché para no matar la GPU)
          child.material = Array.isArray(child.material)
            ? child.material.map(tuneRoomMaterial)
            : tuneRoomMaterial(child.material);

          child.frustumCulled = !isRoomSurfaceMaterial(materialName);
          child.castShadow = ENABLE_SHADOWS;
          child.receiveShadow = ENABLE_SHADOWS;
        }

        if (isRoomSurfaceMaterial(materialName)) {
          // EXCEPCIÓN: Queremos colisionadores reales para las paredes (wall_texture, wood-planks, etc).
          // Ignoramos techo, piso y luces porque ya tienen soporte o no lo necesitan.
          if (materialName !== 'ceiling' && materialName !== 'floor_wood' && materialName !== 'garland_wire' && materialName !== 'letters') {
            const tempBox = new THREE.Box3().setFromObject(child);
            const size = tempBox.getSize(new THREE.Vector3());

            // Heurística de pared recta: Si es delgada en X o en Z (menos de 1 metro de grosor global),
            // es una pared plana. Generamos un 'Box' sólido que evita el tunneling y fallos de backface.
            if (size.x < 1.5 || size.z < 1.5) {
              createBoxFromMesh(physicsWorld, child);
            } else {
              // Si es gigante en ambos ejes (ej. forma de L), usamos Trimesh.
              createTrimeshFromMesh(physicsWorld, child);
            }
          }
          return;
        }

        // Muebles y props: creamos colisionador solo si el AABB no es desproporcionadamente
        // ancho respecto a su altura. Un ratio alto indica un nodo agrupado (varios objetos
        // fusionados) cuyo AABB gigante crearía un "suelo invisible" que deja flotando al jugador.
        const childBox = new THREE.Box3().setFromObject(child);
        const childSize = childBox.getSize(new THREE.Vector3());

        if (childSize.y < 0.15) return; // Muy plano: alfombras, libros en el suelo
        if (childSize.x < 0.1 && childSize.z < 0.1) return; // Muy estrecho

        const footprintRatio = (childSize.x * childSize.z) / Math.max(childSize.y, 0.01);
        if (footprintRatio > 12) return; // Nodo agrupado: AABB demasiado amplio → omitir

        createBoxFromMesh(physicsWorld, child);
      });

      if (needsMaterialSetup) {
        model.userData.materialsProcessed = true;
      }

      // --- 3.5. RECOLECTAR Y MAPEAR FOQUITOS DEL ABECEDARIO ---
      collectAndMapBulbs(model);

      // Crear sprites de brillo difuso para todas las bombillas con corrección de alineación
      alphabetBulbs.forEach((entry) => {
        const color = getBulbNodeColor(entry.node);
        const spriteMaterial = new THREE.SpriteMaterial({
          map: getGlowTexture(),
          color: color.clone(),
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          opacity: 0.35
        });
        const sprite = new THREE.Sprite(spriteMaterial);

        // CORRECCIÓN MATEMÁTICA: Aislar el eje horizontal dominante (X o Z) para empujar perpendicularmente a la pared.
        // Esto evita que los sprites se desplacen en diagonal o hacia abajo.
        const dirToCenter = new THREE.Vector3().subVectors(finalRoomCenter, entry.worldPos);
        if (Math.abs(dirToCenter.x) > Math.abs(dirToCenter.z)) {
          dirToCenter.z = 0;
        } else {
          dirToCenter.x = 0;
        }
        dirToCenter.y = 0;
        dirToCenter.normalize();

        sprite.position.copy(entry.worldPos).addScaledVector(dirToCenter, 0.08);
        sprite.scale.set(0.25, 0.25, 1);

        scene.add(sprite);
        entry.glowSprite = sprite;
      });

      // Crear 3 PointLights tenues distribuidos a lo largo del abecedario
      const indicesToUse = [4, 12, 20];
      indicesToUse.forEach((idx) => {
        const bulb = alphabetBulbs[idx];
        if (bulb) {
          const color = getBulbNodeColor(bulb.node);
          const pl = new THREE.PointLight(color.clone(), 0.3, 5.0, 1.5);

          // Mismo offset perpendicular para los PointLights
          const dirToCenter = new THREE.Vector3().subVectors(finalRoomCenter, bulb.worldPos);
          if (Math.abs(dirToCenter.x) > Math.abs(dirToCenter.z)) {
            dirToCenter.z = 0;
          } else {
            dirToCenter.x = 0;
          }
          dirToCenter.y = 0;
          dirToCenter.normalize();

          pl.position.copy(bulb.worldPos).addScaledVector(dirToCenter, 0.15);

          scene.add(pl);
          wallPointLights.push(pl);
        }
      });

      // --- 4. RELOCALIZACIÓN DE LUCES (Relativas a la sala) ---
      redLight.position.set(finalRoomBox.min.x + 1, finalRoomBox.max.y - 0.5, finalRoomCenter.z);
      orangeLight.position.set(finalRoomBox.max.x - 1, finalRoomBox.max.y - 0.5, finalRoomCenter.z);

      const wallZ = finalRoomBox.min.z + finalRoomSize.z * 0.02;
      const lightY = finalRoomCenter.y + finalRoomSize.y * 0.08;

      xmasLights.forEach((light) => {
        light.position.y = lightY;
        light.position.z = wallZ + 0.15;
        light.userData.active = true;
      });

      // FIX PARED NEGRA: Añadir textura de madera abajo y tapiz arriba en la pared trasera
      const textureLoader = new THREE.TextureLoader();

      const woodHeight = 0.80; // Ajustado para coincidir con la altura de la madera de las otras paredes
      const woodY = finalRoomBox.min.y + (woodHeight / 2);

      const woodTex = textureLoader.load('/models/stranger_things_room/textures/wood-planks_baseColor.jpeg');
      woodTex.wrapS = THREE.RepeatWrapping;
      woodTex.wrapT = THREE.RepeatWrapping;
      woodTex.repeat.set(4, 1);
      woodTex.colorSpace = THREE.SRGBColorSpace;

      const woodMat = new THREE.MeshStandardMaterial({
        map: woodTex,
        color: new THREE.Color(0xffffff).multiplyScalar(0.62),
        roughness: 1.0,
        metalness: 0.0,
        side: THREE.DoubleSide
      });
      const woodThickness = 0.04; // 4cm de grosor para darle el relieve
      const woodPlane = new THREE.Mesh(new THREE.BoxGeometry(finalRoomSize.x, woodHeight, woodThickness), woodMat);
      // Lo posicionamos para que su cara trasera toque el tapiz
      woodPlane.position.set(finalRoomCenter.x, woodY, finalRoomBox.max.z - 0.05 - (woodThickness / 2));
      woodPlane.rotation.y = Math.PI;
      scene.add(woodPlane);
      sceneAuxObjects.push(woodPlane);

      // Separador negro (Moldura) para que empate perfectamente con el bisel de las otras paredes
      const separatorHeight = 0.02;
      const separatorMat = new THREE.MeshStandardMaterial({ color: 0x080808, roughness: 1.0, metalness: 0.0 });
      const separatorPlane = new THREE.Mesh(new THREE.BoxGeometry(finalRoomSize.x, separatorHeight, woodThickness + 0.01), separatorMat);
      separatorPlane.position.set(finalRoomCenter.x, finalRoomBox.min.y + woodHeight + (separatorHeight / 2), finalRoomBox.max.z - 0.05 - (woodThickness / 2));
      scene.add(separatorPlane);
      sceneAuxObjects.push(separatorPlane);

      const wallpaperHeight = finalRoomSize.y - woodHeight;
      const wallpaperY = finalRoomBox.min.y + woodHeight + (wallpaperHeight / 2);

      const wallTex = textureLoader.load('/models/stranger_things_room/textures/wall_texture_baseColor.jpeg');
      wallTex.wrapS = THREE.RepeatWrapping;
      wallTex.wrapT = THREE.RepeatWrapping;
      wallTex.repeat.set(4, 1.5);
      wallTex.colorSpace = THREE.SRGBColorSpace;

      const wallMat = new THREE.MeshStandardMaterial({
        map: wallTex,
        color: new THREE.Color(0xffffff).multiplyScalar(0.62),
        roughness: 1.0,
        metalness: 0.0,
        side: THREE.DoubleSide
      });
      const backWallPlane = new THREE.Mesh(new THREE.PlaneGeometry(finalRoomSize.x, wallpaperHeight), wallMat);
      backWallPlane.position.set(finalRoomCenter.x, wallpaperY, finalRoomBox.max.z - 0.05);
      backWallPlane.rotation.y = Math.PI;
      scene.add(backWallPlane);
      sceneAuxObjects.push(backWallPlane);

      // --- 5. FÍSICAS PERIMETRALES (La Prisión) ---
      const w = finalRoomSize.x;
      const h = finalRoomSize.y;
      const d = finalRoomSize.z;
      const t = 1.0; // Paredes invisibles de 1 metro de grosor para que la esfera no escape

      createStaticBox(physicsWorld, w, t, d, { x: finalRoomCenter.x, y: finalRoomBox.min.y - t / 2, z: finalRoomCenter.z }); // Suelo
      createStaticBox(physicsWorld, w, t, d, { x: finalRoomCenter.x, y: finalRoomBox.max.y + t / 2, z: finalRoomCenter.z }); // Techo
      createStaticBox(physicsWorld, t, h, d, { x: finalRoomBox.min.x - t / 2, y: finalRoomCenter.y, z: finalRoomCenter.z }); // Pared Izq
      createStaticBox(physicsWorld, t, h, d, { x: finalRoomBox.max.x + t / 2, y: finalRoomCenter.y, z: finalRoomCenter.z }); // Pared Der
      createStaticBox(physicsWorld, w, h, t, { x: finalRoomCenter.x, y: finalRoomCenter.y, z: finalRoomBox.min.z - t / 2 }); // Frente
      createStaticBox(physicsWorld, w, h, t, { x: finalRoomCenter.x, y: finalRoomCenter.y, z: finalRoomBox.max.z + t / 2 }); // Atrás

      // --- 6. SPAWN SEGURO DEL JUGADOR (con raycast al piso real) ---
      // Disparamos un rayo hacia abajo desde el techo para encontrar la superficie del suelo
      // y hacer spawn exactamente sobre ella, evitando aterrizar encima de muebles.
      const raycaster = new THREE.Raycaster();
      const rayOrigin = new THREE.Vector3(finalRoomCenter.x, finalRoomBox.max.y, finalRoomCenter.z);
      raycaster.set(rayOrigin, new THREE.Vector3(0, -1, 0));
      const hits = raycaster.intersectObject(model, true);
      // El piso es la superficie con normal apuntando hacia arriba más cercana al min.y
      let spawnY = finalRoomBox.min.y + player.radius + 0.1;
      for (const hit of hits) {
        const worldNormal = hit.face.normal.clone()
          .transformDirection(hit.object.matrixWorld);
        if (worldNormal.y > 0.7 && Math.abs(hit.point.y - finalRoomBox.min.y) < finalRoomSize.y * 0.25) {
          spawnY = hit.point.y + player.radius + 0.05;
          break;
        }
      }
      player.setPosition(finalRoomCenter.x, spawnY, finalRoomCenter.z);

      createUpsideDownParticles(scene, finalRoomCenter, finalRoomSize);

      // Cargar raíces del Upside Down
      rootsGroup = new THREE.Group();
      rootsGroup.visible = isUpsideDownActive;
      scene.add(rootsGroup);

      if (!rootViscousTexture) {
        rootViscousTexture = new THREE.TextureLoader(loadingManager).load('/models/Tunel/texture/text_tunel.jpeg');
        rootViscousTexture.colorSpace = THREE.SRGBColorSpace;
        rootViscousTexture.wrapS = THREE.RepeatWrapping;
        rootViscousTexture.wrapT = THREE.RepeatWrapping;
        rootViscousTexture.repeat.set(1, 3);
      }

      assetCache.loadGLTF('/models/root.glb', loadingManager).then((rootGltf) => {
        const baseRoot = rootGltf.scene;
        
        baseRoot.traverse((child) => {
          if (child.isMesh) {
            const oldMat = Array.isArray(child.material) ? child.material[0] : child.material;
            const newMat = oldMat ? oldMat.clone() : new THREE.MeshStandardMaterial();
            
            newMat.map = rootViscousTexture;
            newMat.color = new THREE.Color(0xffffff);
            newMat.emissive = new THREE.Color(0x0a1a3a);
            newMat.emissiveIntensity = 0.25;
            newMat.roughness = 0.25;
            newMat.metalness = 0.0;
            newMat.side = THREE.DoubleSide;
            newMat.needsUpdate = true;
            
            child.material = newMat;
            child.castShadow = ENABLE_SHADOWS;
            child.receiveShadow = ENABLE_SHADOWS;
          }
        });

        const rootBox = new THREE.Box3().setFromObject(baseRoot);
        const sizeVec = rootBox.getSize(new THREE.Vector3());
        const rootSize = Math.max(sizeVec.x, sizeVec.y, sizeVec.z) || 1.0;
        const baseScale = 1.2 / rootSize; // un poco más pequeñas para el cuarto

        const validMeshes = [];
        model.traverse((child) => {
          if (child.isMesh && child.visible) {
            const name = child.name.toLowerCase();
            if (!name.includes('collider') && !name.includes('box') && !name.includes('glass') && !name.includes('light')) {
              validMeshes.push(child);
            }
          }
        });

        const raycaster = new THREE.Raycaster();
        let placed = 0;
        let attempts = 0;
        const maxRoots = 80;
        
        while (placed < maxRoots && attempts < 1000) {
          attempts++;
          const rx = finalRoomCenter.x + (Math.random() - 0.5) * finalRoomSize.x * 0.9;
          const ry = finalRoomCenter.y + (Math.random() - 0.5) * finalRoomSize.y * 0.9;
          const rz = finalRoomCenter.z + (Math.random() - 0.5) * finalRoomSize.z * 0.9;
          
          const dir = new THREE.Vector3(
            (Math.random() - 0.5) * 2.0,
            (Math.random() - 0.5) * 2.0,
            (Math.random() - 0.5) * 2.0
          ).normalize();
          
          raycaster.set(new THREE.Vector3(rx, ry, rz), dir);
          const hits = raycaster.intersectObjects(validMeshes, true);
          
          if (hits.length > 0) {
            const hit = hits[0];
            
            if (hit.face) {
              const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
              
              // Si la normal apunta hacia abajo (es un techo), ignoramos y probamos de nuevo
              if (normal.y < -0.5) continue;

              const rootClone = baseRoot.clone();
              
              const scaleVariation = Math.random() * 0.8 + 0.5;
              rootClone.scale.setScalar(baseScale * scaleVariation);
              rootClone.position.copy(hit.point);

              if (normal.y > 0.8) {
                rootClone.rotation.y = Math.random() * Math.PI * 2;
              } else {
                const target = new THREE.Vector3().copy(hit.point).add(normal);
                rootClone.lookAt(target);
                rootClone.rotateX(Math.PI / 2);
                rootClone.rotateY(Math.random() * Math.PI * 2);
              }
              rootsGroup.add(rootClone);
              placed++;
            }
          }
        }
      });

      // Aplicar el estado global de Upside Down a la escena
      applyUpsideDownState();

      setMainSceneReady();
      eventBus.emit('sceneReady', { sceneId: 'scene1' });
      setFloatingHelp('<b>Scene 1: The Anomaly</b><br><br><b>Controls:</b><br>- Click to enter<br>- WASD to move<br><br><b>Hints:</b><br>- Press ESC to unlock pointer<br>- The alphabet wall is waiting. Spell the word that describes what you need to escape...?');
      setHelpText('');
    }
  ).catch((error) => {
    console.error(error);
    setHelpText('Failed to load room model.');
  });
}

export function updateScene1(time, player, dt) {
  // Animar los materiales de los foquitos de navidad directamente
  const uniqueMats = new Set();
  alphabetBulbs.forEach(b => {
    if (b.node && b.node.material) uniqueMats.add(b.node.material);
  });

  uniqueMats.forEach(mat => {
    if (!mat.userData.baseColor) {
      mat.userData.baseColor = mat.color.clone();
    }
    if (isUpsideDownActive) {
      // Destello fuerte y pulsante (fuente de energía)
      const pulse = 4.0 + 2.0 * Math.sin(time * 3.5 + mat.id);
      mat.color.copy(mat.userData.baseColor).multiplyScalar(pulse);
    } else {
      mat.color.copy(mat.userData.baseColor);
    }
  });

  // Animar suavemente los PointLights de las letras iluminadas (pulso sutil)
  activeLights.forEach((light, i) => {
    light.intensity = 6.0 + 2.0 * Math.sin(time * 4.0 + i * 1.5);
  });

  // Animación de sprites de brillo difuso
  alphabetBulbs.forEach(entry => {
    if (!entry.glowSprite) return;

    const isIlluminatedLetter = entry.pointLight !== null;

    if (isUpsideDownActive) {
      // Upside Down: Destellos intensos de energía pulsante
      const pulse = Math.sin(time * 5.0 + entry.index) * 0.5 + 0.5; // 0.0 a 1.0
      const currentScale = 0.35 + pulse * 0.25;
      entry.glowSprite.scale.set(currentScale, currentScale, 1);
      entry.glowSprite.material.opacity = 0.6 + pulse * 0.4;
    } else if (isIlluminatedLetter) {
      // Letra iluminada (escribiendo HELP): Destello brillante y rápido
      const pulse = Math.sin(time * 8.0) * 0.5 + 0.5;
      const currentScale = 0.45 + pulse * 0.15;
      entry.glowSprite.scale.set(currentScale, currentScale, 1);
      entry.glowSprite.material.opacity = 0.9 + pulse * 0.1;
    } else {
      // Modo Normal: Respiración tenue y acogedora
      const breath = Math.sin(time * 1.5 + entry.index) * 0.5 + 0.5;
      const currentScale = 0.22 + breath * 0.06;
      entry.glowSprite.scale.set(currentScale, currentScale, 1);
      entry.glowSprite.material.opacity = 0.3 + breath * 0.15;
    }
  });

  // Animar los 3 PointLights de la pared
  wallPointLights.forEach((light, i) => {
    if (isUpsideDownActive) {
      // Pulso dinámico de alta intensidad, tiñendo el ambiente de azul/violeta/color original
      const pulse = Math.sin(time * 4.0 + i * 1.5) * 0.5 + 0.5;
      light.intensity = 2.0 + pulse * 3.0; // 2.0 a 5.0

      if (!light.userData.baseColor) {
        light.userData.baseColor = light.color.clone();
      }
      const udColor = new THREE.Color(0x0033ff).lerp(light.userData.baseColor, 0.4);
      light.color.copy(udColor);
    } else {
      // Modo Normal: Luz cálida tenue estática
      light.intensity = 0.3;
      if (light.userData.baseColor) {
        light.color.copy(light.userData.baseColor);
      }
    }
  });

  // Actualizar la secuencia cinemática del portal (si está activa)
  updatePortalSequence(time, dt);

  // Controlar linterna Upside Down
  if (isUpsideDownActive) {
    if (player && player.flashlight && player.flashlightEnabled) {
      player.flashlight.intensity = 20.0;
    }
  } else {
    if (player && player.flashlight && player.flashlightEnabled) {
      player.flashlight.intensity = 10.0;
    }
  }

  // Animación de partículas Upside Down
  if (upsideDownParticles && upsideDownParticleGeometry && upsideDownParticleMaterial) {
    const positions = upsideDownParticleGeometry.attributes.position.array;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const posOffset = i * 3;
      const motionOffset = i * 4;
      const baseX = upsideDownParticleBasePositions[posOffset];
      const baseY = upsideDownParticleBasePositions[posOffset + 1];
      const baseZ = upsideDownParticleBasePositions[posOffset + 2];
      const phase = upsideDownParticleMotion[motionOffset];
      const speed = upsideDownParticleMotion[motionOffset + 1];
      const swayX = upsideDownParticleMotion[motionOffset + 2];
      const swayY = upsideDownParticleMotion[motionOffset + 3];

      positions[posOffset] = baseX + Math.sin(time * speed + phase) * swayX;
      positions[posOffset + 1] = baseY + Math.cos(time * speed * 1.15 + phase * 1.7) * swayY;
      positions[posOffset + 2] = baseZ + Math.sin(time * speed * 0.7 + phase * 0.6) * swayX;
    }

    upsideDownParticleGeometry.attributes.position.needsUpdate = true;

    const targetOpacity = isUpsideDownActive ? 0.3 : 0.0;
    upsideDownParticleMaterial.opacity = THREE.MathUtils.lerp(
      upsideDownParticleMaterial.opacity,
      targetOpacity,
      0.05
    );
    upsideDownParticles.visible = upsideDownParticleMaterial.opacity > 0.01;
  }

  if (isUpsideDownActive && rootViscousTexture && dt) {
    rootViscousTexture.offset.y -= dt * 0.15;
  }
}