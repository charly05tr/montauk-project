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
let flashAmbient = null;
let isUpsideDownActive = false;
let sceneManagerInstance = null;
let listenerAdded = false;
let activeScene = null;
let activePlayer = null;
let rootsGroup = null;
let rootViscousTexture = null;

// --- PARTICLES FOR UPSIDE DOWN ---
let upsideDownParticles = null;
let upsideDownParticleGeometry = null;
let upsideDownParticleMaterial = null;
let upsideDownParticleTexture = null;
let upsideDownParticleBasePositions = null;
let upsideDownParticleMotion = null;
const PARTICLE_COUNT = 460;

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
    color: 0xcfe8ff,
    size: 0.075,
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

export function applyUpsideDownState() {
  const globalAtmosphere = activeScene ? activeScene.getObjectByName("GlobalAtmosphereLight") : null;

  if (isUpsideDownActive) {
    if (rootsGroup) rootsGroup.visible = true;
    // Luz muy potente y vívida en tonos cyan/azul
    if (redLight) redLight.color.setHex(0x0022ff);
    if (orangeLight) orangeLight.color.setHex(0x0022ff);
    if (flashAmbient) flashAmbient.color.setHex(0x0000ff);

    if (globalAtmosphere) {
      globalAtmosphere.color.setHex(0x001133);
      globalAtmosphere.groundColor.setHex(0x000000);
      globalAtmosphere.intensity = 0.1;
    }

    if (activePlayer && activePlayer.flashlight) {
      activePlayer.flashlight.color.setHex(0x0033ff);
    }

    // Añadir niebla fuertemente azulada
    if (activeScene) {
      activeScene.background = new THREE.Color(0x01050a);
      activeScene.fog = new THREE.FogExp2(0x01050a, 0.15);
    }
  } else {
    if (rootsGroup) rootsGroup.visible = false;
    // Restaurar colores originales
    if (redLight) redLight.color.setHex(0xff2a12);
    if (orangeLight) orangeLight.color.setHex(0xff6a18);
    if (flashAmbient) flashAmbient.color.setHex(0xffffff);

    if (globalAtmosphere) {
      globalAtmosphere.color.setHex(0x5a7ba3);
      globalAtmosphere.groundColor.setHex(0x3a4b66);
      globalAtmosphere.intensity = 3;
    }

    if (activePlayer && activePlayer.flashlight) {
      activePlayer.flashlight.color.setHex(0xffffff);
    }

    // Quitar niebla
    if (activeScene) {
      activeScene.background = new THREE.Color(0x050a12);
      activeScene.fog = new THREE.FogExp2(0x050a12, 0.05);
    }
  }
}

export function loadSchoolScene(scene, physicsWorld, player, sceneManager) {
  sceneManagerInstance = sceneManager;
  activeScene = scene;
  activePlayer = player;
  isUpsideDownActive = sceneManager.isUpsideDownActive;

  // Luces Base (La posición se ajustará matemáticamente después de cargar la sala)
  flashAmbient = new THREE.AmbientLight(0xffffff, 0.0);
  scene.add(flashAmbient);

  redLight = new THREE.PointLight(0xff2a12, 1.5, 20, 2);
  redLight.position.set(-3, 5, 1);
  scene.add(redLight);

  orangeLight = new THREE.PointLight(0xff6a18, 1.5, 20, 2);
  orangeLight.position.set(2.5, 3.75, -2.5);
  scene.add(orangeLight);

  if (!listenerAdded) {
    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      if (key === 'u') {
        // Solo responder si estamos en Scene4
        if (!activeScene) return;

        isUpsideDownActive = !isUpsideDownActive;
        if (sceneManagerInstance) sceneManagerInstance.isUpsideDownActive = isUpsideDownActive;
        applyUpsideDownState();
      }
    });
    listenerAdded = true;
  }

  applyUpsideDownState();

  assetCache.loadGLTF('/models/Escuela.glb', loadingManager).then(
    (gltf) => {
      const model = gltf.scene;

      if (!model.userData.isConfigured) {
        const initialBox = new THREE.Box3().setFromObject(model);
        const rawHeight = initialBox.getSize(new THREE.Vector3()).y || 1;

        // Forzamos que la altura de la escuela sea ~5.2 metros
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

      // --- PATCH: TAPAR EL AGUJERO CON LA TEXTURA DEL USUARIO ---
      const texLoader = new THREE.TextureLoader(loadingManager);
      const wallTex = texLoader.load('/assets/schoolTexture.png');
      wallTex.colorSpace = THREE.SRGBColorSpace;

      let patchWallMat = new THREE.MeshLambertMaterial({ map: wallTex, side: THREE.DoubleSide });

      // Aplicar el mismo filtro oscuro y tétrico que usa el resto de la escuela
      patchWallMat = tuneSchoolMaterial(patchWallMat);

      // Restauramos el tamaño exacto del plano para no recortar los bordes de la textura
      const patchWallGeo = new THREE.PlaneGeometry(finalRoomSize.x, finalRoomSize.y);

      // Pared en el extremo max.z (metida un poquito hacia adentro para que no haya gap)
      const patchWall1 = new THREE.Mesh(patchWallGeo, patchWallMat);
      patchWall1.rotation.y = Math.PI;
      // Centramos la pared perfectamente; usaremos offsets de textura si hace falta alinear franjas
      patchWall1.position.set(finalRoomCenter.x, finalRoomCenter.y, finalRoomBox.max.z - 0.05);
      patchWall1.receiveShadow = ENABLE_SHADOWS;
      scene.add(patchWall1);

      // Piso extendido SOLO para tapar el vacío bajo las sillas flotantes (hacia afuera)
      const patchFloorGeo = new THREE.PlaneGeometry(finalRoomSize.x, 5); // 5 metros extra
      const patchFloor = new THREE.Mesh(patchFloorGeo, new THREE.MeshLambertMaterial({ color: 0x222222, side: THREE.DoubleSide }));
      patchFloor.rotation.x = -Math.PI / 2; // Mirando arriba
      // Lo colocamos justo afuera del pasillo, donde empieza el vacío, y 5 cm abajo del piso original
      patchFloor.position.set(finalRoomCenter.x, finalRoomBox.min.y - 0.05, finalRoomBox.max.z + 2.5);
      patchFloor.receiveShadow = ENABLE_SHADOWS;
      scene.add(patchFloor);

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

      // Crear partículas Upside Down
      createUpsideDownParticles(scene, finalRoomCenter, finalRoomSize);

      // --- CARGAR RAÍCES (Upside Down) ---
      rootsGroup = new THREE.Group();
      rootsGroup.visible = isUpsideDownActive;
      scene.add(rootsGroup);

      // Cargar textura viscosa para las raíces
      if (!rootViscousTexture) {
        rootViscousTexture = new THREE.TextureLoader(loadingManager).load('/models/Tunel/texture/text_tunel.jpeg');
        rootViscousTexture.colorSpace = THREE.SRGBColorSpace;
        rootViscousTexture.wrapS = THREE.RepeatWrapping;
        rootViscousTexture.wrapT = THREE.RepeatWrapping;
        rootViscousTexture.repeat.set(1, 3);
      }

      assetCache.loadGLTF('/models/root.glb', loadingManager).then((rootGltf) => {
        const baseRoot = rootGltf.scene;

        // Aplicar material viscoso a la raíz base
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
          }
        });

        // Calcular escala base para que cada raíz mida aprox 1.5 metros
        const rootBox = new THREE.Box3().setFromObject(baseRoot);
        const sizeVec = rootBox.getSize(new THREE.Vector3());
        const rootSize = Math.max(sizeVec.x, sizeVec.y, sizeVec.z) || 1.0;
        const baseScale = 1.5 / rootSize;

        // Recolectar solo mallas visibles y estructurales para el raycast
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
        const maxRoots = 80; // Bajamos el límite para que no sature y se mantenga disperso y ordenado
        const minDistanceBetweenRoots = 1.5; // Mayor separación para una escena más amplia
        const placedPositions = [];

        // Intentar colocar hasta 80 raíces dispersas
        while (placed < maxRoots && attempts < 1500) {
          attempts++;
          const rx = finalRoomCenter.x + (Math.random() - 0.5) * finalRoomSize.x * 0.95;
          const ry = finalRoomCenter.y + (Math.random() - 0.5) * finalRoomSize.y * 0.95;
          const rz = finalRoomCenter.z + (Math.random() - 0.5) * finalRoomSize.z * 0.95;

          const dir = new THREE.Vector3(
            (Math.random() - 0.5) * 2.0,
            (Math.random() - 0.5) * 2.0,
            (Math.random() - 0.5) * 2.0
          ).normalize();

          raycaster.set(new THREE.Vector3(rx, ry, rz), dir);
          const hits = raycaster.intersectObjects(validMeshes, false);

          if (hits.length > 0) {
            const hit = hits[0];

            // Ignorar si pegó en un techo o si la normal apunta muy hacia abajo
            if (hit.face && hit.face.normal.clone().transformDirection(hit.object.matrixWorld).y < -0.5) continue;

            // Ignorar si pegó en un objeto muy pequeño
            if (hit.distance < 0.1) continue;

            // Validar distancia mínima contra raíces ya colocadas para asegurar dispersión
            let tooClose = false;
            for (const pos of placedPositions) {
              if (pos.distanceTo(hit.point) < minDistanceBetweenRoots) {
                tooClose = true;
                break;
              }
            }
            if (tooClose) continue;

            const clone = baseRoot.clone();

            // Variación de escala (entre 0.4x y 1.2x)
            clone.scale.setScalar(baseScale * (Math.random() * 0.8 + 0.4));

            // Hundir un poquito la raíz en la pared para que no se vea el corte
            clone.position.copy(hit.point).add(hit.face.normal.clone().multiplyScalar(-0.1));

            // Alinear el eje Y de la raíz con la normal de la pared/piso
            const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), hit.face.normal);
            clone.quaternion.copy(quaternion);

            // Girarla en su propio eje para variedad
            clone.rotateY(Math.random() * Math.PI * 2);

            // Acostarla un poco aleatoriamente para que "trepe" por la superficie
            clone.rotateX((Math.random() * 0.6) + 0.2);

            clone.traverse((child) => {
              if (child.isMesh) {
                child.castShadow = ENABLE_SHADOWS;
                child.receiveShadow = ENABLE_SHADOWS;
              }
            });

            rootsGroup.add(clone);
            placedPositions.push(hit.point.clone());
            placed++;
          }
        }
      }).catch(err => console.error("Error loading roots in Scene4:", err));


      setMainSceneReady();
      eventBus.emit('sceneReady', { sceneId: 'scene4' });
      setFloatingHelp('<b>Scene: The Origins (Hawking lab`s school)</b><br><br><b>Controls:</b><br>- Click to enter<br>- WASD to move<br>- Press "U" for Upside Down Mode<br>- F to toggle flashlight<br><br><b>Exit:</b><br>- Press ESC to unlock pointer<br>- Type "HELP" to teleport');
      setHelpText('');
    }
  ).catch((error) => {
    console.error(error);
    setHelpText('Failed to load school model.');
  });
}

export function updateScene4(time, player, dt) {
  // --- Iluminación según estado ---
  if (isUpsideDownActive) {
    if (flashAmbient) flashAmbient.intensity = 0.6;

    if (redLight) {
      redLight.intensity = 1.0 * (0.8 + 0.2 * Math.sin(time * 1.5));
    }
    if (orangeLight) {
      orangeLight.intensity = 0.8 * (0.8 + 0.2 * Math.cos(time * 1.0));
    }

    // Forzar linterna a ser más tenue
    if (player && player.flashlight && player.flashlightEnabled) {
      player.flashlight.intensity = 20.0;
    }
  } else {
    // Estado normal: Luz ambiental apagada, luces de punto con pulso suave
    if (flashAmbient) flashAmbient.intensity = 0.0;

    if (redLight) {
      redLight.intensity = 1.5 * (0.8 + 0.2 * Math.sin(time * 4.0));
    }
    if (orangeLight) {
      orangeLight.intensity = 1.5 * (0.8 + 0.2 * Math.cos(time * 3.0));
    }

    // Restaurar linterna normal
    if (player && player.flashlight && player.flashlightEnabled) {
      player.flashlight.intensity = 10.0;
    }
  }

  // --- Animación de partículas Upside Down ---
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

    const targetOpacity = isUpsideDownActive ? 0.26 : 0.0;
    upsideDownParticleMaterial.opacity = THREE.MathUtils.lerp(
      upsideDownParticleMaterial.opacity,
      targetOpacity,
      0.08
    );
    upsideDownParticles.visible = upsideDownParticleMaterial.opacity > 0.01;
  }

  // Animar textura de las raíces
  if (isUpsideDownActive && rootViscousTexture && dt) {
    rootViscousTexture.offset.y -= dt * 0.15;
  }
}
