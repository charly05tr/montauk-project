import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { loadingManager, setMainSceneReady } from '../../ui/Loading/index.js';
import { setHelpText } from '../../ui/Overlay/index.js';
import { ENABLE_SHADOWS } from '../../utils/constants.js';
import { getMaterialName, tuneRoomMaterial, isRoomSurfaceMaterial } from './objects.js';
import { createStaticBox, createBoxFromMesh, createTrimeshFromMesh } from '../../physics/Collider.js';

export const xmasLights = [];
let redLight, orangeLight;

export function loadRoom(scene, physicsWorld, player) {
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
      const finalRoomBox = new THREE.Box3().setFromObject(model);
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

        // FIX: Ajuste de ignorar objetos pequeños. 
        // 0.5m (50cm) que puso la IA era enorme. Ignoramos cualquier cosa menor a 15cm
        // para que no se generen físicas para tazas, revistas o controles remotos.
        if (childSize.x < 0.15 && childSize.y < 0.15 && childSize.z < 0.15) return;
        // Ignoramos alfombras y pósters planos
        if (childSize.y < 0.02) return;

        createBoxFromMesh(physicsWorld, child);
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
      setHelpText('Click para entrar | WASD moverte | Esc salir');
    },
    undefined,
    (error) => {
      console.error(error);
      setHelpText('No se pudo cargar el modelo de la sala.');
    }
  );
}

export function updateScene1(time) {
  xmasLights.forEach((light) => {
    if (!light.userData.active) return;
    light.intensity = light.userData.baseIntensity * (0.75 + 0.25 * Math.sin(time * 3.5 + light.userData.phase));
  });
}