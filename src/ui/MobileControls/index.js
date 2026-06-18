import * as THREE from 'three';
import { isMobile } from '../../utils/deviceDetection.js';
import { sceneManager } from '../../core/SceneManager.js';
import { eventBus } from '../../utils/eventBus.js';
import { toggleDemogorgon } from '../../scenes/Scene2/index.js';
import { showPauseMenu } from '../PauseMenu/index.js';

let joystickContainer = null;
let joystickKnob = null;
let flashlightBtn = null;

let joystickActive = false;
let joystickTouchId = null;
let joystickStartPos = { x: 0, y: 0 };
let joystickDir = { x: 0, y: 0 };

// Touch look variables
let lookActive = false;
let lookTouchId = null;
let lookStartPos = { x: 0, y: 0 };
let baseYaw = 0;
let basePitch = 0;

let activePlayer = null;

export function initMobileControls(player) {
  if (!isMobile()) return;
  
  activePlayer = player;

  // 1. Crear contenedor raíz de los controles móviles
  const root = document.createElement('div');
  root.id = 'mobile-controls-root';
  root.className = 'mobile-ui';
  root.style.cssText = `
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 9999;
    user-select: none;
    -webkit-user-select: none;
  `;

  // 2. Prevenir gestos del navegador en mobile (pull-to-refresh, swipe-nav, overscroll)
  // Se aplican dinámicamente al entrar al juego para no bloquear scroll en landing page
  const preventBrowserGestures = document.createElement('style');
  preventBrowserGestures.textContent = `
    html, body {
      -webkit-touch-callout: none;
    }
  `;
  document.head.appendChild(preventBrowserGestures);

  // 3. Agregar estilos CSS para la UI de mobile
  const style = document.createElement('style');
  style.textContent = `
    .mobile-btn {
      width: 65px;
      height: 65px;
      border-radius: 50%;
      background: rgba(20, 20, 20, 0.45);
      border: 1.5px solid rgba(255, 122, 43, 0.35);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      display: flex;
      justify-content: center;
      align-items: center;
      pointer-events: auto;
      box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.6), inset 0 0 10px rgba(255, 122, 43, 0.1);
      transition: transform 0.1s ease, border-color 0.2s ease, box-shadow 0.2s ease;
      color: #ff7a2b;
      cursor: pointer;
      margin-bottom: 20px;
    }
    
    .mobile-btn:active {
      transform: scale(0.92);
      border-color: #ff7a2b;
      box-shadow: 0 0 20px rgba(255, 122, 43, 0.6);
    }
    
    .mobile-btn.active {
      background: rgba(255, 122, 43, 0.25);
      border-color: #ff7a2b;
      box-shadow: 0 0 25px rgba(255, 122, 43, 0.7);
    }

  `;
  document.head.appendChild(style);

  // 3. Crear el Joystick
  joystickContainer = document.createElement('div');
  joystickContainer.style.cssText = `
    position: absolute;
    bottom: 40px;
    left: 40px;
    width: 125px;
    height: 125px;
    border-radius: 50%;
    background: rgba(20, 20, 20, 0.45);
    border: 1.5px solid rgba(255, 122, 43, 0.2);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    pointer-events: auto;
    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.5), inset 0 0 15px rgba(255, 122, 43, 0.05);
    display: flex;
    justify-content: center;
    align-items: center;
    touch-action: none;
  `;

  joystickKnob = document.createElement('div');
  joystickKnob.style.cssText = `
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: rgba(255, 122, 43, 0.35);
    border: 1.5px solid #ff7a2b;
    box-shadow: 0 4px 15px rgba(255, 122, 43, 0.4);
    touch-action: none;
    pointer-events: none;
    transition: transform 0.05s ease;
  `;
  joystickContainer.appendChild(joystickKnob);
  root.appendChild(joystickContainer);

  // 4. Botón Pausa (esquina superior izquierda en mobile)
  const pauseContainer = document.createElement('div');
  pauseContainer.style.cssText = `
    position: absolute;
    top: 24px;
    left: 24px;
    z-index: 100001;
    pointer-events: auto;
  `;

  const pauseBtn = document.createElement('div');
  pauseBtn.style.cssText = `
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: rgba(20, 20, 20, 0.45);
    border: 1.5px solid rgba(255, 122, 43, 0.35);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    display: flex;
    justify-content: center;
    align-items: center;
    pointer-events: auto;
    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.6), inset 0 0 10px rgba(255, 122, 43, 0.1);
    transition: transform 0.1s ease, border-color 0.2s ease, box-shadow 0.2s ease;
    color: #ff7a2b;
    cursor: pointer;
  `;
  pauseBtn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="4" width="4" height="16" rx="1"/>
      <rect x="14" y="4" width="4" height="16" rx="1"/>
    </svg>
  `;
  pauseBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    e.stopPropagation();
    showPauseMenu();
  }, { passive: false });
  pauseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    showPauseMenu();
  });

  pauseContainer.appendChild(pauseBtn);
  root.appendChild(pauseContainer);

  // 5. Crear Contenedor de Botones (Derecha)
  const btnContainer = document.createElement('div');
  btnContainer.style.cssText = `
    position: absolute;
    bottom: 40px;
    right: 40px;
    display: flex;
    flex-direction: column;
    align-items: center;
  `;

  // Botón Linterna (Flashlight)
  flashlightBtn = document.createElement('div');
  flashlightBtn.className = 'mobile-btn';
  flashlightBtn.innerHTML = `
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A5 5 0 0 0 8 8c0 1 .3 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/>
      <path d="M9 18h6"/>
      <path d="M10 22h4"/>
    </svg>
  `;

  flashlightBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    player.flashlightEnabled = !player.flashlightEnabled;
    player.flashlight.intensity = player.flashlightEnabled ? 10.0 : 0.0;
    
    if (player.flashlightEnabled) {
      flashlightBtn.classList.add('active');
    } else {
      flashlightBtn.classList.remove('active');
    }

    import('../../core/SoundManager.js').then(({ soundManager }) => {
      soundManager.playKeyboardSlice('/sounds/keyboard.mp3', 0.8);
    });
  });
  // Botón Demogorgon (Scene 2 - mobile)
  const demogorgonBtn = document.createElement('div');
  demogorgonBtn.className = 'mobile-btn';
  demogorgonBtn.style.display = 'none';
  demogorgonBtn.innerHTML = `
    <svg width="30" height="30" viewBox="0 0 100 100" fill="currentColor">
      <path d="M50 20 L60 40 L85 30 L65 50 L85 70 L60 60 L50 85 L40 60 L15 70 L35 50 L15 30 L40 40 Z"/>
      <circle cx="50" cy="50" r="12" opacity="0.3"/>
    </svg>
  `;

  // Botón Upside Down (Scene 4 - mobile)
  const upsideDownBtn = document.createElement('div');
  upsideDownBtn.className = 'mobile-btn';
  upsideDownBtn.style.display = 'none';
  upsideDownBtn.innerHTML = `
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="1 4 1 10 7 10"></polyline>
      <polyline points="23 20 23 14 17 14"></polyline>
      <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10"></path>
      <path d="M3.51 15A9 9 0 0 0 18.36 18.36L23 14"></path>
    </svg>
  `;

  function updateSceneSpecificBtns(e) {
    const sceneId = e ? e.detail.sceneId : sceneManager.activeSceneId;
    demogorgonBtn.style.display = sceneId === 'scene2' ? 'flex' : 'none';
    upsideDownBtn.style.display = sceneId === 'scene4' ? 'flex' : 'none';
  }

  demogorgonBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (activePlayer) toggleDemogorgon(activePlayer);
    demogorgonBtn.classList.toggle('active');
  }, { passive: false });
  demogorgonBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (activePlayer) toggleDemogorgon(activePlayer);
    demogorgonBtn.classList.toggle('active');
  });

  upsideDownBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    e.stopPropagation();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'u' }));
    upsideDownBtn.classList.toggle('active');
  }, { passive: false });
  upsideDownBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'u' }));
    upsideDownBtn.classList.toggle('active');
  });

  btnContainer.appendChild(demogorgonBtn);
  btnContainer.appendChild(upsideDownBtn);
  btnContainer.appendChild(flashlightBtn);
  root.appendChild(btnContainer);

  // Update button visibility on scene changes
  updateSceneSpecificBtns();
  eventBus.on('sceneReady', updateSceneSpecificBtns);

  document.body.appendChild(root);

  // 6. Registrar Eventos del Joystick Táctil
  joystickContainer.addEventListener('touchstart', (e) => {
    const touch = e.targetTouches[0];
    joystickActive = true;
    joystickTouchId = touch.identifier;
    
    const rect = joystickContainer.getBoundingClientRect();
    joystickStartPos = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
  }, { passive: false });

  window.addEventListener('touchmove', (e) => {
    if (!joystickActive) return;
    e.preventDefault();

    let touch = null;
    for (let i = 0; i < e.touches.length; i++) {
      if (e.touches[i].identifier === joystickTouchId) {
        touch = e.touches[i];
        break;
      }
    }
    if (!touch) return;

    const deltaX = touch.clientX - joystickStartPos.x;
    const deltaY = touch.clientY - joystickStartPos.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const maxRadius = 40; // Rango máximo del knob

    if (distance === 0) {
      joystickDir = { x: 0, y: 0 };
      joystickKnob.style.transform = `translate(0px, 0px)`;
    } else {
      const angle = Math.atan2(deltaY, deltaX);
      const limitedDist = Math.min(distance, maxRadius);
      const knobX = Math.cos(angle) * limitedDist;
      const knobY = Math.sin(angle) * limitedDist;
      
      joystickKnob.style.transform = `translate(${knobX}px, ${knobY}px)`;
      
      // Dirección normalizada
      joystickDir = {
        x: knobX / maxRadius,
        y: knobY / maxRadius
      };
    }

    // Actualizar mapeo de teclas del jugador
    player.keys.w = joystickDir.y < -0.3;
    player.keys.s = joystickDir.y > 0.3;
    player.keys.a = joystickDir.x < -0.3;
    player.keys.d = joystickDir.x > 0.3;
  }, { passive: false });

  const resetJoystick = () => {
    if (!joystickActive) return;
    joystickActive = false;
    joystickTouchId = null;
    joystickDir = { x: 0, y: 0 };
    joystickKnob.style.transform = `translate(0px, 0px)`;
    
    // Apagar teclas
    player.keys.w = false;
    player.keys.s = false;
    player.keys.a = false;
    player.keys.d = false;
  };

  joystickContainer.addEventListener('touchend', resetJoystick, { passive: true });
  joystickContainer.addEventListener('touchcancel', resetJoystick, { passive: true });

  // 7. Registro de Cámara Táctil (Touch Look)
  window.addEventListener('touchstart', (e) => {
    // Evitar que toque de UI se use para mirar alrededor
    if (e.target.closest('.mobile-ui') || e.target.closest('#landing-page') || e.target.closest('#loading-screen')) return;
    e.preventDefault();
    
    const touch = e.changedTouches[0];
    lookActive = true;
    lookTouchId = touch.identifier;
    lookStartPos = { x: touch.clientX, y: touch.clientY };

    const euler = new THREE.Euler(0, 0, 0, 'YXZ');
    euler.setFromQuaternion(player.camera.quaternion);
    baseYaw = euler.y;
    basePitch = euler.x;
  }, { passive: false });

  window.addEventListener('touchmove', (e) => {
    if (!lookActive) return;
    e.preventDefault();

    let touch = null;
    for (let i = 0; i < e.touches.length; i++) {
      if (e.touches[i].identifier === lookTouchId) {
        touch = e.touches[i];
        break;
      }
    }
    if (!touch) return;

    const deltaX = touch.clientX - lookStartPos.x;
    const deltaY = touch.clientY - lookStartPos.y;

    // Sensibilidad del touch look
    const sensitivity = 0.0035;
    const yaw = baseYaw - deltaX * sensitivity;
    const pitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, basePitch - deltaY * sensitivity));

    player.camera.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
  }, { passive: false });

  const stopLooking = (e) => {
    if (!lookActive) return;
    lookActive = false;
    lookTouchId = null;
  };

  window.addEventListener('touchend', stopLooking, { passive: true });
  window.addEventListener('touchcancel', stopLooking, { passive: true });
}

export function showMobileControls() {
  const root = document.getElementById('mobile-controls-root');
  if (root) root.style.display = 'block';
}

export function hideMobileControls() {
  const root = document.getElementById('mobile-controls-root');
  if (root) root.style.display = 'none';
}
