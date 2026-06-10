import { isMobile } from '../../utils/deviceDetection.js';
import { enableOrientationLock } from '../../utils/orientationLock.js';
import { soundManager } from '../../core/SoundManager.js';

export function initLandingPage(onStartCallback, player) {
  const container = document.createElement('div');
  container.id = 'landing-page';
  container.style.cssText = `
    position: fixed;
    inset: 0;
    background-color: #050505;
    background-image: radial-gradient(circle at center, #150202 0%, #000000 100%);
    z-index: 999999;
    overflow: hidden;
    color: white;
    font-family: 'Courier New', Courier, monospace;
    opacity: 1;
    transition: opacity 1.5s ease-in-out;
  `;

  // Añadimos estilos de animación y fuentes
  const style = document.createElement('style');
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Creepster&family=Outfit:wght@300;400;750&display=swap');
    
    /* CHRISTMAS LIGHTS */
    .lightrope {
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      position: absolute;
      z-index: 2;
      margin: 0;
      padding: 0;
      pointer-events: none;
      width: 100%;
      top: -10px;
    }
    .lightrope li {
      position: relative;
      animation-fill-mode: both;
      animation-iteration-count: infinite;
      list-style: none;
      margin: 0;
      padding: 0;
      display: inline-block;
      width: 12px;
      height: 28px;
      border-radius: 50%;
      margin: 20px;
      display: inline-block;
      background: rgba(0,247,165,1);
      box-shadow: 0px 4.66667px 24px 3px rgba(0,247,165,1);
      animation-name: flash-1;
      animation-duration: 2s;
    }
    .lightrope li:before {
      content: "";
      position: absolute;
      background: #222;
      width: 10px;
      height: 9.33333px;
      border-radius: 3px;
      top: -4.66667px;
      left: 1px;
    }
    .lightrope li:after {
      content: "";
      top: -14px;
      left: 9px;
      position: absolute;
      width: 52px;
      height: 18.66667px;
      border-bottom: solid #222 2px;
      border-radius: 50%;
    }
    .lightrope li:last-child:after {
      content: none;
    }
    .lightrope li:nth-child(2n+1) {
      background: rgba(0,255,255,1);
      box-shadow: 0px 4.66667px 24px 3px rgba(0,255,255,0.5);
      animation-name: flash-2;
      animation-duration: 0.4s;
    }
    .lightrope li:nth-child(4n+2) {
      background: rgba(247,0,148,1);
      box-shadow: 0px 4.66667px 24px 3px rgba(247,0,148,1);
      animation-name: flash-3;
      animation-duration: 1.1s;
    }
    .lightrope li:nth-child(odd) {
      animation-duration: 1.8s;
    }
    .lightrope li:nth-child(3n+1) {
      animation-duration: 1.4s;
    }
    @keyframes flash-1 { 
      0%, 100% { background: rgba(0,247,165,1); box-shadow: 0px 4.66667px 24px 3px rgba(0,247,165,1); } 
      50% { background: rgba(0,247,165,0.4); box-shadow: 0px 4.66667px 24px 3px rgba(0,247,165,0.2); }
    }
    @keyframes flash-2 { 
      0%, 100% { background: rgba(0,255,255,1); box-shadow: 0px 4.66667px 24px 3px rgba(0,255,255,1); } 
      50% { background: rgba(0,255,255,0.4); box-shadow: 0px 4.66667px 24px 3px rgba(0,255,255,0.2); }
    }
    @keyframes flash-3 { 
      0%, 100% { background: rgba(247,0,148,1); box-shadow: 0px 4.66667px 24px 3px rgba(247,0,148,1); } 
      50% { background: rgba(247,0,148,0.4); box-shadow: 0px 4.66667px 24px 3px rgba(247,0,148,0.2); }
    }

    /* BACKGROUND EMBERS */
    .ember {
      position: absolute;
      width: 4px;
      height: 4px;
      background: rgba(255, 60, 0, 0.4);
      border-radius: 50%;
      pointer-events: none;
      box-shadow: 0 0 8px rgba(255, 60, 0, 0.7);
      animation: floatUp 8s linear infinite;
      z-index: 1;
    }
    @keyframes floatUp {
      0% {
        transform: translateY(105vh) translateX(0) scale(1);
        opacity: 0;
      }
      10% {
        opacity: 0.7;
      }
      90% {
        opacity: 0.7;
      }
      100% {
        transform: translateY(-10vh) translateX(100px) scale(0.6);
        opacity: 0;
      }
    }

    /* DEMOGORGON SVG */
    .demogorgon-icon {
      width: 50px;
      height: 50px;
      margin-top: 10px;
      animation: float 3s ease-in-out infinite;
      filter: drop-shadow(0 0 5px #ff0f0f);
    }
    @keyframes float {
      0% { transform: translateY(0px) rotate(0deg); }
      50% { transform: translateY(-8px) rotate(5deg); }
      100% { transform: translateY(0px) rotate(0deg); }
    }

    /* BRANDING & BUTTONS */
    .montauk-title {
      font-family: 'Creepster', system-ui, cursive;
      font-size: clamp(2.5rem, 8vw, 5rem);
      color: #ff0f0f;
      text-transform: uppercase;
      letter-spacing: 0.15em;
      text-shadow: 0 0 10px rgba(255, 15, 15, 0.8), 0 0 20px rgba(255, 15, 15, 0.6), 0 0 40px rgba(138, 0, 0, 0.8);
      margin-top: 20px;
      margin-bottom: 15px;
      animation: flicker 4s infinite;
      text-align: center;
      user-select: none;
    }
    .montauk-subtitle {
      font-family: 'Outfit', sans-serif;
      font-size: clamp(0.95rem, 2.5vw, 1.15rem);
      color: #aaaaaa;
      max-width: 650px;
      text-align: center;
      line-height: 1.6;
      margin-bottom: 35px;
      letter-spacing: 0.03em;
      text-shadow: 0 2px 4px rgba(0,0,0,0.5);
    }
    .montauk-button {
      background: rgba(138, 0, 0, 0.1);
      color: #ff0f0f;
      border: 2px solid #ff0f0f;
      padding: 14px 48px;
      font-size: clamp(1.1rem, 3vw, 1.4rem);
      font-family: 'Courier New', Courier, monospace;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.15em;
      cursor: pointer;
      border-radius: 30px;
      box-shadow: 0 0 15px rgba(255, 15, 15, 0.25), inset 0 0 15px rgba(255, 15, 15, 0.1);
      transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
      margin-bottom: 25px;
      position: relative;
      overflow: hidden;
      outline: none;
    }
    .montauk-button::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(
        120deg,
        transparent,
        rgba(255, 15, 15, 0.3),
        transparent
      );
      transition: all 0.6s;
    }
    .montauk-button:hover::before {
      left: 100%;
    }
    .montauk-button:hover {
      background: #ff0f0f;
      color: #000;
      box-shadow: 0 0 30px rgba(255, 15, 15, 0.8);
      transform: scale(1.05);
    }
    .montauk-button:active {
      transform: scale(0.98);
    }

    /* CONTROLS CARD (GLASSMORPHISM) */
    .controls-panel {
      background: rgba(12, 4, 4, 0.65);
      border: 1px solid rgba(255, 15, 15, 0.25);
      border-radius: 12px;
      padding: 20px 24px;
      max-width: 600px;
      width: 100%;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6), inset 0 0 15px rgba(255, 15, 15, 0.05);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      margin-top: 30px;
      box-sizing: border-box;
    }
    .controls-panel-title {
      font-size: 0.8rem;
      text-transform: uppercase;
      color: rgba(255, 255, 255, 0.45);
      letter-spacing: 2px;
      margin-bottom: 15px;
      text-align: center;
      font-weight: bold;
      font-family: 'Outfit', sans-serif;
    }
    .controls-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px 24px;
    }
    .control-item {
      display: flex;
      align-items: center;
      font-size: 0.85rem;
      color: #cccccc;
      line-height: 1.4;
      font-family: 'Outfit', sans-serif;
    }
    .control-key {
      color: #ff0f0f;
      font-weight: bold;
      border: 1px solid rgba(255, 15, 15, 0.4);
      background: rgba(255, 15, 15, 0.08);
      border-radius: 4px;
      padding: 2px 6px;
      font-family: 'Courier New', Courier, monospace;
      margin-right: 12px;
      min-width: 55px;
      text-align: center;
      display: inline-block;
      box-shadow: 0 0 5px rgba(255, 15, 15, 0.2);
      box-sizing: border-box;
    }

    @keyframes flicker {
      0%, 19.999%, 22%, 62.999%, 64%, 64.999%, 70%, 100% {
        opacity: 1;
        text-shadow: 0 0 10px #ff0f0f, 0 0 20px #ff0f0f, 0 0 40px #8a0000;
      }
      20%, 21.999%, 63%, 63.999%, 65%, 69.999% {
        opacity: 0.4;
        text-shadow: none;
      }
    }

    @media (max-width: 600px) {
      .controls-grid {
        grid-template-columns: 1fr;
        gap: 8px;
      }
      .controls-panel {
        padding: 16px 20px;
        margin-top: 20px;
      }
      .montauk-subtitle {
        margin-bottom: 25px;
      }
    }

    /* CUSTOM SCROLLBAR FOR THEME MATCH */
    #landing-page *::-webkit-scrollbar {
      width: 8px;
    }
    #landing-page *::-webkit-scrollbar-track {
      background: rgba(10, 5, 5, 0.85);
      border-left: 1px solid rgba(255, 15, 15, 0.15);
    }
    #landing-page *::-webkit-scrollbar-thumb {
      background: rgba(255, 15, 15, 0.35);
      border-radius: 4px;
      border: 1px solid rgba(255, 15, 15, 0.5);
    }
    #landing-page *::-webkit-scrollbar-thumb:hover {
      background: rgba(255, 15, 15, 0.7);
      box-shadow: 0 0 8px rgba(255, 15, 15, 0.6);
    }
    #landing-page * {
      scrollbar-width: thin;
      scrollbar-color: rgba(255, 15, 15, 0.4) rgba(10, 5, 5, 0.85);
    }
  `;
  document.head.appendChild(style);

  // Generar partículas de ceniza flotantes en el fondo (hijos directos de container con z-index bajo)
  for (let i = 0; i < 20; i++) {
    const ember = document.createElement('div');
    ember.className = 'ember';
    ember.style.left = Math.random() * 100 + 'vw';
    ember.style.top = Math.random() * 100 + 'vh';
    ember.style.animationDelay = Math.random() * 8 + 's';
    ember.style.animationDuration = (5 + Math.random() * 7) + 's';
    ember.style.width = (2 + Math.random() * 4) + 'px';
    ember.style.height = ember.style.width;
    container.appendChild(ember);
  }

  // Contenedor scrollable exclusivo para el contenido
  const scrollContainer = document.createElement('div');
  scrollContainer.style.cssText = `
    position: absolute;
    inset: 0;
    overflow-y: auto;
    overflow-x: hidden;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 60px 20px 40px 20px;
    box-sizing: border-box;
    z-index: 10;
  `;

  // Luces de navidad animadas en la cabecera (se ocultan al scrolear)
  const lightrope = document.createElement('ul');
  lightrope.className = 'lightrope';
  const bulbCount = Math.min(30, Math.floor(window.innerWidth / 45));
  for (let i = 0; i < bulbCount; i++) {
    lightrope.appendChild(document.createElement('li'));
  }
  scrollContainer.appendChild(lightrope);

  // Contenedor principal centrado
  const wrapper = document.createElement('div');
  wrapper.style.cssText = `
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    max-width: 750px;
    margin: auto;
    padding: 20px 0;
  `;

  const title = document.createElement('h1');
  title.className = 'montauk-title';
  title.textContent = 'Montauk Project';

  const subtitle = document.createElement('p');
  subtitle.className = 'montauk-subtitle';
  subtitle.innerHTML = 'Welcome to this Stranger Things virtual experience.<br><br>Warning: This interactive simulation contains flashing lights, sudden noises, and experimental spatial anomalies. Proceed with caution.';

  const enterButton = document.createElement('button');
  enterButton.className = 'montauk-button';
  enterButton.textContent = 'Enter Facility';

  // Pequeño Demogorgon (SVG animado flotando)
  const demogorgon = document.createElement('div');
  demogorgon.innerHTML = `
    <svg class="demogorgon-icon" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <path d="M50 20 L60 40 L85 30 L65 50 L85 70 L60 60 L50 85 L40 60 L15 70 L35 50 L15 30 L40 40 Z" fill="#222" stroke="#ff0f0f" stroke-width="2" stroke-linejoin="round"/>
      <circle cx="50" cy="50" r="12" fill="#ff0f0f" opacity="0.3" />
      <path d="M45 45 L50 55 L55 45 Z" fill="#ff0f0f" />
    </svg>
  `;

  // Crear tarjeta de controles responsiva
  const controlsPanel = document.createElement('div');
  controlsPanel.className = 'controls-panel';

  const panelTitle = document.createElement('h3');
  panelTitle.className = 'controls-panel-title';
  panelTitle.textContent = isMobile() ? 'Mobile Touch Controls' : 'System Controls';
  controlsPanel.appendChild(panelTitle);

  const controlsGrid = document.createElement('div');
  controlsGrid.className = 'controls-grid';

  if (isMobile()) {
    controlsGrid.innerHTML = `
      <div class="control-item"><span class="control-key">DRAG</span> Look Around</div>
      <div class="control-item"><span class="control-key">JOYSTICK</span> Move Around</div>
      <div class="control-item"><span class="control-key">TAP</span> Touch physical wall bulbs to spell HELP</div>
      <div class="control-item"><span class="control-key">💡</span> Toggle Flashlight</div>
    `;
  } else {
    controlsGrid.innerHTML = `
      <div class="control-item"><span class="control-key">WASD</span> Move around the facility</div>
      <div class="control-item"><span class="control-key">CLICK</span> Lock mouse to look around</div>
      <div class="control-item"><span class="control-key">F</span> Toggle Flashlight on/off</div>
      <div class="control-item"><span class="control-key">Q</span> Toggle help controls menu</div>
      <div class="control-item"><span class="control-key">ESC</span> Unlock mouse cursor</div>
    `;
  }
  controlsPanel.appendChild(controlsGrid);

  enterButton.addEventListener('click', (e) => {
    e.stopPropagation();
    enableOrientationLock();
    
    // Reanudar contexto de audio de forma segura
    soundManager.resumeContext();

    // Activar PointerLock de inmediato si estamos en PC
    if (player && player.controls && !isMobile()) {
      player.controls.lock();
    }

    container.style.opacity = '0';
    setTimeout(() => {
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }
      if (onStartCallback) {
        onStartCallback();
      }
    }, 1500);
  });

  wrapper.appendChild(title);
  wrapper.appendChild(subtitle);
  wrapper.appendChild(enterButton);
  wrapper.appendChild(demogorgon);
  wrapper.appendChild(controlsPanel);

  scrollContainer.appendChild(wrapper);
  container.appendChild(scrollContainer);
  document.body.appendChild(container);
}
