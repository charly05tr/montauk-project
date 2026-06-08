export function initLandingPage(onStartCallback) {
  const container = document.createElement('div');
  container.id = 'landing-page';
  container.style.cssText = `
    position: fixed;
    inset: 0;
    background-color: #050505;
    background-image: radial-gradient(circle at center, #110000 0%, #000000 100%);
    z-index: 999999;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    color: white;
    font-family: 'Courier New', Courier, monospace;
    opacity: 1;
    transition: opacity 1.5s ease-in-out;
  `;

  // Añadimos estilos de animación y fuentes
  const style = document.createElement('style');
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Creepster&display=swap');
    
    /* CHRISTMAS LIGHTS */
    .lightrope {
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      position: absolute;
      z-index: 1;
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

    /* DEMOGORGON SVG */
    .demogorgon-icon {
      width: 60px;
      height: 60px;
      margin-top: 20px;
      animation: float 3s ease-in-out infinite;
      filter: drop-shadow(0 0 5px #ff0f0f);
    }
    
    @keyframes float {
      0% { transform: translateY(0px) rotate(0deg); }
      50% { transform: translateY(-10px) rotate(5deg); }
      100% { transform: translateY(0px) rotate(0deg); }
    }

    /* CONTROLS (SIDES) */
    .montauk-controls-side {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      padding: 15px 30px;
      border: 1px dashed #555;
      background: rgba(20, 0, 0, 0.4);
      border-radius: 8px;
      color: #ccc;
      font-size: 0.9rem;
      text-align: left;
      line-height: 1.8;
      box-shadow: 0 0 10px rgba(255,0,0,0.1);
    }
    
    .montauk-controls-side.left {
      left: 40px;
    }
    
    .montauk-controls-side.right {
      right: 40px;
    }
    
    .montauk-controls-side span {
      color: #ff0f0f;
      font-weight: bold;
      display: inline-block;
      width: 80px;
    }

    .montauk-title {
      font-family: 'Creepster', system-ui, cursive;
      font-size: 5rem;
      color: #ff0f0f;
      text-transform: uppercase;
      letter-spacing: 0.2em;
      text-shadow: 0 0 10px #ff0f0f, 0 0 20px #ff0f0f, 0 0 40px #8a0000;
      margin-top: 60px;
      margin-bottom: 20px;
      animation: flicker 4s infinite;
      text-align: center;
    }
    
    .montauk-subtitle {
      font-size: 1.2rem;
      color: #aaaaaa;
      max-width: 600px;
      text-align: center;
      line-height: 1.6;
      margin-bottom: 50px;
      letter-spacing: 0.05em;
    }
    
    .montauk-button {
      background: transparent;
      color: #ff0f0f;
      border: 2px solid #ff0f0f;
      padding: 15px 40px;
      font-size: 1.5rem;
      font-family: 'Courier New', Courier, monospace;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      cursor: pointer;
      border-radius: 4px;
      box-shadow: 0 0 15px rgba(255, 15, 15, 0.2), inset 0 0 15px rgba(255, 15, 15, 0.2);
      transition: all 0.3s ease;
      margin-bottom: 20px;
    }
    
    .montauk-button:hover {
      background: #ff0f0f;
      color: #000;
      box-shadow: 0 0 30px rgba(255, 15, 15, 0.8), inset 0 0 15px rgba(255, 15, 15, 0.5);
      transform: scale(1.05);
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

    @media (max-width: 1024px) {
      .montauk-controls-side {
        display: none; /* Hide side controls on small screens to prevent overlap */
      }
      .montauk-title {
        font-size: 3rem;
      }
      .montauk-subtitle {
        font-size: 1rem;
        padding: 0 20px;
      }
    }
  `;
  document.head.appendChild(style);

  // Añadir luces de navidad
  const lightrope = document.createElement('ul');
  lightrope.className = 'lightrope';
  for (let i = 0; i < 30; i++) {
    lightrope.appendChild(document.createElement('li'));
  }
  container.appendChild(lightrope);

  const title = document.createElement('h1');
  title.className = 'montauk-title';
  title.textContent = 'Montauk Project';

  const subtitle = document.createElement('p');
  subtitle.className = 'montauk-subtitle';
  subtitle.innerHTML = 'Welcome to this Stranger Things virtual experience.<br><br>Warning: This interactive simulation contains flashing lights, sudden noises, and experimental spatial anomalies. Proceed with caution.';

  const enterButton = document.createElement('button');
  enterButton.className = 'montauk-button';
  enterButton.textContent = 'Enter Facility';

  // Pequeño Demogorgon (SVG)
  const demogorgon = document.createElement('div');
  demogorgon.innerHTML = `
    <svg class="demogorgon-icon" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <path d="M50 20 L60 40 L85 30 L65 50 L85 70 L60 60 L50 85 L40 60 L15 70 L35 50 L15 30 L40 40 Z" fill="#222" stroke="#ff0f0f" stroke-width="2" stroke-linejoin="round"/>
      <circle cx="50" cy="50" r="12" fill="#ff0f0f" opacity="0.3" />
      <path d="M45 45 L50 55 L55 45 Z" fill="#ff0f0f" />
    </svg>
  `;

  // Controles Izquierda
  const controlsLeft = document.createElement('div');
  controlsLeft.className = 'montauk-controls-side left';
  controlsLeft.innerHTML = `
    <div><span>W A S D</span> - Move around</div>
    <div><span>CLICK</span> - Lock mouse & Look</div>
  `;

  // Controles Derecha
  const controlsRight = document.createElement('div');
  controlsRight.className = 'montauk-controls-side right';
  controlsRight.innerHTML = `
    <div><span>ESC</span> - Unlock mouse</div>
    <div><span>F</span> - Toggle Flashlight</div>
    <div><span>Q</span> - Toggle UI Help</div>
  `;

  enterButton.addEventListener('click', (e) => {
    // Evitamos que el clic se propague y active el PointerLock del juego accidentalmente
    e.stopPropagation();

    // Desvanecemos la pantalla
    container.style.opacity = '0';

    // Esperamos la transición para removerla e iniciar la app
    setTimeout(() => {
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }
      if (onStartCallback) {
        onStartCallback();
      }
    }, 1500);
  });

  container.appendChild(title);
  container.appendChild(subtitle);
  container.appendChild(enterButton);
  container.appendChild(demogorgon);
  container.appendChild(controlsLeft);
  container.appendChild(controlsRight);

  document.body.appendChild(container);
}
