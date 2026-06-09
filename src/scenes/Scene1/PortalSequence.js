/**
 * PortalSequence.js — Secuencia cinemática del portal (Scene 1 → Scene 3)
 *
 * Cuando el jugador completa "HELP", esta secuencia reemplaza la transición seca:
 *  1. Bloquea controles y reproduce sonido del portal
 *  2. Abre un portal azul brillante en la pared trasera
 *  3. Genera partículas en vórtice que se arremolinan hacia el centro
 *  4. Succiona la cámara/jugador hacia el portal
 *  5. Al entrar, hace un fundido rápido y cambia a Scene 3 (ya precargada)
 *
 * Usa Three.js puro con interpolación manual (lerp), sin GSAP.
 */

import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { soundManager } from '../../core/SoundManager.js';
import { fadeToBlack, fadeInFromBlack, setHelpText, setFloatingHelp } from '../../ui/Overlay/index.js';
import { eventBus } from '../../utils/eventBus.js';
import portalVertexShader from '../../shaders/portalVertex.glsl?raw';
import portalFragmentShader from '../../shaders/portalFragment.glsl?raw';

// =====================================================
// ESTADO
// =====================================================

let portalState = 'idle'; // 'idle' | 'opening' | 'vortex' | 'absorbing' | 'done'
let sequenceStartTime = 0;
let portalCenter = new THREE.Vector3();

// Objetos 3D del portal
let portalGroup = null;       // Group que contiene toroide + disco
let portalRing = null;        // THREE.Mesh (TorusGeometry)
let portalDisc = null;        // THREE.Mesh (CircleGeometry + ShaderMaterial)
let portalLight = null;       // THREE.PointLight azul
let portalDiscMaterial = null; // ShaderMaterial del disco

// Sistema de partículas
let particleSystem = null;    // THREE.Points
let particleGeometry = null;
let particleMaterial = null;
const PARTICLE_COUNT = 300;
let particleData = null;      // Float32Array con datos por partícula (ángulo, radio, velocidad, fase)

// Referencias externas
let _scene = null;
let _player = null;
let _sceneManager = null;
let _physicsWorld = null;
let _preloadPromise = null;

// Posición original de la cámara para la absorción
let originalCameraPos = new THREE.Vector3();
let originalCameraQuat = new THREE.Quaternion();

// Timings (en segundos desde el inicio de la secuencia)
const PHASE_OPENING_END = 1.2;    // El portal termina de abrirse
const PHASE_VORTEX_END = 2.8;     // Las partículas alcanzan su clímax
const PHASE_ABSORB_END = 3.8;     // El jugador entra al portal
const TOTAL_DURATION = 4.0;

// =====================================================
// API PÚBLICA
// =====================================================

/**
 * Inicia la secuencia cinemática completa del portal.
 * @param {THREE.Scene} scene
 * @param {Player} player
 * @param {THREE.Vector3} roomCenter - Centro de la habitación
 * @param {THREE.Box3} roomBox - Bounding box de la habitación
 * @param {SceneManager} sceneManager
 * @param {PhysicsWorld} physicsWorld
 */
export function startPortalSequence(scene, player, roomCenter, roomBox, sceneManager, physicsWorld) {
  if (portalState !== 'idle') return;

  _scene = scene;
  _player = player;
  _sceneManager = sceneManager;
  _physicsWorld = physicsWorld;

  // 1. Calcular posición del portal (centro de la pared trasera, alineado con el tapiz)
  const roomSize = roomBox.getSize(new THREE.Vector3());
  const woodHeight = 0.80;
  const wallpaperHeight = roomSize.y - woodHeight;
  const wallpaperY = roomBox.min.y + woodHeight + (wallpaperHeight / 2);

  portalCenter.set(
    roomCenter.x,
    wallpaperY - 0.37,                 // Centrado más abajo para no chocar con el techo y quedar apoyado sobre la madera
    roomBox.max.z - 0.12               // Justo delante de la pared trasera
  );

  // 2. Bloquear controles del jugador
  if (player.controls && player.controls.isLocked) {
    player.controls.unlock();
  }
  player.body.velocity.set(0, 0, 0);
  player.body.angularVelocity.set(0, 0, 0);
  player.body.type = CANNON.Body.KINEMATIC;

  // Guardar posición/rotación original de la cámara
  originalCameraPos.copy(player.camera.position);
  originalCameraQuat.copy(player.camera.quaternion);

  // 3. Reproducir sonido del portal
  soundManager.stopAmbient('phone');
  try {
    soundManager.playPortalOpenSound();
  } catch (err) {
    // Fallback si el método no existe (ej. Vite HMR con versión vieja)
    console.warn('[Portal] playPortalOpenSound no disponible, usando fallback.');
    soundManager.resumeContext();
  }

  // 4. Iniciar precarga de Scene 3 en paralelo
  _preloadPromise = sceneManager.preloadSceneAssets('scene3');

  // 5. Crear los objetos visuales
  createPortalVisuals(scene);
  createParticleSystem(scene);

  // 6. Esconder la UI
  setHelpText('');
  setFloatingHelp('');

  // 7. Arrancar la secuencia
  portalState = 'opening';
  sequenceStartTime = -1; // Se asigna en el primer frame de update
  sceneManager.isTransitioning = true; // Bloquear otras transiciones

  console.log('[Portal] Secuencia iniciada.');
}

/**
 * Se llama cada frame desde updateScene1().
 * Anima el portal, las partículas y la absorción del jugador.
 * @param {number} time - Tiempo global (clock.elapsedTime)
 * @param {number} dt - Delta time del frame
 */
export function updatePortalSequence(time, dt) {
  if (portalState === 'idle' || portalState === 'done') return;

  // Inicializar el tiempo de referencia en el primer frame
  if (sequenceStartTime < 0) {
    sequenceStartTime = time;
  }

  const elapsed = time - sequenceStartTime;
  const normalizedTotal = Math.min(elapsed / TOTAL_DURATION, 1.0);

  // Actualizar el shader del disco
  if (portalDiscMaterial) {
    portalDiscMaterial.uniforms.uTime.value = time;
  }

  // ---- FASE: OPENING (0 → 1.2s) ----
  if (elapsed < PHASE_OPENING_END) {
    portalState = 'opening';
    const openProgress = elapsed / PHASE_OPENING_END; // 0 → 1
    const eased = easeOutBack(openProgress);

    // Escalar el portal de 0 a tamaño completo
    if (portalGroup) {
      portalGroup.scale.setScalar(eased);
    }

    // Ramp up de la luz del portal
    if (portalLight) {
      portalLight.intensity = THREE.MathUtils.lerp(0, 15, openProgress);
    }

    // Actualizar el progreso del shader
    if (portalDiscMaterial) {
      portalDiscMaterial.uniforms.uProgress.value = openProgress;
    }

    // Las partículas empiezan a generarse desde t=0.3s
    if (elapsed > 0.3) {
      updateParticles(time, elapsed, 'spawning');
    }
  }
  // ---- FASE: VORTEX (1.2 → 2.8s) ----
  else if (elapsed < PHASE_VORTEX_END) {
    portalState = 'vortex';

    if (portalDiscMaterial) {
      portalDiscMaterial.uniforms.uProgress.value = 1.0;
    }

    // Pulso de la luz del portal
    if (portalLight) {
      portalLight.intensity = 15 + 5 * Math.sin(time * 6.0);
    }

    updateParticles(time, elapsed, 'vortex');

    // La cámara empieza a girar sutilmente hacia el portal
    if (_player) {
      const lookTarget = portalCenter.clone();
      lookTarget.y = _player.camera.position.y; // Mantener nivel de ojos
      const currentDir = new THREE.Vector3();
      _player.camera.getWorldDirection(currentDir);
      const targetDir = lookTarget.sub(_player.camera.position).normalize();
      // Interpolar la dirección suavemente
      currentDir.lerp(targetDir, 0.02);
      const lookPos = _player.camera.position.clone().add(currentDir);
      _player.camera.lookAt(lookPos);
    }
  }
  // ---- FASE: ABSORBING (2.8 → 3.8s) ----
  else if (elapsed < PHASE_ABSORB_END) {
    if (portalState !== 'absorbing') {
      portalState = 'absorbing';
      console.log('[Portal] Fase de absorción iniciada.');
    }

    const absorbProgress = (elapsed - PHASE_VORTEX_END) / (PHASE_ABSORB_END - PHASE_VORTEX_END);
    const easedAbsorb = easeInCubic(absorbProgress);

    // Luz del portal al máximo
    if (portalLight) {
      portalLight.intensity = 20 + 10 * absorbProgress;
    }

    updateParticles(time, elapsed, 'absorbing');

    // Mover la cámara hacia el centro del portal
    if (_player) {
      const targetPos = portalCenter.clone();
      targetPos.z -= 0.05; // Ligeramente delante del portal
      targetPos.y = THREE.MathUtils.lerp(
        originalCameraPos.y,
        portalCenter.y,
        easedAbsorb
      );

      _player.camera.position.lerp(targetPos, easedAbsorb * 0.08 + 0.02);

      // Siempre mirar al portal
      _player.camera.lookAt(portalCenter);

      // Actualizar la posición del body para que coincida
      _player.body.position.set(
        _player.camera.position.x,
        _player.camera.position.y - _player.eyeHeight + _player.radius,
        _player.camera.position.z
      );
    }

    // Reducir FOV para efecto de "tunnel vision"
    if (_player && _player.camera.fov > 40) {
      _player.camera.fov = THREE.MathUtils.lerp(_player.camera.fov, 35, 0.04);
      _player.camera.updateProjectionMatrix();
    }
  }
  // ---- FASE: DONE (>3.8s) ----
  else {
    if (portalState !== 'done') {
      portalState = 'done';
      console.log('[Portal] Secuencia completada. Ejecutando cambio de escena.');
      executeSceneSwap();
    }
  }
}

/**
 * Limpia todos los objetos 3D del portal. Se llama al salir de Scene 1.
 */
export function cleanupPortalSequence() {
  // Remover objetos de la escena
  if (portalGroup && portalGroup.parent) {
    portalGroup.parent.remove(portalGroup);
  }
  if (portalLight && portalLight.parent) {
    portalLight.parent.remove(portalLight);
  }
  if (particleSystem && particleSystem.parent) {
    particleSystem.parent.remove(particleSystem);
  }

  // Dispose de geometrías y materiales
  portalRing?.geometry?.dispose();
  portalRing?.material?.dispose();
  portalDisc?.geometry?.dispose();
  portalDiscMaterial?.dispose();
  particleGeometry?.dispose();
  particleMaterial?.dispose();

  // Reset estado
  portalGroup = null;
  portalRing = null;
  portalDisc = null;
  portalLight = null;
  portalDiscMaterial = null;
  particleSystem = null;
  particleGeometry = null;
  particleMaterial = null;
  particleData = null;
  portalState = 'idle';
  sequenceStartTime = 0;
  _scene = null;
  _player = null;
  _sceneManager = null;
  _physicsWorld = null;
  _preloadPromise = null;
}

/**
 * Devuelve true si la secuencia del portal está en progreso.
 */
export function isPortalActive() {
  return portalState !== 'idle';
}

// =====================================================
// CREACIÓN DE OBJETOS VISUALES
// =====================================================

function createPortalVisuals(scene) {
  portalGroup = new THREE.Group();
  portalGroup.position.copy(portalCenter);
  // El portal mira hacia la cámara (hacia -Z en coordenadas de la habitación)
  // Como la pared trasera es max.z, el portal mira hacia el jugador
  portalGroup.scale.setScalar(0); // Empieza invisible, escala durante 'opening'

  // --- Cargar textura del túnel para rellenar el círculo ---
  const textureLoader = new THREE.TextureLoader();
  const tunnelTexture = textureLoader.load('/models/Tunel/texture/text_tunel.jpeg');
  tunnelTexture.wrapS = THREE.RepeatWrapping;
  tunnelTexture.wrapT = THREE.RepeatWrapping;
  tunnelTexture.colorSpace = THREE.SRGBColorSpace;

  // --- Disco interior con shader de vórtice 3D y relieve ---
  // Tamaño ajustado a 0.65 de radio para no tocar el techo y descansar sobre la moldura
  const discGeometry = new THREE.CircleGeometry(0.65, 64);
  portalDiscMaterial = new THREE.ShaderMaterial({
    vertexShader: portalVertexShader,
    fragmentShader: portalFragmentShader,
    uniforms: {
      uTime: { value: 0.0 },
      uProgress: { value: 0.0 },
      uTexture: { value: tunnelTexture },
    },
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.NormalBlending, // Usamos NormalBlending para tapar la pared y mostrar la profundidad realista
  });
  portalDisc = new THREE.Mesh(discGeometry, portalDiscMaterial);
  portalDisc.position.z = 0.01;
  portalGroup.add(portalDisc);

  scene.add(portalGroup);

  // --- PointLight azul para iluminar la habitación ---
  portalLight = new THREE.PointLight(0x2090ff, 0, 8.0, 2.0);
  portalLight.position.copy(portalCenter);
  portalLight.position.z -= 0.3; // Un poco delante del portal
  scene.add(portalLight);
}

function createParticleSystem(scene) {
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const colors = new Float32Array(PARTICLE_COUNT * 3);
  const sizes = new Float32Array(PARTICLE_COUNT);

  // Datos internos por partícula: [ángulo, radio, velocidadAngular, velocidadRadial, fase, offsetY]
  particleData = new Float32Array(PARTICLE_COUNT * 6);

  const colorBlue = new THREE.Color(0x1a8aff);
  const colorWhite = new THREE.Color(0xc0e0ff);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const i3 = i * 3;
    const i6 = i * 6;

    // Generar en un cilindro/anillo frente al portal
    const angle = Math.random() * Math.PI * 2;
    const radius = 0.4 + Math.random() * 1.2;  // Entre 0.4 y 1.6 metros del centro
    const offsetY = (Math.random() - 0.5) * 2.0;

    // Posición inicial (relativa al centro del portal)
    positions[i3] = portalCenter.x + Math.cos(angle) * radius;
    positions[i3 + 1] = portalCenter.y + offsetY;
    positions[i3 + 2] = portalCenter.z - 0.3 - Math.random() * 1.5; // Delante del portal

    // Color: gradiente azul → blanco (las de adentro más blancas)
    const colorMix = Math.random();
    const c = colorBlue.clone().lerp(colorWhite, colorMix);
    colors[i3] = c.r;
    colors[i3 + 1] = c.g;
    colors[i3 + 2] = c.b;

    // Tamaño aleatorio
    sizes[i] = 0.02 + Math.random() * 0.06;

    // Datos de movimiento
    particleData[i6] = angle;                          // ángulo actual
    particleData[i6 + 1] = radius;                         // radio actual
    particleData[i6 + 2] = 1.5 + Math.random() * 3.0;     // velocidad angular (rad/s)
    particleData[i6 + 3] = 0.2 + Math.random() * 0.5;     // velocidad radial (contracción m/s)
    particleData[i6 + 4] = Math.random() * Math.PI * 2;   // fase para variación
    particleData[i6 + 5] = offsetY;                        // offset Y original
  }

  particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  particleGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  // Textura de partícula (punto radiante suave)
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0.0, 'rgba(255,255,255,1.0)');
  gradient.addColorStop(0.3, 'rgba(150,200,255,0.8)');
  gradient.addColorStop(0.7, 'rgba(80,140,255,0.2)');
  gradient.addColorStop(1.0, 'rgba(20,80,200,0.0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  const particleTexture = new THREE.CanvasTexture(canvas);

  particleMaterial = new THREE.PointsMaterial({
    map: particleTexture,
    size: 0.08,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
    vertexColors: true,
  });

  particleSystem = new THREE.Points(particleGeometry, particleMaterial);
  particleSystem.frustumCulled = false;
  scene.add(particleSystem);
}

// =====================================================
// ANIMACIÓN DE PARTÍCULAS
// =====================================================

function updateParticles(time, elapsed, phase) {
  if (!particleGeometry || !particleData || !particleMaterial) return;

  const positions = particleGeometry.attributes.position.array;

  // Fade in de las partículas
  if (phase === 'spawning') {
    particleMaterial.opacity = THREE.MathUtils.lerp(particleMaterial.opacity, 0.7, 0.05);
  } else if (phase === 'vortex') {
    particleMaterial.opacity = THREE.MathUtils.lerp(particleMaterial.opacity, 0.9, 0.03);
  } else if (phase === 'absorbing') {
    particleMaterial.opacity = THREE.MathUtils.lerp(particleMaterial.opacity, 1.0, 0.05);
  }

  const dt = 0.016; // ~60fps

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const i3 = i * 3;
    const i6 = i * 6;

    let angle = particleData[i6];
    let radius = particleData[i6 + 1];
    const angularSpeed = particleData[i6 + 2];
    const radialSpeed = particleData[i6 + 3];
    const phaseOffset = particleData[i6 + 4];
    const offsetY = particleData[i6 + 5];

    // Rotar (espiral)
    angle += angularSpeed * dt;

    // Contraer hacia el centro (más rápido en fases avanzadas)
    let contractionMultiplier = 1.0;
    if (phase === 'vortex') contractionMultiplier = 1.5;
    if (phase === 'absorbing') contractionMultiplier = 3.0;

    radius -= radialSpeed * contractionMultiplier * dt;

    // Si la partícula llega al centro, resetearla al borde
    if (radius < 0.05) {
      radius = 0.4 + Math.random() * 1.2;
      angle = Math.random() * Math.PI * 2;
    }

    // Guardar estado actualizado
    particleData[i6] = angle;
    particleData[i6 + 1] = radius;

    // Calcular posición 3D
    const wobble = Math.sin(time * 2.0 + phaseOffset) * 0.1;
    const yWobble = Math.cos(time * 1.5 + phaseOffset) * 0.08;

    positions[i3] = portalCenter.x + Math.cos(angle) * radius + wobble;
    positions[i3 + 1] = portalCenter.y + offsetY * (radius / 1.6) + yWobble;
    positions[i3 + 2] = portalCenter.z - 0.3 - radius * 0.3 + Math.sin(phaseOffset + time) * 0.15;
  }

  particleGeometry.attributes.position.needsUpdate = true;
}

// =====================================================
// CAMBIO DE ESCENA
// =====================================================

async function executeSceneSwap() {
  if (!_sceneManager || !_physicsWorld || !_player) return;

  // Restaurar el FOV del jugador
  _player.camera.fov = 80;
  _player.camera.updateProjectionMatrix();

  // Fundido rápido a blanco/negro (el portal brilla intensamente como transición natural)
  await fadeToBlack(300);

  // Esperar a que la precarga termine (probablemente ya terminó hace rato)
  if (_preloadPromise) {
    await _preloadPromise;
  }

  // Esperar a que scene3 esté lista después del switchScene
  const sceneLoadPromise = new Promise((resolve) => {
    const onSceneReady = (e) => {
      if (e.detail.sceneId === 'scene3') {
        eventBus.off('sceneReady', onSceneReady);
        resolve();
      }
    };
    eventBus.on('sceneReady', onSceneReady);
  });

  // Hacer el cambio real de escena (los assets ya están en cache, será casi instantáneo)
  _sceneManager.switchScene('scene3', _physicsWorld, _player);

  // Esperar a que la escena emita 'sceneReady'
  await sceneLoadPromise;

  // Restaurar el body del jugador a DYNAMIC
  _player.body.type = CANNON.Body.DYNAMIC;
  _player.body.velocity.set(0, 0, 0);
  _player.body.angularVelocity.set(0, 0, 0);

  // Pequeña pausa para que el renderer compile shaders
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Fade in directo al túnel
  await fadeInFromBlack(800);

  _sceneManager.isTransitioning = false;

  console.log('[Portal] Transición completada. Bienvenido al túnel.');
}

// =====================================================
// EASING FUNCTIONS (nativas, sin GSAP)
// =====================================================

function easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function easeInCubic(t) {
  return t * t * t;
}
