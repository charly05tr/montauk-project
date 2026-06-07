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

  // Crear contenedor de la ayuda flotante
  floatingHelpContainer = document.createElement('div');
  floatingHelpContainer.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 100;
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
    margin-bottom: 16px;
    opacity: 0;
    transition: opacity 0.3s ease;
    text-align: left;
    display: none;
    pointer-events: none;
    box-shadow: 0 0 15px rgba(0, 0, 0, 0.8);
  `;
  floatingTooltip.innerHTML = 'Hover for help';

  // Crear el botón flotante en sí
  floatingButton = document.createElement('div');
  floatingButton.style.cssText = `
    height: 40px;
    padding: 0 16px;
    border-radius: 20px;
    background: rgba(0, 0, 0, 0.7);
    border: 2px solid #ff7a2b;
    color: #ff7a2b;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 16px;
    font-family: 'Courier New', Courier, monospace;
    font-weight: bold;
    cursor: pointer;
    box-shadow: 0 0 15px rgba(255, 122, 43, 0.4);
    transition: transform 0.2s ease, background 0.2s ease;
    pointer-events: auto;
  `;
  floatingButton.textContent = 'Q - Help';

  // Función para alternar la visibilidad del tooltip
  toggleFloatingTooltip = (forceShow) => {
    if (!floatingTooltip || !floatingButton) return;
    const isHidden = floatingTooltip.style.display === 'none' || floatingTooltip.style.opacity === '0';
    const shouldShow = forceShow !== undefined ? forceShow : isHidden;
    
    if (shouldShow) {
      floatingTooltip.style.display = 'block';
      setTimeout(() => floatingTooltip.style.opacity = '1', 10);
      floatingButton.style.transform = 'scale(1.05)';
      floatingButton.style.background = 'rgba(255, 122, 43, 0.2)';
    } else {
      floatingTooltip.style.opacity = '0';
      setTimeout(() => {
        if (floatingTooltip.style.opacity === '0') floatingTooltip.style.display = 'none';
      }, 300);
      floatingButton.style.transform = 'scale(1)';
      floatingButton.style.background = 'rgba(0, 0, 0, 0.7)';
    }
  };

  floatingButton.addEventListener('mouseenter', () => toggleFloatingTooltip(true));
  floatingButton.addEventListener('mouseleave', () => toggleFloatingTooltip(false));

  // Toggle con tecla Q
  window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'q') {
      toggleFloatingTooltip();
    }
  });

  floatingHelpContainer.appendChild(floatingTooltip);
  floatingHelpContainer.appendChild(floatingButton);
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

