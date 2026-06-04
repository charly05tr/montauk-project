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
      // Incrementamos la escala del túnel para que el personaje se sienta más pequeño
      // y no choque con las paredes
      const targetHeight = 10.0;
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

      // Determinar el eje principal del túnel (el más largo)
      const primaryAxis = finalSize.z >= finalSize.x ? 'z' : 'x';
      const primaryMin = primaryAxis === 'z' ? finalBox.min.z : finalBox.min.x;
      const primaryMax = primaryAxis === 'z' ? finalBox.max.z : finalBox.max.x;
      const primarySize = primaryAxis === 'z' ? finalSize.z : finalSize.x;

      // Ancho lateral del túnel (eje perpendicular al recorrido)
      const lateralSize = primaryAxis === 'z' ? finalSize.x : finalSize.z;
      const tunnelHalfWidth = lateralSize * 0.5;

      // Ancho caminable: 45% del ancho total del modelo
      // Incrementamos el max a 2.5 para aprovechar el nuevo tamaño
      const corridorHalfWidth = Math.max(0.8, Math.min(2.5, tunnelHalfWidth * 0.45));

      // --- MATERIALES ---
      tunnelModel.traverse((child) => {
        if (!child.isMesh) return;
        child.material = Array.isArray(child.material)
          ? child.material.map(prepareTunnelMaterial)
          : prepareTunnelMaterial(child.material);
        child.castShadow = ENABLE_SHADOWS;
        child.receiveShadow = ENABLE_SHADOWS;
        child.frustumCulled = false;
      });

      // =====================================================
      // ESCANEO DEL PISO REAL DEL TÚNEL
      // =====================================================
      // Escaneamos los vértices de la geometría para encontrar
      // la altura real del piso interior. Buscamos los vértices
      // más bajos que estén cerca del eje central del túnel
      // (esos son el piso caminable, no la base exterior).

      const scanMargin = corridorHalfWidth * 1.5; // Zona central para buscar el piso
      const numSegments = 8; // Dividimos el túnel en 8 segmentos
      const segmentLength = primarySize / numSegments;
      const segmentFloorY = new Array(numSegments).fill(finalBox.max.y); // Iniciar al máximo

      tunnelModel.traverse((child) => {
        if (!child.isMesh || !child.geometry?.attributes?.position) return;

        const posAttr = child.geometry.attributes.position;
        const matrix = child.matrixWorld;
        const vertex = new THREE.Vector3();

        for (let i = 0; i < posAttr.count; i++) {
          vertex.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
          vertex.applyMatrix4(matrix);

          // Solo considerar vértices cerca del eje central (el pasillo)
          const lateralDist = primaryAxis === 'z'
            ? Math.abs(vertex.x - finalCenter.x)
            : Math.abs(vertex.z - finalCenter.z);

          if (lateralDist > scanMargin) continue;

          // Determinar en qué segmento cae este vértice
          const primaryPos = primaryAxis === 'z' ? vertex.z : vertex.x;
          const segIndex = Math.floor((primaryPos - primaryMin) / segmentLength);
          if (segIndex < 0 || segIndex >= numSegments) continue;

          // Solo vértices en la mitad inferior del modelo (el piso, no el techo)
          if (vertex.y < finalCenter.y && vertex.y < segmentFloorY[segIndex]) {
            segmentFloorY[segIndex] = vertex.y;
          }
        }
      });

      // Suavizar: si algún segmento no encontró vértices, interpolar
      for (let i = 0; i < numSegments; i++) {
        if (segmentFloorY[i] >= finalBox.max.y) {
          // Buscar vecinos válidos
          const prev = i > 0 ? segmentFloorY[i - 1] : null;
          const next = i < numSegments - 1 ? segmentFloorY[i + 1] : null;
          if (prev !== null && prev < finalBox.max.y) {
            segmentFloorY[i] = prev;
          } else if (next !== null && next < finalBox.max.y) {
            segmentFloorY[i] = next;
          } else {
            segmentFloorY[i] = finalCenter.y - finalSize.y * 0.25;
          }
        }
      }

      console.log('[TÚNEL] Pisos escaneados por segmento:', segmentFloorY.map(y => y.toFixed(2)));

      // =====================================================
      // COLISIONES: Suelo inclinado + Paredes laterales
      // =====================================================
      // Para evitar que el jugador se quede pegado en escalones (stairs),
      // calculamos la pendiente (slope) general del túnel y usamos
      // cajas únicas rotadas.

      const floorThickness = 1.5;
      const wallThickness = 0.5;
      const corridorHeight = 6.0;
      const floorWidth = corridorHalfWidth * 2 + 2.0;

      // Usar el primer y último segmento válidos para calcular la pendiente
      const firstY = segmentFloorY[0];
      const lastY = segmentFloorY[numSegments - 1];
      const deltaY = lastY - firstY;

      // La longitud total que cubren los segmentos
      const totalCoveredLength = primarySize;

      // Ángulo de inclinación (SOH CAH TOA)
      const slopeAngle = Math.atan2(deltaY, totalCoveredLength);

      // El centro Y de la caja inclinada será el promedio del inicio y fin
      const midFloorY = (firstY + lastY) / 2;

      // Aumentar un poco la longitud para evitar huecos en los bordes por la rotación
      const slopedLength = totalCoveredLength / Math.cos(slopeAngle) + 2.0;

      console.log('[TÚNEL] Pendiente calculada:', { deltaY: deltaY.toFixed(2), angle: slopeAngle.toFixed(3) });

      if (primaryAxis === 'z') {
        // Rotación alrededor del eje X para inclinar en Z
        // Si z va de negativo a positivo, un deltaY negativo significa que baja a medida que z aumenta.
        // Rotar en X inclina el eje Z.
        const rotationEuler = { x: -slopeAngle, y: 0, z: 0 };

        // Suelo inclinado
        createStaticBox(physicsWorld, floorWidth, floorThickness, slopedLength, {
          x: finalCenter.x,
          y: midFloorY - floorThickness * 0.5,
          z: finalCenter.z
        }, rotationEuler);

        // Paredes inclinadas
        createStaticBox(physicsWorld, wallThickness, corridorHeight, slopedLength, {
          x: finalCenter.x - corridorHalfWidth - wallThickness * 0.5,
          y: midFloorY + corridorHeight * 0.5,
          z: finalCenter.z
        }, rotationEuler);

        createStaticBox(physicsWorld, wallThickness, corridorHeight, slopedLength, {
          x: finalCenter.x + corridorHalfWidth + wallThickness * 0.5,
          y: midFloorY + corridorHeight * 0.5,
          z: finalCenter.z
        }, rotationEuler);

      } else {
        // Rotación alrededor del eje Z para inclinar en X
        const rotationEuler = { x: 0, y: 0, z: slopeAngle };

        // Suelo inclinado
        createStaticBox(physicsWorld, slopedLength, floorThickness, floorWidth, {
          x: finalCenter.x,
          y: midFloorY - floorThickness * 0.5,
          z: finalCenter.z
        }, rotationEuler);

        // Paredes inclinadas
        createStaticBox(physicsWorld, slopedLength, corridorHeight, wallThickness, {
          x: finalCenter.x,
          y: midFloorY + corridorHeight * 0.5,
          z: finalCenter.z - corridorHalfWidth - wallThickness * 0.5
        }, rotationEuler);

        createStaticBox(physicsWorld, slopedLength, corridorHeight, wallThickness, {
          x: finalCenter.x,
          y: midFloorY + corridorHeight * 0.5,
          z: finalCenter.z + corridorHalfWidth + wallThickness * 0.5
        }, rotationEuler);
      }

      // Tapas de inicio y final del túnel
      const avgFloorY = segmentFloorY.reduce((a, b) => a + b) / numSegments;
      if (primaryAxis === 'z') {
        createStaticBox(physicsWorld, floorWidth, corridorHeight, wallThickness, {
          x: finalCenter.x,
          y: avgFloorY + corridorHeight * 0.5,
          z: primaryMin - wallThickness * 0.5
        });
        createStaticBox(physicsWorld, floorWidth, corridorHeight, wallThickness, {
          x: finalCenter.x,
          y: avgFloorY + corridorHeight * 0.5,
          z: primaryMax + wallThickness * 0.5
        });
      } else {
        createStaticBox(physicsWorld, wallThickness, corridorHeight, floorWidth, {
          x: primaryMin - wallThickness * 0.5,
          y: avgFloorY + corridorHeight * 0.5,
          z: finalCenter.z
        });
        createStaticBox(physicsWorld, wallThickness, corridorHeight, floorWidth, {
          x: primaryMax + wallThickness * 0.5,
          y: avgFloorY + corridorHeight * 0.5,
          z: finalCenter.z
        });
      }

      // Techo sólido
      const ceilingY = avgFloorY + corridorHeight;
      if (primaryAxis === 'z') {
        createStaticBox(physicsWorld, floorWidth, wallThickness, primarySize + 2.0, {
          x: finalCenter.x,
          y: ceilingY + wallThickness * 0.5,
          z: finalCenter.z
        });
      } else {
        createStaticBox(physicsWorld, primarySize + 2.0, wallThickness, floorWidth, {
          x: finalCenter.x,
          y: ceilingY + wallThickness * 0.5,
          z: finalCenter.z
        });
      }

      // =====================================================
      // SPAWN Y MOVIMIENTO
      // =====================================================

      // 1. Determinar cuál lado del túnel es el más bajo
      const startsLow = firstY < lastY;

      // 2. Spawn en el extremo más bajo
      const spawnOffset = Math.max(5.5, primarySize * 0.12);
      let spawnPrimary, lookAtPrimary, spawnFloorY;

      if (startsLow) {
        // El inicio (primaryMin) es el más bajo
        spawnPrimary = primaryMin + spawnOffset;
        lookAtPrimary = primaryMax; // Mirar hacia arriba
        spawnFloorY = firstY;
      } else {
        // El final (primaryMax) es el más bajo
        spawnPrimary = primaryMax - spawnOffset;
        lookAtPrimary = primaryMin; // Mirar hacia arriba
        spawnFloorY = lastY;
      }

      const spawnY = spawnFloorY + player.radius + 0.3;
      const spawnX = primaryAxis === 'x' ? spawnPrimary : finalCenter.x;
      const spawnZ = primaryAxis === 'z' ? spawnPrimary : finalCenter.z;

      const lookAt = {
        x: primaryAxis === 'x' ? lookAtPrimary : finalCenter.x,
        y: spawnY - player.radius + player.eyeHeight,
        z: primaryAxis === 'z' ? lookAtPrimary : finalCenter.z
      };

      console.log('[TÚNEL] Spawn:', {
        spawnX: spawnX.toFixed(2),
        spawnY: spawnY.toFixed(2),
        spawnZ: spawnZ.toFixed(2),
        startsLow
      });

      player.setPosition(spawnX, spawnY, spawnZ, lookAt);

      // 3. Configuración de movimiento para el túnel
      player.setMovementProfile(null);
      player.allowLateral = false; // Solo W y S
      player.movementSpeed = 6.0;  // Velocidad ajustada

      // Bounds como red de emergencia
      const lowestFloor = Math.min(...segmentFloorY);
      player.setMovementBounds({
        minX: finalBox.min.x - 2.0,
        maxX: finalBox.max.x + 2.0,
        minY: lowestFloor - 1.0,
        maxY: ceilingY + 2.0,
        minZ: finalBox.min.z - 2.0,
        maxZ: finalBox.max.z + 2.0,
        safePosition: { x: spawnX, y: spawnY, z: spawnZ }
      });

      setMainSceneReady();
      setHelpText('Escena 3: Túnel | W/S: Avanzar/Retroceder | F: Linterna | Click para entrar');
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