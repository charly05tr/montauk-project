let helpText

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
}

export function setHelpText(text) {
  if (helpText) helpText.textContent = text
}

export function setHelpTextVisible(visible) {
  if (helpText) helpText.style.display = visible ? 'block' : 'none'
}
