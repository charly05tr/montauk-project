import { isMobile } from '../../utils/deviceDetection.js';

let helpText
let floatingHelpContainer
let floatingTooltip
let floatingButton
let transitionOverlay

// Función global para alternar la visibilidad del tooltip desde fuera si es necesario
export let toggleFloatingTooltip = null;

export function initOverlay() {
  helpText = document.createElement('div')
  helpText.style.cssText = `
    position:fixed;bottom:16px;left:50%;transform:translateX(-50%);
    color:#ff7a2b;font-family:Georgia,serif;font-size:0.85rem;
    background:rgba(0,0,0,0.5);padding:6px 14px;border-radius:6px;
    pointer-events:none;z-index:100;
  `
  helpText.textContent = 'Loading scene...'
  document.body.appendChild(helpText)





  // Crear contenedor de la ayuda flotante (ubicado en la parte superior derecha)
  floatingHelpContainer = document.createElement('div');
  floatingHelpContainer.classList.add('mobile-ui');
  floatingHelpContainer.style.cssText = `
    position: fixed;
    top: 24px;
    right: 24px;
    z-index: 20000;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  `;

  // Crear el tooltip de la ayuda flotante
  floatingTooltip = document.createElement('div');
  floatingTooltip.style.cssText = `
    color: #ff7a2b;
    font-family: 'Courier New', Courier, monospace;
    font-size: 0.95rem;
    line-height: 1.5;
    background: rgba(0, 0, 0, 0.85);
    padding: 16px 20px;
    border-radius: 8px;
    border: 1px solid #ff7a2b;
    margin-top: 16px;
    opacity: 0;
    transition: opacity 0.3s ease;
    text-align: left;
    display: none;
    pointer-events: none;
    box-shadow: 0 0 15px rgba(0, 0, 0, 0.8);
  `;
  floatingTooltip.innerHTML = 'Hover for help';

  // Crear el botón flotante en sí (pill badge en PC con "Q - Help / Info", círculo en móvil)
  floatingButton = document.createElement('div');
  if (isMobile()) {
    floatingButton.style.cssText = `
      width: 42px;
      height: 42px;
      border-radius: 50%;
      background: rgba(0, 0, 0, 0.7);
      border: 2px solid #ff7a2b;
      color: #ff7a2b;
      display: flex;
      justify-content: center;
      align-items: center;
      cursor: pointer;
      box-shadow: 0 0 15px rgba(255, 122, 43, 0.4);
      transition: transform 0.2s ease, background 0.2s ease;
      pointer-events: auto;
    `;
    floatingButton.innerHTML = `
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 16v-4"/>
        <path d="M12 8h.01"/>
      </svg>
    `;
  } else {
    floatingButton.style.cssText = `
      height: 42px;
      padding: 0 18px;
      border-radius: 21px;
      background: rgba(10, 10, 10, 0.75);
      border: 1px solid rgba(255, 122, 43, 0.3);
      color: #ff7a2b;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 10px; /* Esto separa perfectamente INFO de la Q */
      cursor: pointer;
      box-shadow: 0 0 10px rgba(255, 122, 43, 0.15);
      backdrop-filter: blur(4px);
      transition: all 0.2s ease;
      pointer-events: auto;
      font-family: 'Courier New', Courier, monospace;
      white-space: nowrap;
      user-select: none;
    `;

    floatingButton.innerHTML = `
      <span style="font-size: 0.9rem; font-weight: bold; letter-spacing: 1px;">INFO</span>
      <span style="
        border: 1px solid rgba(255, 122, 43, 0.6);
        border-radius: 4px;
        padding: 0px 6px;
        font-weight: bold;
        font-size: 0.9rem;
        background: rgba(255, 122, 43, 0.1);
      ">Q</span>
    `;
  }

  // Función para alternar la visibilidad del tooltip
  toggleFloatingTooltip = (forceShow) => {
    if (!floatingTooltip || !floatingButton) return;
    const isHidden = floatingTooltip.style.display === 'none' || floatingTooltip.style.opacity === '0';
    const shouldShow = forceShow !== undefined ? forceShow : isHidden;

    if (shouldShow) {
      floatingTooltip.style.display = 'block';
      setTimeout(() => {
        if (floatingTooltip) floatingTooltip.style.opacity = '1';
      }, 10);
      floatingButton.style.transform = 'scale(1.05)';
      floatingButton.style.background = 'rgba(255, 122, 43, 0.2)';
      if (!isMobile()) {
        floatingButton.style.borderColor = 'rgba(255, 122, 43, 0.8)';
        floatingButton.style.boxShadow = '0 0 15px rgba(255, 122, 43, 0.4)';
      }
    } else {
      floatingTooltip.style.opacity = '0';
      setTimeout(() => {
        if (floatingTooltip && floatingTooltip.style.opacity === '0') {
          floatingTooltip.style.display = 'none';
        }
      }, 300);
      floatingButton.style.transform = 'scale(1)';
      if (isMobile()) {
        floatingButton.style.background = 'rgba(0, 0, 0, 0.7)';
      } else {
        floatingButton.style.background = 'rgba(10, 10, 10, 0.75)';
        floatingButton.style.borderColor = 'rgba(255, 122, 43, 0.3)';
        floatingButton.style.boxShadow = '0 0 10px rgba(255, 122, 43, 0.15)';
      }
    }
  };

  // Efecto de hover visual únicamente sobre el botón sin abrir automáticamente el tooltip
  floatingButton.addEventListener('mouseenter', () => {
    const isOpen = floatingTooltip && floatingTooltip.style.display === 'block' && floatingTooltip.style.opacity === '1';
    if (!isOpen) {
      floatingButton.style.transform = 'scale(1.05)';
      if (isMobile()) {
        floatingButton.style.background = 'rgba(255, 122, 43, 0.2)';
      } else {
        floatingButton.style.background = 'rgba(255, 122, 43, 0.15)';
        floatingButton.style.borderColor = 'rgba(255, 122, 43, 0.8)';
        floatingButton.style.boxShadow = '0 0 15px rgba(255, 122, 43, 0.4)';
      }
    }
  });

  floatingButton.addEventListener('mouseleave', () => {
    const isOpen = floatingTooltip && floatingTooltip.style.display === 'block' && floatingTooltip.style.opacity === '1';
    if (!isOpen) {
      floatingButton.style.transform = 'scale(1)';
      if (isMobile()) {
        floatingButton.style.background = 'rgba(0, 0, 0, 0.7)';
      } else {
        floatingButton.style.background = 'rgba(10, 10, 10, 0.75)';
        floatingButton.style.borderColor = 'rgba(255, 122, 43, 0.3)';
        floatingButton.style.boxShadow = '0 0 10px rgba(255, 122, 43, 0.15)';
      }
    }
  });

  // Habilitar toque en pantalla o click para alternar la ayuda
  floatingButton.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleFloatingTooltip();
  });

  // Toggle con tecla Q
  window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'q') {
      toggleFloatingTooltip();
    }
  });

  floatingHelpContainer.appendChild(floatingButton);
  floatingHelpContainer.appendChild(floatingTooltip);
  document.body.appendChild(floatingHelpContainer);

  // Crear el overlay de transición a pantalla completa
  transitionOverlay = document.createElement('div')
  transitionOverlay.style.cssText = `
    position: fixed;
    inset: 0;
    background-color: #000000;
    opacity: 0;
    pointer-events: none;
    z-index: 9990; /* Por debajo de la pantalla de carga inicial pero encima del resto */
    transition: opacity 1.2s ease-in-out;
  `
  document.body.appendChild(transitionOverlay)
}

export function setHelpText(text) {
  if (helpText) helpText.textContent = text
}

export function setFloatingHelp(htmlContent) {
  if (isMobile()) {
    // Reemplazar textos de controles de PC por equivalentes de móvil
    htmlContent = htmlContent
      .replace(/Click to enter/gi, 'Touch screen to start')
      .replace(/WASD to move/gi, 'Joystick to move')
      .replace(/W\/S to move forward\/backward/gi, 'Joystick to move')
      .replace(/F to toggle flashlight/gi, 'Flashlight button to toggle light')
      .replace(/Press ESC to unlock pointer/gi, 'Drag screen to look around')
      .replace(/Press "L" to toggle Demogorgon flash/gi, 'Touch anywhere to look')
      .replace(/Type "HELP" to teleport/gi, 'Keypad button to type "HELP"');
  }

  if (floatingTooltip) {
    floatingTooltip.innerHTML = htmlContent;
  }
  // Siempre que se asigne un nuevo texto de ayuda (cambio de escena), forzamos ocultar el tooltip
  if (toggleFloatingTooltip) {
    toggleFloatingTooltip(false);
  }
}

export function setHelpTextVisible(visible) {
  if (helpText) helpText.style.display = visible ? 'block' : 'none';
  // El contenedor de ayuda flotante siempre es visible para poder presionarse la tecla Q
}

/**
 * Realiza un fundido a negro (fade to black) de la pantalla.
 * @param {number} durationMs - Duración de la transición en milisegundos.
 * @returns {Promise<void>}
 */
export function fadeToBlack(durationMs = 1200) {
  return new Promise((resolve) => {
    if (!transitionOverlay) return resolve();
    transitionOverlay.style.transition = `opacity ${durationMs}ms ease-in-out`;
    transitionOverlay.style.opacity = '1';
    setTimeout(resolve, durationMs);
  });
}

/**
 * Realiza un fundido desde negro (fade in) de la pantalla.
 * @param {number} durationMs - Duración de la transición en milisegundos.
 * @returns {Promise<void>}
 */
export function fadeInFromBlack(durationMs = 1200) {
  return new Promise((resolve) => {
    if (!transitionOverlay) return resolve();
    transitionOverlay.style.transition = `opacity ${durationMs}ms ease-in-out`;
    transitionOverlay.style.opacity = '0';
    setTimeout(resolve, durationMs);
  });
}

