import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { loadingManager, setMainSceneReady } from '../../ui/Loading/index.js';
import { setHelpText } from '../../ui/Overlay/index.js';
import { ENABLE_SHADOWS } from '../../utils/constants.js';
import { getMaterialName, tuneHospitalMaterial } from './objects.js';
import { createStaticBox, createBoxFromMesh, createTrimeshFromMesh } from '../../physics/Collider.js';
import { soundManager } from '../../core/SoundManager.js';

export let whiteLight1, whiteLight2, flashAmbient;
let isFlickeringActive = false;
let listenerAdded = false;

export function loadRoomScene2(scene, physicsWorld, player) {
  // Luces Base (La posición se ajustará matemáticamente después de cargar la sala)

  flashAmbient = new THREE.AmbientLight(0xffffff, 0.0); // Luz ambiental apagada normalmente
  scene.add(flashAmbient);

  whiteLight1 = new THREE.PointLight(0xffffff, 0.8, 60, 1.5);
  whiteLight1.position.set(-3, 5, 1);
  scene.add(whiteLight1);

  whiteLight2 = new THREE.PointLight(0xffffff, 0.6, 60, 1.5);
  whiteLight2.position.set(2.5, 3.75, -2.5);
  scene.add(whiteLight2);

  if (!listenerAdded) {
    window.addEventListener('keydown', (e) => {
      if (e.key.toLowerCase() === 'l') {
        isFlickeringActive = !isFlickeringActive;
      }
    });
    listenerAdded = true;
  }

  const gltfLoader = new GLTFLoader(loadingManager);

  gltfLoader.load(
    '/models/Velez_Paiz.glb',
    (gltf) => {
      const model = gltf.scene;

      // --- 1. ESCALA DINÁMICA ---
      // Calculamos el tamaño original "crudo" que trae el modelo
      const initialBox = new THREE.Box3().setFromObject(model);
      const rawHeight = initialBox.getSize(new THREE.Vector3()).y;

      // Forzamos que la altura del pasillo sea ~3.2 metros (altura estándar comercial)
      const targetHeight = 3.2;
      const scaleFactor = targetHeight / rawHeight;
      model.scale.setScalar(scaleFactor);
      model.updateMatrixWorld(true);

      // Play audio
      soundManager.playAmbient('hospital_ambient', '/sounds/scene2.mp3', true, 0.4);

      // --- 2. CENTRADO ABSOLUTO ---
      const scaledBox = new THREE.Box3().setFromObject(model);
      const center = scaledBox.getCenter(new THREE.Vector3());

      model.position.x -= center.x;
      model.position.y -= center.y;
      model.position.z -= center.z;
      model.updateMatrixWorld(true);

      scene.add(model);

      // Caja definitiva para armar las paredes y físicas perimetrales
      const finalRoomBox = new THREE.Box3().setFromObject(model);
      const finalRoomSize = finalRoomBox.getSize(new THREE.Vector3());
      const finalRoomCenter = finalRoomBox.getCenter(new THREE.Vector3());

      // --- 3. EXTRACCIÓN DE MATERIALES Y COLISIONES ---
      model.traverse((child) => {
        if (!child.isMesh) return;

        const nodeName = child.name.toLowerCase();

        // Aplicar el material refactorizado (que usa el caché para no saturar la GPU)
        child.material = Array.isArray(child.material)
          ? child.material.map(tuneHospitalMaterial)
          : tuneHospitalMaterial(child.material);

        child.frustumCulled = true;
        child.castShadow = ENABLE_SHADOWS;
        child.receiveShadow = ENABLE_SHADOWS;

        // Ignoramos suelos, techos, luces y cristales transparentes para la generación de físicas individuales,
        // ya que los suelos/techos tendrán físicas perimetrales globales y los cristales/luces no deben bloquear.
        if (
          nodeName.includes('floor') ||
          nodeName.includes('roof') ||
          nodeName.includes('ceiling') ||
          nodeName.includes('light') ||
          nodeName.includes('lamp') ||
          nodeName.includes('cartel') ||
          nodeName.includes('glass')
        ) {
          return;
        }

        const childBox = new THREE.Box3().setFromObject(child);
        const childSize = childBox.getSize(new THREE.Vector3());

        // Ignoramos objetos extremadamente pequeños (menos de 15cm) o muy planos (menos de 5cm de alto)
        if (childSize.x < 0.15 && childSize.y < 0.15 && childSize.z < 0.15) return;
        if (childSize.y < 0.05) return;

        // Generación heurística de colisionadores
        if (nodeName.includes('wall') || nodeName.includes('door') || nodeName.includes('bar') || nodeName.includes('edge')) {
          if (childSize.x < 1.5 || childSize.z < 1.5) {
            createBoxFromMesh(physicsWorld, child);
          } else {
            createTrimeshFromMesh(physicsWorld, child);
          }
        } else {
          createBoxFromMesh(physicsWorld, child);
        }
      });

      // --- 4. RELOCALIZACIÓN DE LUCES (Relativas a la sala) ---
      // Movemos las luces al centro del pasillo para asegurarnos de que no queden detrás de las paredes
      whiteLight1.position.set(finalRoomCenter.x, finalRoomBox.max.y - 0.5, finalRoomCenter.z - 5);
      whiteLight2.position.set(finalRoomCenter.x, finalRoomBox.max.y - 0.5, finalRoomCenter.z + 5);

      // --- 5. FÍSICAS PERIMETRALES ---
      const w = finalRoomSize.x;
      const h = finalRoomSize.y;
      const d = finalRoomSize.z;
      const t = 1.0; // Espesor de las paredes invisibles

      createStaticBox(physicsWorld, w, t, d, { x: finalRoomCenter.x, y: finalRoomBox.min.y - t / 2, z: finalRoomCenter.z }); // Suelo
      createStaticBox(physicsWorld, w, t, d, { x: finalRoomCenter.x, y: finalRoomBox.max.y + t / 2, z: finalRoomCenter.z }); // Techo
      createStaticBox(physicsWorld, t, h, d, { x: finalRoomBox.min.x - t / 2, y: finalRoomCenter.y, z: finalRoomCenter.z }); // Pared Izq
      createStaticBox(physicsWorld, t, h, d, { x: finalRoomBox.max.x + t / 2, y: finalRoomCenter.y, z: finalRoomCenter.z }); // Pared Der
      createStaticBox(physicsWorld, w, h, t, { x: finalRoomCenter.x, y: finalRoomCenter.y, z: finalRoomBox.min.z - t / 2 }); // Frente
      createStaticBox(physicsWorld, w, h, t, { x: finalRoomCenter.x, y: finalRoomCenter.y, z: finalRoomBox.max.z + t / 2 }); // Atrás

      // --- 6. SPAWN SEGURO DEL JUGADOR ---
      // Spawn en el centro X/Z, y a 2 metros de altura sobre el suelo absoluto para evitar hundirse
      player.setPosition(finalRoomCenter.x, finalRoomBox.min.y + 2.0, finalRoomCenter.z);

      setMainSceneReady();
      setHelpText('Escena 2: Hospital | Click para entrar | WASD moverte | Escribe "HELP" para volver');
    },
    undefined,
    (error) => {
      console.error(error);
      setHelpText('No se pudo cargar el modelo del hospital.');
    }
  );
}

export function updateScene2(time) {
  // Efecto masivo estilo Demogorgon
  if (isFlickeringActive) {
    const randomVal = Math.random();
    const isMajorFlash = randomVal > 0.8;
    const isPitchBlack = randomVal < 0.4;
    
    // Parpadeo ambiental para iluminar todo el pasillo de golpe
    if (flashAmbient) {
      flashAmbient.intensity = isMajorFlash ? (Math.random() * 0.8 + 0.5) : 0.0;
    }

    if (whiteLight1) {
      if (isPitchBlack) whiteLight1.intensity = 0.0;
      else if (isMajorFlash) whiteLight1.intensity = Math.random() * 3.0 + 1.0;
      else whiteLight1.intensity = 0.3;
    }

    if (whiteLight2) {
      if (isPitchBlack) whiteLight2.intensity = 0.0;
      else if (isMajorFlash) whiteLight2.intensity = Math.random() * 3.0 + 1.0;
      else whiteLight2.intensity = 0.3;
    }
  } else {
    // Estado normal: Luz ambiental apagada, luces de punto con pulso suave
    if (flashAmbient) flashAmbient.intensity = 0.0;
    
    if (whiteLight1) {
      whiteLight1.intensity = 0.8 * (0.8 + 0.2 * Math.sin(time * 4.0));
    }
    if (whiteLight2) {
      whiteLight2.intensity = 0.6 * (0.8 + 0.2 * Math.cos(time * 3.0));
    }
  }
}
