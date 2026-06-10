import { isMobile } from './deviceDetection.js';

let isEnforcing = false;
let overlayElement = null;

function requestFullscreen() {
  const el = document.documentElement;
  if (el.requestFullscreen) {
    el.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
  } else if (el.webkitRequestFullscreen) {
    el.webkitRequestFullscreen();
  } else if (el.msRequestFullscreen) {
    el.msRequestFullscreen();
  }
}

export function enableOrientationLock() {
  isEnforcing = true;
  requestFullscreen();
  if (overlayElement) {
    checkOrientation();
  }
}

function checkOrientation() {
  if (!overlayElement) return;
  
  if (!isEnforcing) {
    overlayElement.classList.remove('visible');
    return;
  }
  
  const isPortrait = window.innerHeight > window.innerWidth;
  
  if (isPortrait) {
    overlayElement.classList.add('visible');
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    window.scrollTo(0, 0);
  } else {
    overlayElement.classList.remove('visible');
    document.documentElement.style.overflow = '';
    // El juego siempre maneja overflow hidden en el body
    document.body.style.overflow = 'hidden';
    requestFullscreen();
  }
}

export function initOrientationLock() {
  if (!isMobile()) return;

  const style = document.createElement('style');
  style.textContent = `
    #orientation-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: #000000;
      background-image: radial-gradient(circle at center, #150202 0%, #000000 100%);
      z-index: 9999999999;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: white;
      font-family: 'Courier New', Courier, monospace;
      text-align: center;
      padding: 30px;
      margin: 0;
      border: none;
      box-sizing: border-box;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.4s ease-in-out;
    }
    
    #orientation-overlay.visible {
      opacity: 1;
      pointer-events: auto;
    }
    
    .rotate-device-icon {
      width: 110px;
      height: 110px;
      margin-bottom: 25px;
      filter: drop-shadow(0 0 12px rgba(255, 15, 15, 0.85));
    }
    
    .phone-group {
      animation: rotatePhoneSVG 2.5s ease-in-out infinite;
      transform-origin: 50px 50px;
    }
    
    .phone-screen {
      fill: rgba(255, 15, 15, 0.05);
      stroke: rgba(255, 15, 15, 0.3);
      stroke-width: 1;
      animation: screenGlow 2.5s ease-in-out infinite;
    }
    
    .rotation-arc {
      stroke: #ff0f0f;
      stroke-width: 2;
      animation: slideDashes 1.5s linear infinite;
    }
    
    .ripple {
      stroke: #ff0f0f;
      stroke-width: 1.5;
      fill: none;
      opacity: 0;
      transform-origin: 50px 50px;
      animation: rippleAnim 2.5s ease-out infinite;
    }
    
    .ripple-2 {
      animation-delay: 0.3s;
    }
    
    @keyframes rotatePhoneSVG {
      0%, 15% {
        transform: rotate(0deg);
      }
      40%, 75% {
        transform: rotate(-90deg);
      }
      90%, 100% {
        transform: rotate(0deg);
      }
    }
    
    @keyframes screenGlow {
      0%, 15%, 90%, 100% {
        fill: rgba(255, 15, 15, 0.05);
      }
      40%, 75% {
        fill: rgba(255, 15, 15, 0.2);
        stroke: rgba(255, 15, 15, 0.6);
      }
    }
    
    @keyframes slideDashes {
      to {
        stroke-dashoffset: -16;
      }
    }
    
    @keyframes rippleAnim {
      0%, 35% {
        transform: scale(0.5);
        opacity: 0;
      }
      45% {
        opacity: 0.5;
      }
      70% {
        transform: scale(1.6);
        opacity: 0;
      }
      100% {
        opacity: 0;
      }
    }
    
    .orientation-title {
      font-family: 'Creepster', system-ui, cursive;
      font-size: clamp(1.8rem, 5vw, 2.5rem);
      color: #ff0f0f;
      letter-spacing: 3px;
      text-shadow: 0 0 10px #ff0f0f, 0 0 25px rgba(255, 15, 15, 0.6);
      margin-top: 10px;
      margin-bottom: 15px;
      text-transform: uppercase;
      animation: neonPulse 2s infinite alternate;
    }
    
    .orientation-text {
      font-family: 'Outfit', sans-serif;
      font-size: clamp(0.95rem, 2.8vw, 1.1rem);
      color: #aaaaaa;
      line-height: 1.6;
      max-width: 440px;
      letter-spacing: 0.5px;
    }

    @keyframes neonPulse {
      from {
        text-shadow: 0 0 10px #ff0f0f, 0 0 20px rgba(255, 15, 15, 0.5);
      }
      to {
        text-shadow: 0 0 15px #ff0f0f, 0 0 35px rgba(255, 15, 15, 0.8), 0 0 50px #8a0000;
      }
    }
  `;
  document.head.appendChild(style);

  // Asegurar fuentes importadas
  if (!document.querySelector("link[href*='fonts.googleapis.com']")) {
    const fontLink = document.createElement('link');
    fontLink.rel = 'stylesheet';
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Creepster&family=Outfit:wght@300;450&display=swap';
    document.head.appendChild(fontLink);
  }

  const overlay = document.createElement('div');
  overlay.id = 'orientation-overlay';

  // SVG elegante de teléfono rotando con ripples de estabilización y arco deslizante
  overlay.innerHTML = `
    <svg class="rotate-device-icon" viewBox="0 0 100 100" fill="none" stroke="#ff0f0f" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <!-- Ripples / Ondas de estabilización -->
      <circle class="ripple ripple-1" cx="50" cy="50" r="25" />
      <circle class="ripple ripple-2" cx="50" cy="50" r="25" />

      <!-- Arco de rotación deslizante -->
      <path class="rotation-arc" d="M 50 12 A 38 38 0 0 0 12 50" stroke-dasharray="4 4" />
      <path d="M 12 50 L 17 44 M 12 50 L 7 44" stroke-width="2.5" />

      <!-- Teléfono animado -->
      <g class="phone-group">
        <!-- Cuerpo del teléfono -->
        <rect x="36" y="15" width="28" height="70" rx="4" fill="rgba(10, 0, 0, 0.7)" />
        <!-- Pantalla brillante -->
        <rect x="39" y="19" width="22" height="58" rx="2" class="phone-screen" />
        <!-- Parlante superior -->
        <line x1="45" y1="17" x2="55" y2="17" stroke-width="1.5" />
        <!-- Botón Home -->
        <circle cx="50" cy="81" r="1.5" />
      </g>
    </svg>
    <div class="orientation-title">Landscape Required</div>
    <div class="orientation-text">
      Please rotate your device horizontal to stabilize the neural connection to the Upside Down.
    </div>
  `;
  
  // Apendizar al elemento raíz (HTML) para evitar problemas de posicionamiento causados por transforms en body o app
  document.documentElement.appendChild(overlay);
  overlayElement = overlay;

  try {
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('landscape').catch(() => {});
    }
  } catch (e) {}

  checkOrientation();
  window.addEventListener('resize', checkOrientation);
  window.addEventListener('orientationchange', checkOrientation);
}
