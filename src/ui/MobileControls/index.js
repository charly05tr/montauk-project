import * as THREE from 'three';
import { isMobile } from '../../utils/deviceDetection.js';

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

  // 2. Agregar estilos CSS para la UI de mobile
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

  // 4. Crear Contenedor de Botones (Derecha)
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
  btnContainer.appendChild(flashlightBtn);
  root.appendChild(btnContainer);

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
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    if (!joystickActive) return;

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
  }, { passive: true });

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
    
    const touch = e.touches[0];
    lookActive = true;
    lookTouchId = touch.identifier;
    lookStartPos = { x: touch.clientX, y: touch.clientY };

    const euler = new THREE.Euler(0, 0, 0, 'YXZ');
    euler.setFromQuaternion(player.camera.quaternion);
    baseYaw = euler.y;
    basePitch = euler.x;
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    if (!lookActive) return;

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
  }, { passive: true });

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
