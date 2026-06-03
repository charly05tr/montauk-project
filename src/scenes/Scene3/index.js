import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { loadingManager, setMainSceneReady } from '../../ui/Loading/index.js';
import { setHelpText } from '../../ui/Overlay/index.js';
import { ENABLE_SHADOWS } from '../../utils/constants.js';
import { createStaticBox } from '../../physics/Collider.js';

let tunnelModel = null;
const tunnelMaterials = [];
const tunnelLights = [];
let scrollTexture = null;

function prepareTunnelMaterial(material) {
  const base = Array.isArray(material) ? material[0] : material;
  if (!base) return material;

  const cloned = base.clone();

  if (scrollTexture) {
    cloned.map = scrollTexture.clone();
    cloned.map.needsUpdate = true;
    cloned.map.repeat.set(2, 4);
    cloned.map.wrapS = THREE.RepeatWrapping;
    cloned.map.wrapT = THREE.RepeatWrapping;
    cloned.map.colorSpace = THREE.SRGBColorSpace;
  }

  cloned.color?.multiplyScalar(1.05);
  if ('emissive' in cloned) {
    cloned.emissive = new THREE.Color(0x163a72);
    cloned.emissiveIntensity = 0.45;
  }
  cloned.metalness = 0.0;
  cloned.roughness = 0.92;
  cloned.side = THREE.DoubleSide;
  cloned.needsUpdate = true;

  if (cloned.map) {
    tunnelMaterials.push(cloned.map);
  }

  return cloned;
}

export function loadTunnelScene(scene, physicsWorld, player) {
  tunnelMaterials.length = 0;
  tunnelLights.length = 0;

  scene.background = new THREE.Color(0x1c3159);
  scene.fog = new THREE.Fog(0x1c3159, 22, 320);

  const ambient = new THREE.AmbientLight(0x82a6f2, 2.8);
  scene.add(ambient);

  const mainLight = new THREE.DirectionalLight(0xd7e6ff, 4.6);
  mainLight.position.set(5, 12, 8);
  scene.add(mainLight);

  const redPulse = new THREE.PointLight(0xff1848, 14, 25, 2);
  redPulse.position.set(0, 1.5, -10);
  scene.add(redPulse);
  tunnelLights.push(redPulse);

  const bluePulse = new THREE.PointLight(0x58d8ff, 8.5, 28, 2);
  bluePulse.position.set(0, 2.4, 5);
  scene.add(bluePulse);
  tunnelLights.push(bluePulse);

  const gltfLoader = new GLTFLoader(loadingManager);

  if (!scrollTexture) {
    scrollTexture = new THREE.TextureLoader(loadingManager).load('/models/Tunel/texture/text_tunel.jpeg');
    scrollTexture.colorSpace = THREE.SRGBColorSpace;
    scrollTexture.wrapS = THREE.RepeatWrapping;
    scrollTexture.wrapT = THREE.RepeatWrapping;
    scrollTexture.repeat.set(2, 4);
  }

  gltfLoader.load(
    '/models/Tunel/tunelST.glb',
    (gltf) => {
      tunnelModel = gltf.scene;

      const initialBox = new THREE.Box3().setFromObject(tunnelModel);
      const rawHeight = initialBox.getSize(new THREE.Vector3()).y || 1;
      const targetHeight = 6.0;
      const scaleFactor = targetHeight / rawHeight;

      tunnelModel.scale.setScalar(scaleFactor);
      tunnelModel.updateMatrixWorld(true);

      const scaledBox = new THREE.Box3().setFromObject(tunnelModel);
      const center = scaledBox.getCenter(new THREE.Vector3());
      tunnelModel.position.sub(center);
      tunnelModel.updateMatrixWorld(true);

      scene.add(tunnelModel);

      const finalBox = new THREE.Box3().setFromObject(tunnelModel);
      const finalSize = finalBox.getSize(new THREE.Vector3());
      const finalCenter = finalBox.getCenter(new THREE.Vector3());
      const primaryAxis = finalSize.z >= finalSize.x ? 'z' : 'x';
      const primaryMin = primaryAxis === 'z' ? finalBox.min.z : finalBox.min.x;
      const primaryMax = primaryAxis === 'z' ? finalBox.max.z : finalBox.max.x;
      const primarySize = primaryAxis === 'z' ? finalSize.z : finalSize.x;
      const tunnelHalfWidth = (primaryAxis === 'z' ? finalSize.x : finalSize.z) * 0.5;
      const corridorHalfWidth = Math.max(0.6, Math.min(1.1, tunnelHalfWidth * 0.28));

      tunnelModel.traverse((child) => {
        if (!child.isMesh) return;

        child.material = Array.isArray(child.material)
          ? child.material.map(prepareTunnelMaterial)
          : prepareTunnelMaterial(child.material);

        child.castShadow = ENABLE_SHADOWS;
        child.receiveShadow = ENABLE_SHADOWS;
        child.frustumCulled = false;
      });

      // Corredor interno lineal para que el usuario solo recorra el túnel en línea recta
      const w = finalSize.x;
      const h = finalSize.y;
      const d = finalSize.z;
      const wallThickness = 0.35;
      const corridorHeight = 2.6;
      const corridorCenterY = finalBox.min.y + corridorHeight * 0.5;
      const corridorLength = Math.max(2, primarySize - 2.0);

      if (primaryAxis === 'z') {
        createStaticBox(physicsWorld, corridorHalfWidth * 2, wallThickness, corridorLength, {
          x: finalCenter.x,
          y: finalBox.min.y - wallThickness * 0.5,
          z: finalCenter.z
        });
        createStaticBox(physicsWorld, corridorHalfWidth * 2, wallThickness, corridorLength, {
          x: finalCenter.x,
          y: finalBox.min.y + corridorHeight + wallThickness * 0.5,
          z: finalCenter.z
        });
        createStaticBox(physicsWorld, wallThickness, corridorHeight, corridorLength, {
          x: finalCenter.x - corridorHalfWidth - wallThickness * 0.5,
          y: corridorCenterY,
          z: finalCenter.z
        });
        createStaticBox(physicsWorld, wallThickness, corridorHeight, corridorLength, {
          x: finalCenter.x + corridorHalfWidth + wallThickness * 0.5,
          y: corridorCenterY,
          z: finalCenter.z
        });
        createStaticBox(physicsWorld, corridorHalfWidth * 2, corridorHeight, wallThickness, {
          x: finalCenter.x,
          y: corridorCenterY,
          z: primaryMin - wallThickness * 0.5
        });
        createStaticBox(physicsWorld, corridorHalfWidth * 2, corridorHeight, wallThickness, {
          x: finalCenter.x,
          y: corridorCenterY,
          z: primaryMax + wallThickness * 0.5
        });
      } else {
        createStaticBox(physicsWorld, corridorLength, wallThickness, corridorHalfWidth * 2, {
          x: finalCenter.x,
          y: finalBox.min.y - wallThickness * 0.5,
          z: finalCenter.z
        });
        createStaticBox(physicsWorld, corridorLength, wallThickness, corridorHalfWidth * 2, {
          x: finalCenter.x,
          y: finalBox.min.y + corridorHeight + wallThickness * 0.5,
          z: finalCenter.z
        });
        createStaticBox(physicsWorld, corridorLength, corridorHeight, wallThickness, {
          x: finalCenter.x,
          y: corridorCenterY,
          z: finalCenter.z - corridorHalfWidth - wallThickness * 0.5
        });
        createStaticBox(physicsWorld, corridorLength, corridorHeight, wallThickness, {
          x: finalCenter.x,
          y: corridorCenterY,
          z: finalCenter.z + corridorHalfWidth + wallThickness * 0.5
        });
        createStaticBox(physicsWorld, wallThickness, corridorHeight, corridorHalfWidth * 2, {
          x: primaryMin - wallThickness * 0.5,
          y: corridorCenterY,
          z: finalCenter.z
        });
        createStaticBox(physicsWorld, wallThickness, corridorHeight, corridorHalfWidth * 2, {
          x: primaryMax + wallThickness * 0.5,
          y: corridorCenterY,
          z: finalCenter.z
        });
      }

      // Spawn seguro según el eje real del túnel
      const spawnPrimary = primaryMin + Math.max(5.5, primarySize * 0.12);
      const spawnY = finalBox.min.y + 1.0;
      const spawnX = primaryAxis === 'x' ? spawnPrimary : finalCenter.x;
      const spawnZ = primaryAxis === 'z' ? spawnPrimary : finalCenter.z;
      const lookAt = {
        x: primaryAxis === 'x' ? finalCenter.x : spawnX,
        y: spawnY - player.radius + player.eyeHeight - 0.15,
        z: primaryAxis === 'z' ? finalCenter.z : spawnZ
      };

      player.setPosition(spawnX, spawnY, spawnZ, lookAt);
      player.setMovementProfile(null);
      player.setMovementBounds({
        minX: primaryAxis === 'x' ? primaryMin + 1.0 : finalCenter.x - corridorHalfWidth,
        maxX: primaryAxis === 'x' ? primaryMax - 1.0 : finalCenter.x + corridorHalfWidth,
        minY: finalBox.min.y + 0.85,
        maxY: finalBox.min.y + 1.35,
        minZ: primaryAxis === 'z' ? primaryMin + 1.0 : finalCenter.z - corridorHalfWidth,
        maxZ: primaryAxis === 'z' ? primaryMax - 1.0 : finalCenter.z + corridorHalfWidth,
        safePosition: { x: spawnX, y: spawnY, z: spawnZ }
      });

      setMainSceneReady();
      setHelpText('Escena 3: Túnel | Click y mueve el mouse para mirar | WASD recorrer');
    },
    undefined,
    (error) => {
      console.error(error);
      setHelpText('No se pudo cargar el túnel.');
    }
  );
}

export function updateScene3(time) {
  tunnelLights.forEach((light, index) => {
    const phase = index * 1.3;
    light.intensity = index === 0
      ? 8 * (0.75 + 0.25 * Math.sin(time * 5 + phase))
      : 2.5 * (0.7 + 0.3 * Math.cos(time * 3.5 + phase));
  });
}
