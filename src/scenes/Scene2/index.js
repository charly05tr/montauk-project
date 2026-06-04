import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { loadingManager, setMainSceneReady } from '../../ui/Loading/index.js';
import { setHelpText } from '../../ui/Overlay/index.js';
import { ENABLE_SHADOWS } from '../../utils/constants.js';
import { getMaterialName, tuneHospitalMaterial } from './objects.js';
import { createStaticBox, createBoxFromMesh, createTrimeshFromMesh } from '../../physics/Collider.js';

export let redLight, orangeLight;

export function loadRoomScene2(scene, physicsWorld, player) {
  // Luces Base (La posición se ajustará matemáticamente después de cargar la sala)
  redLight = new THREE.PointLight(0xff2a12, 0.05, 20, 2);
  redLight.position.set(-3, 5, 1);
  scene.add(redLight);

  orangeLight = new THREE.PointLight(0xff6a18, 0.05, 20, 2);
  orangeLight.position.set(2.5, 3.75, -2.5);
  scene.add(orangeLight);

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
      redLight.position.set(finalRoomBox.min.x + 1, finalRoomBox.max.y - 0.5, finalRoomCenter.z);
      orangeLight.position.set(finalRoomBox.max.x - 1, finalRoomBox.max.y - 0.5, finalRoomCenter.z);

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
  // Lógica de actualización de la escena 2 si se requiere (por ejemplo, hacer parpadear luces)
  if (redLight) {
    redLight.intensity = 0.05 * (0.8 + 0.2 * Math.sin(time * 4.0));
  }
  if (orangeLight) {
    orangeLight.intensity = 0.05 * (0.8 + 0.2 * Math.cos(time * 3.0));
  }
}
