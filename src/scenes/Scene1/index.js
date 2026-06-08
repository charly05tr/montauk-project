import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { loadingManager, setMainSceneReady } from '../../ui/Loading/index.js';
import { setHelpText, setFloatingHelp } from '../../ui/Overlay/index.js';
import { ENABLE_SHADOWS } from '../../utils/constants.js';
import { getMaterialName, tuneRoomMaterial, isRoomSurfaceMaterial, xmasBulbMaterialNames } from './objects.js';
import { createStaticBox, createBoxFromMesh, createTrimeshFromMesh } from '../../physics/Collider.js';
import { eventBus } from '../../utils/eventBus.js';
import { soundManager } from '../../core/SoundManager.js';

let sceneManagerInstance = null;
import('../../core/SceneManager.js').then(({ sceneManager }) => {
  sceneManagerInstance = sceneManager;
});

export const xmasLights = [];
let redLight, orangeLight;
let activePlayer = null;
let activePhysicsWorld = null;
let finalRoomBox = null;

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
  l: 0xffe05a,  // Amarillo cálido
  p: 0xff2514,  // Rojo intenso
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
  alphabetBulbs.length = 0;
}

/**
 * Recolecta los nodos de los foquitos del árbol de navidad del modelo,
 * los ordena espacialmente (3 filas, izquierda a derecha) y los asigna a letras A-Z.
 */
function collectAndMapBulbs(model) {
  alphabetBulbs.length = 0;
  const bulbParents = [];

  // 1. Recolectar todos los nodos "Plane" que son los foquitos
  model.traverse((child) => {
    if (!child.name || !child.name.startsWith('Plane')) return;
    // Obtener la posición mundial del foquito
    const worldPos = new THREE.Vector3();
    child.getWorldPosition(worldPos);
    bulbParents.push({ node: child, worldPos });
  });

  if (bulbParents.length === 0) return;

  // 2. Separar en filas usando el eje Y (altura)
  // Ordenar por Y descendente para obtener las filas de arriba a abajo
  bulbParents.sort((a, b) => b.worldPos.y - a.worldPos.y);

  // Usar clustering simple por Y para identificar filas
  const rows = [];
  let currentRow = [bulbParents[0]];
  const ROW_THRESHOLD = 0.15; // Si la diferencia en Y es menor a 15cm, misma fila

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

  // 3. Dentro de cada fila, ordenar por Z (eje lateral de la pared)
  // En este modelo, los foquitos están en la pared Z-negativo,
  // así que Z más negativo = izquierda visual del jugador
  rows.forEach(row => {
    row.sort((a, b) => a.worldPos.z - b.worldPos.z);
  });

  // 4. Aplanar las filas y tomar los primeros 26 para A-Z
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  const flatBulbs = rows.flat();

  for (let i = 0; i < Math.min(26, flatBulbs.length); i++) {
    const bulb = flatBulbs[i];
    alphabetBulbs.push({
      node: bulb.node,
      worldPos: bulb.worldPos.clone(),
      letter: alphabet[i],
      pointLight: null, // Se crea cuando se ilumina
    });
  }

  console.log(`[ABECEDARIO] Mapeados ${alphabetBulbs.length} foquitos a letras:`,
    alphabetBulbs.map(b => b.letter.toUpperCase()).join(' '));
}

/**
 * Ilumina el foquito correspondiente a una letra específica.
 */
function illuminateLetter(letter, scene) {
  const entry = alphabetBulbs.find(b => b.letter === letter.toLowerCase());
  if (!entry) return;

  // Si ya tiene luz, no crear otra
  if (entry.pointLight) return;

  const color = LETTER_LIGHT_COLORS[letter.toLowerCase()] || DEFAULT_LIGHT_COLOR;

  // Crear PointLight brillante en la posición del foquito
  const light = new THREE.PointLight(color, 8.0, 4.0, 1.5);
  light.position.copy(entry.worldPos);
  scene.add(light);

  entry.pointLight = light;
  activeLights.push(light);

  // También hacer que el mesh del foquito brille (cambiar el material del hijo coloreado)
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
    soundManager.playAmbient('phone', '/sounds/phone_ringing.mp3', false, ringVol);

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

      // Esperar un momento dramático antes de la transición
      setTimeout(() => {
        if (sceneManagerInstance && activePhysicsWorld && activePlayer) {
          soundManager.stopAmbient('phone');
          soundManager.playDoorOpenSound();
          sceneManagerInstance.switchSceneWithTransition('scene3', activePhysicsWorld, activePlayer);
        }
      }, 1500);
    }
  } else {
    // Si tenía letras correctas y se equivocó, reproducir un timbrado fuerte como jump scare
    if (helpBuffer.length > 0) {
      soundManager.stopAmbient('phone');
      soundManager.playAmbient('phone', '/sounds/phone_ringing.mp3', false, 1.2);
    }

    // Letra incorrecta: reiniciar el progreso y apagar las luces
    helpBuffer = '';
    activeLights.forEach(light => {
      if (light.parent) light.parent.remove(light);
    });
    activeLights.length = 0;
    alphabetBulbs.forEach(b => { b.pointLight = null; });
    setFloatingHelp('<b>Scene: The Anomaly (Joyce Byers`s House)</b><br><br><b>Controls:</b><br>- Click to enter<br>- WASD to move<br><br><b>Exit:</b><br>- Press ESC to unlock pointer<br>- Type "HELP" to teleport');
    setHelpText('');
  }
}

// Registrar el listener global (se activa sólo cuando estamos en Scene 1)
window.addEventListener('keydown', onAlphabetKeyDown);

export function loadRoom(scene, physicsWorld, player) {
  activePlayer = player;
  activePhysicsWorld = physicsWorld;
  activeScene = scene;
  cleanupAlphabetState();

  // Luces Base (La posición se ajustará matemáticamente después de cargar la sala)
  redLight = new THREE.PointLight(0xff2a12, 0.05, 20, 2)
  redLight.position.set(-3, 5, 1)
  scene.add(redLight)

  orangeLight = new THREE.PointLight(0xff6a18, 0.05, 20, 2)
  orangeLight.position.set(2.5, 3.75, -2.5)
  scene.add(orangeLight)

  const gltfLoader = new GLTFLoader(loadingManager);

  gltfLoader.load(
    '/models/stranger_things_room/scene.gltf',
    (gltf) => {
      const model = gltf.scene;

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

      scene.add(model);

      // Caja definitiva para armar las paredes y físicas perimetrales
      finalRoomBox = new THREE.Box3().setFromObject(model);
      const finalRoomSize = finalRoomBox.getSize(new THREE.Vector3());
      const finalRoomCenter = finalRoomBox.getCenter(new THREE.Vector3());

      // --- 3. EXTRACCIÓN DE MATERIALES Y COLISIONES ---
      model.traverse((child) => {
        if (!child.isMesh) return;

        const materialName = getMaterialName(child.material);

        // Aplicar el material refactorizado (que usa el caché para no matar la GPU)
        child.material = Array.isArray(child.material)
          ? child.material.map(tuneRoomMaterial)
          : tuneRoomMaterial(child.material);

        child.frustumCulled = !isRoomSurfaceMaterial(materialName);
        child.castShadow = ENABLE_SHADOWS;
        child.receiveShadow = ENABLE_SHADOWS;

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

        const childBox = new THREE.Box3().setFromObject(child);
        const childSize = childBox.getSize(new THREE.Vector3());

        // FIX: Ajuste para ignorar objetos que generan fricción en el piso.
        // Ignoramos todo lo que tenga menos de 30cm de altura (zapatos, libros, cajas pequeñas)
        // para que el jugador pueda caminar sobre ellos sin engancharse.
        if (childSize.y < 0.30) return;

        // También ignoramos objetos muy delgados/pequeños en volumen general
        if (childSize.x < 0.25 && childSize.z < 0.25) return;

        createBoxFromMesh(physicsWorld, child);
      });

      // --- 3.5. RECOLECTAR Y MAPEAR FOQUITOS DEL ABECEDARIO ---
      collectAndMapBulbs(model);

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

      // Separador negro (Moldura) para que empate perfectamente con el bisel de las otras paredes
      const separatorHeight = 0.02;
      const separatorMat = new THREE.MeshStandardMaterial({ color: 0x080808, roughness: 1.0, metalness: 0.0 });
      const separatorPlane = new THREE.Mesh(new THREE.BoxGeometry(finalRoomSize.x, separatorHeight, woodThickness + 0.01), separatorMat);
      separatorPlane.position.set(finalRoomCenter.x, finalRoomBox.min.y + woodHeight + (separatorHeight / 2), finalRoomBox.max.z - 0.05 - (woodThickness / 2));
      scene.add(separatorPlane);

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

      // --- 6. SPAWN SEGURO DEL JUGADOR ---
      // Spawn en el centro X/Z, y a 2 metros de altura sobre el suelo absoluto para evitar hundimientos
      player.setPosition(finalRoomCenter.x, finalRoomBox.min.y + 2.0, finalRoomCenter.z);

      setMainSceneReady();
      eventBus.emit('sceneReady', { sceneId: 'scene1' });
      setFloatingHelp('<b>Scene 1: The Anomaly</b><br><br><b>Controls:</b><br>- Click to enter<br>- WASD to move<br><br><b>Exit:</b><br>- Press ESC to unlock pointer<br>- Type "HELP" to teleport');
      setHelpText('');
    },
    undefined,
    (error) => {
      console.error(error);
      setHelpText('Failed to load room model.');
    }
  );
}

export function updateScene1(time) {
  xmasLights.forEach((light) => {
    if (!light.userData.active) return;
    light.intensity = light.userData.baseIntensity * (0.75 + 0.25 * Math.sin(time * 3.5 + light.userData.phase));
  });

  // Animar suavemente los PointLights de las letras iluminadas (pulso sutil)
  activeLights.forEach((light, i) => {
    light.intensity = 6.0 + 2.0 * Math.sin(time * 4.0 + i * 1.5);
  });
}