let helpText
let transitionOverlay

export function initOverlay() {
  helpText = document.createElement('div')
  helpText.style.cssText = `
    position:fixed;bottom:16px;left:50%;transform:translateX(-50%);
    color:#ff7a2b;font-family:Georgia,serif;font-size:0.85rem;
    background:rgba(0,0,0,0.5);padding:6px 14px;border-radius:6px;
    pointer-events:none;z-index:100;
  `
  helpText.textContent = 'Cargando escena...'
  document.body.appendChild(helpText)

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

export function setHelpTextVisible(visible) {
  if (helpText) helpText.style.display = visible ? 'block' : 'none'
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

