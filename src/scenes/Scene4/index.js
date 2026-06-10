import * as THREE from 'three';
import { assetCache } from '../../utils/AssetCache.js';
import { loadingManager, setMainSceneReady } from '../../ui/Loading/index.js';
import { setHelpText, setFloatingHelp } from '../../ui/Overlay/index.js';
import { ENABLE_SHADOWS } from '../../utils/constants.js';
import { getMaterialName, tuneSchoolMaterial } from './objects.js';
import { createStaticBox, createBoxFromMesh, createTrimeshFromMesh } from '../../physics/Collider.js';
import { soundManager } from '../../core/SoundManager.js';
import { eventBus } from '../../utils/eventBus.js';

export let redLight, orangeLight;

export function loadSchoolScene(scene, physicsWorld, player) {
  // Luces Base (La posición se ajustará matemáticamente después de cargar la sala)
  redLight = new THREE.PointLight(0xff2a12, 1.5, 20, 2);
  redLight.position.set(-3, 5, 1);
  scene.add(redLight);

  orangeLight = new THREE.PointLight(0xff6a18, 1.5, 20, 2);
  orangeLight.position.set(2.5, 3.75, -2.5);
  scene.add(orangeLight);

  assetCache.loadGLTF('/models/Escuela.glb', loadingManager).then(
    (gltf) => {
      const model = gltf.scene;

      if (!model.userData.isConfigured) {
        // --- 1. ESCALA DINÁMICA ---
        // Calculamos el tamaño original "crudo" que trae el modelo ANTES de rotarlo
        const initialBox = new THREE.Box3().setFromObject(model);
        const rawHeight = initialBox.getSize(new THREE.Vector3()).y || 1;

        // Forzamos que la altura de la escuela sea ~5.2 metros (en lugar de 3.5)
        const targetHeight = 5.2;
        const scaleFactor = targetHeight / rawHeight;
        model.scale.setScalar(scaleFactor);

        // Ahora lo rotamos
        model.rotation.x = Math.PI / 2;

        model.userData.isConfigured = true;
      }

      // Play audio
      soundManager.playAmbient('school_ambient', '/sounds/scene2.mp3', true, 0.4);

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
          ? child.material.map(tuneSchoolMaterial)
          : tuneSchoolMaterial(child.material);

        child.frustumCulled = true;
        child.castShadow = ENABLE_SHADOWS;
        child.receiveShadow = ENABLE_SHADOWS;

        // 3.1 Ignoramos suelos, techos, luces y cristales transparentes
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

        // 3.2 Ignoramos sillas, bancos, papeleras y decoración pequeña
        // Esto evita atascos y rebotes físicos bruscos que pongan de cabeza al jugador
        if (
          nodeName.includes('silla') ||
          nodeName.includes('chair') ||
          nodeName.includes('seat') ||
          nodeName.includes('asiento') ||
          nodeName.includes('stool') ||
          nodeName.includes('banco') ||
          nodeName.includes('deco') ||
          nodeName.includes('prop') ||
          nodeName.includes('basura') ||
          nodeName.includes('trash') ||
          nodeName.includes('bin') ||
          nodeName.includes('libro') ||
          nodeName.includes('book')
        ) {
          return;
        }

        const childBox = new THREE.Box3().setFromObject(child);
        const childSize = childBox.getSize(new THREE.Vector3());

        // Ignoramos objetos extremadamente pequeños (menos de 15cm) o muy planos (menos de 5cm de alto)
        if (childSize.x < 0.15 && childSize.y < 0.15 && childSize.z < 0.15) return;
        if (childSize.y < 0.05) return;

        // Para paredes/puertas estructurales, colisionador preciso
        if (nodeName.includes('wall') || nodeName.includes('door') || nodeName.includes('bar') || nodeName.includes('edge')) {
          if (childSize.x < 1.5 || childSize.z < 1.5) {
            createBoxFromMesh(physicsWorld, child);
          } else {
            createTrimeshFromMesh(physicsWorld, child);
          }
          return;
        }

        // Para muebles/props: solo crear colisionador si el AABB no es un nodo agrupado gigante.
        const footprintRatio = (childSize.x * childSize.z) / Math.max(childSize.y, 0.01);
        if (footprintRatio > 12) return;

        createBoxFromMesh(physicsWorld, child);
      });

      // --- 4. RELOCALIZACIÓN DE LUCES (Relativas a la escuela) ---
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

      // --- 6. SPAWN SEGURO DEL JUGADOR (con raycast al piso real) ---
      const raycaster4 = new THREE.Raycaster();
      const spawnOrigin4 = new THREE.Vector3(finalRoomCenter.x, finalRoomBox.max.y, finalRoomCenter.z);
      raycaster4.set(spawnOrigin4, new THREE.Vector3(0, -1, 0));
      const hits4 = raycaster4.intersectObject(model, true);
      let spawnY4 = finalRoomBox.min.y + player.radius + 0.1;
      for (const hit of hits4) {
        const worldNormal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
        if (worldNormal.y > 0.7 && Math.abs(hit.point.y - finalRoomBox.min.y) < finalRoomSize.y * 0.25) {
          spawnY4 = hit.point.y + player.radius + 0.05;
          break;
        }
      }
      player.setPosition(finalRoomCenter.x, spawnY4, finalRoomCenter.z);

      setMainSceneReady();
      eventBus.emit('sceneReady', { sceneId: 'scene4' });
      setFloatingHelp('<b>Scene: The Origins (Hawking lab`s school)</b><br><br><b>Controls:</b><br>- Click to enter<br>- WASD to move<br><br><b>Exit:</b><br>- Press ESC to unlock pointer<br>- Type "HELP" to teleport');
      setHelpText('');
    }
  ).catch((error) => {
    console.error(error);
    setHelpText('Failed to load school model.');
  });
}

export function updateScene4(time) {
  if (redLight) {
    redLight.intensity = 1.5 * (0.8 + 0.2 * Math.sin(time * 4.0));
  }
  if (orangeLight) {
    orangeLight.intensity = 1.5 * (0.8 + 0.2 * Math.cos(time * 3.0));
  }
}
