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
  alphabetBulbs.length = 0;
  // Limpiar objetos del portal si existían
  cleanupPortalSequence();

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

    if (i === 17) {
      const offsetVisualDerecha = 0.15; // 15cm
      const offsetHaciaAbajo = 0.04;   // -1cm

      bulb.node.position.z += offsetVisualDerecha;
      bulb.node.position.y += offsetHaciaAbajo;

      bulb.node.updateMatrixWorld(true);
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

export function loadRoom(scene, physicsWorld, player, sceneManager) {
  sceneManagerInstance = sceneManager;
  activePlayer = player;
  activePhysicsWorld = physicsWorld;
  activeScene = scene;
  cleanupAlphabetState();

  // Registrar listeners de interacción con bombillas
  window.addEventListener('pointerdown', onBulbPointerDown);
  window.addEventListener('pointerup', onBulbPointerUp);

  // Luces Base (La posición se ajustará matemáticamente después de cargar la sala)
  redLight = new THREE.PointLight(0xff2a12, 0.05, 20, 2)
  redLight.position.set(-3, 5, 1)
  scene.add(redLight)

  orangeLight = new THREE.PointLight(0xff6a18, 0.05, 20, 2)
  orangeLight.position.set(2.5, 3.75, -2.5)
  scene.add(orangeLight)

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

      setMainSceneReady();
      eventBus.emit('sceneReady', { sceneId: 'scene1' });
      setFloatingHelp('<b>Scene 1: The Anomaly</b><br><br><b>Controls:</b><br>- Click to enter<br>- WASD to move<br><br><b>Exit:</b><br>- Press ESC to unlock pointer<br>- Type "HELP" to teleport');
      setHelpText('');
    }
  ).catch((error) => {
    console.error(error);
    setHelpText('Failed to load room model.');
  });
}

export function updateScene1(time, player, dt) {
  xmasLights.forEach((light) => {
    if (!light.userData.active) return;
    light.intensity = light.userData.baseIntensity * (0.75 + 0.25 * Math.sin(time * 3.5 + light.userData.phase));
  });

  // Animar suavemente los PointLights de las letras iluminadas (pulso sutil)
  activeLights.forEach((light, i) => {
    light.intensity = 6.0 + 2.0 * Math.sin(time * 4.0 + i * 1.5);
  });

  // Actualizar la secuencia cinemática del portal (si está activa)
  updatePortalSequence(time, dt);
}