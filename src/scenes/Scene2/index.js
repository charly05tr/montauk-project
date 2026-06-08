import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { assetCache } from '../../utils/AssetCache.js';
import { loadingManager, setMainSceneReady } from '../../ui/Loading/index.js';
import { eventBus } from '../../utils/eventBus.js';
import { setHelpText, setFloatingHelp } from '../../ui/Overlay/index.js';
import { ENABLE_SHADOWS } from '../../utils/constants.js';
import { getMaterialName, tuneHospitalMaterial } from './objects.js';
import { createStaticBox, createBoxFromMesh, createTrimeshFromMesh } from '../../physics/Collider.js';
import { soundManager } from '../../core/SoundManager.js';

export let whiteLight1, whiteLight2, flashAmbient;
export let demogorgonModel, demogorgonMixer, demogorgonBody;
let isFlickeringActive = false; // Reset flicker state on each scene load
let listenerAdded = false;
let demogorgonSpawnPos = new THREE.Vector3();

let sceneManagerInstance = null;

let portalGateNode = null;
let activePhysicsWorld = null;

export function loadRoomScene2(scene, physicsWorld, player, sceneManager) {
  sceneManagerInstance = sceneManager;
  activePhysicsWorld = physicsWorld;
  portalGateNode = null;
  // Reset flicker state each time the scene loads
  isFlickeringActive = false;
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

        // Reset and freeze physics based on state
        if (demogorgonModel) {
          demogorgonModel.visible = isFlickeringActive;
        }
        // Ensure ambient flash light matches state
        if (flashAmbient) {
          flashAmbient.intensity = isFlickeringActive ? 0.5 : 0.0; // example intensity when active
        }

        if (demogorgonBody) {
          if (isFlickeringActive) {
            // Invocar exactamente a 8 metros en frente del jugador
            const direction = new THREE.Vector3(0, 0, -1);
            direction.applyQuaternion(player.camera.quaternion);
            direction.y = 0;
            if (direction.lengthSq() > 0) direction.normalize();

            const spawnX = player.camera.position.x + direction.x * 8;
            const spawnZ = player.camera.position.z + direction.z * 8;
            // El jugador tiene height = 1.5, floor está aprox a (camera.y - 1.5).
            const floorY = player.camera.position.y - 1.5; 

            // Activar cuerpo dinámico y habilitar colisiones con el mundo
            demogorgonBody.type = CANNON.Body.DYNAMIC;
            demogorgonBody.collisionFilterGroup = 1; // grupo por defecto
            demogorgonBody.collisionFilterMask = -1; // colisiona con todo
            demogorgonBody.position.set(spawnX, floorY + 0.6, spawnZ);
            demogorgonBody.velocity.set(0, 0, 0);
            // Necesario actualizar masa y despertar después del cambio de tipo
            demogorgonBody.updateMassProperties();
            demogorgonBody.wakeUp();
          } else {
            // Desactivar cuando se oculta: kinematic y sin colisiones
            demogorgonBody.type = CANNON.Body.KINEMATIC;
            demogorgonBody.collisionFilterGroup = 0;
            demogorgonBody.collisionFilterMask = 0;
            demogorgonBody.velocity.set(0, 0, 0);
            demogorgonBody.sleep(); // Congelar cuerpo
            if (demogorgonModel) {
                demogorgonModel.visible = false;
            }
          }
        }
      }
    });
    listenerAdded = true;
  }

  assetCache.loadGLTF('/models/Velez_Paiz.glb', loadingManager).then(
    (gltf) => {
      const model = gltf.scene;

      if (!model.userData.isConfigured) {
        // --- 1. ESCALA DINÁMICA ---
        const initialBox = new THREE.Box3().setFromObject(model);
        const rawHeight = initialBox.getSize(new THREE.Vector3()).y;
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

        model.userData.isConfigured = true;
      }

      // Play audio
      soundManager.playAmbient('hospital_ambient', '/sounds/scene2.mp3', true, 0.3); 

      scene.add(model);

      const finalRoomBox = new THREE.Box3().setFromObject(model);
      const finalRoomSize = finalRoomBox.getSize(new THREE.Vector3());
      const finalRoomCenter = finalRoomBox.getCenter(new THREE.Vector3());

      // --- 3. EXTRACCIÓN DE MATERIALES Y COLISIONES ---
      model.traverse((child) => {
        if (!child.isMesh) return;
        const nodeName = child.name.toLowerCase();
        if (nodeName === 'object_9') {
          portalGateNode = child;
          console.log('[PORTAL] Gate node detected (Object_9):', child.name);
        }
        child.material = Array.isArray(child.material)
          ? child.material.map(tuneHospitalMaterial)
          : tuneHospitalMaterial(child.material);

        child.frustumCulled = true;
        child.castShadow = ENABLE_SHADOWS;
        child.receiveShadow = ENABLE_SHADOWS;

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

        if (childSize.x < 0.15 && childSize.y < 0.15 && childSize.z < 0.15) return;
        if (childSize.y < 0.05) return;

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

      // --- 4. RELOCALIZACIÓN DE LUCES ---
      whiteLight1.position.set(finalRoomCenter.x - 10, finalRoomBox.max.y - 0.5, finalRoomCenter.z);
      whiteLight2.position.set(finalRoomCenter.x + 10, finalRoomBox.max.y - 0.5, finalRoomCenter.z);

      // --- 5. FÍSICAS PERIMETRALES ---
      const w = finalRoomSize.x;
      const h = finalRoomSize.y;
      const d = finalRoomSize.z;
      const t = 1.0; 

      createStaticBox(physicsWorld, w, t, d, { x: finalRoomCenter.x, y: finalRoomBox.min.y - t / 2, z: finalRoomCenter.z }); 
      createStaticBox(physicsWorld, w, t, d, { x: finalRoomCenter.x, y: finalRoomBox.max.y + t / 2, z: finalRoomCenter.z }); 
      createStaticBox(physicsWorld, t, h, d, { x: finalRoomBox.min.x - t / 2, y: finalRoomCenter.y, z: finalRoomCenter.z }); 
      createStaticBox(physicsWorld, t, h, d, { x: finalRoomBox.max.x + t / 2, y: finalRoomCenter.y, z: finalRoomCenter.z }); 
      createStaticBox(physicsWorld, w, h, t, { x: finalRoomCenter.x, y: finalRoomCenter.y, z: finalRoomBox.min.z - t / 2 }); 
      createStaticBox(physicsWorld, w, h, t, { x: finalRoomCenter.x, y: finalRoomCenter.y, z: finalRoomBox.max.z + t / 2 }); 

      // --- 6. SPAWN SEGURO DEL JUGADOR ---
      // Posición inicial del jugador
      const playerStartX = finalRoomCenter.x;
      const playerStartY = finalRoomBox.max.y - 0.5; // ligeramente bajo el techo
      const playerStartZ = finalRoomBox.max.z - 0.5; // posición en el tope del hospital
      player.setPosition(playerStartX, playerStartY, playerStartZ);

      // --- 7. CARGAR DEMOGORGON CON FÍSICAS ---
      assetCache.loadGLTF('/models/demogorgon.glb', loadingManager).then((demoGltf) => {
        demogorgonModel = demoGltf.scene;
        
        const demoBox = new THREE.Box3().setFromObject(demogorgonModel);
        const rawHeight = demoBox.getSize(new THREE.Vector3()).y;
        
        // Si el modelo es un SkinnedMesh, el Box3 puede dar 0 o infinito. Fallback a 1.0.
        let scaleFactor = 1.0;
        if (rawHeight > 0 && isFinite(rawHeight)) {
            // Queremos que el Demogorgon tenga una altura aproximada de 2.0 m 
            // 2.0 / rawHeight da una escala razonable y ligeramente mayor.
            scaleFactor = 2.0 / rawHeight;
        } else {
            scaleFactor = 0.01; // Scale típico por si acaso
        }
        demogorgonModel.scale.setScalar(scaleFactor);
        // Aplicar un pequeño factor extra para que se vea más imponente
        demogorgonModel.scale.multiplyScalar(1.2);
        demogorgonModel.updateMatrixWorld(true);

        const spawnX = finalRoomBox.max.x - 4;
        const spawnY = finalRoomBox.min.y;
        const spawnZ = finalRoomCenter.z;
        demogorgonSpawnPos.set(spawnX, spawnY, spawnZ);

        demogorgonModel.position.set(spawnX, spawnY, spawnZ);
        
        demogorgonModel.traverse((child) => {
          if (child.isMesh) {
             child.castShadow = ENABLE_SHADOWS;
             child.receiveShadow = ENABLE_SHADOWS;
             // EVITAR QUE DESAPAREZCA (Bug común con SkinnedMeshes en Three.js)
             child.frustumCulled = false; 
             if (child.material) {
               child.material.transparent = false;
               child.material.depthWrite = true;
               // Asegurarnos de que el material sea visible aunque las luces sean tenues
               if (child.material.emissive) {
                 child.material.emissive.setHex(0x222222); 
               }
             }
          }
        });

        scene.add(demogorgonModel);

        if (demoGltf.animations && demoGltf.animations.length > 0) {
          demogorgonMixer = new THREE.AnimationMixer(demogorgonModel);
          const action = demogorgonMixer.clipAction(demoGltf.animations[0]);
          action.play();
        }

        // Crear cuerpo físico en Cannon.js para el Demogorgon
        demogorgonBody = new CANNON.Body({
            mass: 80,
            type: CANNON.Body.KINEMATIC, // Inicialmente congelado para evitar que caiga
            shape: new CANNON.Sphere(0.6), // Esfera de colisión
            position: new CANNON.Vec3(spawnX, spawnY + 0.6, spawnZ),
            fixedRotation: true,
            linearDamping: 0.9
        });
        // Inicialmente deshabilitar colisiones ya que está oculto
        demogorgonBody.collisionFilterGroup = 0;
        demogorgonBody.collisionFilterMask = 0;
        physicsWorld.world.addBody(demogorgonBody);
      }).catch(err => console.error("Error loading demogorgon:", err));

      setMainSceneReady();
      eventBus.emit('sceneReady', { sceneId: 'scene2' });
      setFloatingHelp('<b>Scene: Hawking Lab </b><br><br><b>Controls:</b><br>- Click to enter<br>- WASD to move<br>- Press "L" to toggle Demogorgon flash<br><br><b>Exit:</b><br>- Press ESC to unlock pointer<br>- Find the portal to teleport yourself to the next scene');
      setHelpText('');
    }
  ).catch((error) => {
    console.error(error);
    setHelpText('Failed to load hospital model.');
  });
}

export function updateScene2(time, player, dt) {
  // Detección de proximidad al portal
  if (portalGateNode && player && player.camera && !sceneManagerInstance?.isTransitioning) {
    const playerPos = player.camera.position;
    const portalPos = new THREE.Vector3();
    portalGateNode.getWorldPosition(portalPos);

    const dx = playerPos.x - portalPos.x;
    const dz = playerPos.z - portalPos.z;
    const distXZ = Math.sqrt(dx * dx + dz * dz);

    if (distXZ < 3.0 && Math.abs(playerPos.y - portalPos.y) < 4.0) {
      console.log('[PORTAL] Jugador llegó al portal. Transicionando a Scene 3 (Túnel)...');
      if (sceneManagerInstance && activePhysicsWorld) {
        soundManager.playDoorOpenSound();
        sceneManagerInstance.switchSceneWithTransition('scene3', activePhysicsWorld, player);
      }
    }
  }

  // Manejo de la visibilidad
  if (demogorgonModel) {
    demogorgonModel.visible = isFlickeringActive;
  }

  // Lógica de persecución
  if (isFlickeringActive) {
    if (demogorgonMixer && dt) {
      demogorgonMixer.update(dt);
    }

    if (demogorgonModel && demogorgonBody && player && player.camera && dt) {
      //  Chase logic – movimiento mediante posición KINEMÁTICA (solo XZ) con límite mínimo
      // Asegurarnos de que el cuerpo está en modo KINEMATIC (sin gravedad)
      if (demogorgonBody.type !== CANNON.Body.KINEMATIC) {
        demogorgonBody.type = CANNON.Body.KINEMATIC;
        demogorgonBody.updateMassProperties();
        demogorgonBody.wakeUp();
      }

      // Mantener colisión solo con el suelo (grupo 1) para evitar atascos en paredes
      demogorgonBody.collisionFilterMask = 1;

      // Vector dirección XZ y distancia actual
      const deltaX = player.camera.position.x - demogorgonBody.position.x;
      const deltaZ = player.camera.position.z - demogorgonBody.position.z;
      const distanceXZ = Math.sqrt(deltaX * deltaX + deltaZ * deltaZ);
      const minDist = 2.0; // metros, distancia mínima permitida

      // Calcular altura del suelo en base a la cámara del jugador
      const floorY = player.camera.position.y - 1.5;

      // Limitar distancia máxima de persecución para evitar que se aleje demasiado
      const maxDist = 30.0; // metros

      if (distanceXZ > minDist && distanceXZ < maxDist) {
        const dirVec = new THREE.Vector3(deltaX, 0, deltaZ).normalize();
        const chaseSpeed = 4.0; // metros por segundo
        // Movimiento basado en dt (delta time)
        demogorgonBody.position.x += dirVec.x * chaseSpeed * dt;
        demogorgonBody.position.z += dirVec.z * chaseSpeed * dt;
      }
      // Fijar altura constante (sobre el suelo)
      demogorgonBody.position.y = floorY + 0.6;

      // Sincronizar modelo visual con cuerpo
      demogorgonModel.position.set(
        demogorgonBody.position.x,
        demogorgonBody.position.y - 0.6,
        demogorgonBody.position.z
      );

      // Hacer que el modelo mire al jugador (solo rotación Y)
      const lookAtPos = new THREE.Vector3(
        player.camera.position.x,
        demogorgonModel.position.y,
        player.camera.position.z
      );
      demogorgonModel.lookAt(lookAtPos);
    }
  }

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
