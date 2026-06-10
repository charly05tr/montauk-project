import { isMobile } from '../../utils/deviceDetection.js';
import { soundManager } from '../../core/SoundManager.js';
import { sceneManager } from '../../core/SceneManager.js';
import { setHelpTextVisible, setExitButtonVisible } from '../Overlay/index.js';

let isPaused = false;
let pauseOverlay = null;
let playerRef = null;
let physicsWorldRef = null;
let exitCallback = null;

export function initPauseMenu(player, physicsWorld, exitCb) {
  playerRef = player;
  physicsWorldRef = physicsWorld;
  exitCallback = exitCb;
  createUI();
}

function createUI() {
  pauseOverlay = document.createElement('div');
  pauseOverlay.id = 'pause-overlay';
  pauseOverlay.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 100000;
    display: none;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    font-family: 'Courier New', Courier, monospace;
  `;

  pauseOverlay.addEventListener('touchend', (e) => {
    if (e.target === pauseOverlay) hidePauseMenu();
  }, { passive: false });
  pauseOverlay.addEventListener('click', (e) => {
    if (e.target === pauseOverlay) hidePauseMenu();
  });

  const menu = document.createElement('div');
  menu.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: #0a0505;
    border: 1px solid #ff7a2b;
    border-radius: 12px;
    padding: 32px;
    min-width: 260px;
    text-align: center;
    box-shadow: 0 0 30px rgba(255, 122, 43, 0.2);
  `;

  const title = document.createElement('h2');
  title.textContent = 'PAUSED';
  title.style.cssText = `
    color: #ff7a2b;
    font-family: 'Courier New', Courier, monospace;
    font-size: 1.5rem;
    margin: 0 0 24px 0;
    letter-spacing: 3px;
  `;
  menu.appendChild(title);

  const resumeBtn = createMenuButton('Resume', () => hidePauseMenu());
  menu.appendChild(resumeBtn);

  if (sceneManager.previousSceneId) {
    const prevSceneBtn = createMenuButton('Return to Previous Scene', () => {
      hidePauseMenu();
      sceneManager.switchSceneWithTransition(sceneManager.previousSceneId, physicsWorldRef, playerRef);
    });
    menu.appendChild(prevSceneBtn);
  }

  const sfxBtn = createMenuButton('', () => {
    soundManager.toggleSfxMute();
    sfxBtn.textContent = `Sound Effects: ${soundManager.isSfxMuted() ? 'OFF' : 'ON'}`;
  });
  sfxBtn.textContent = `Sound Effects: ${soundManager.isSfxMuted() ? 'OFF' : 'ON'}`;
  menu.appendChild(sfxBtn);

  const musicBtn = createMenuButton('', () => {
    soundManager.toggleMusicMute();
    musicBtn.textContent = `Music: ${soundManager.isMusicMuted() ? 'OFF' : 'ON'}`;
  });
  musicBtn.textContent = `Music: ${soundManager.isMusicMuted() ? 'OFF' : 'ON'}`;
  menu.appendChild(musicBtn);

  const exitBtn = createMenuButton('Exit to Facility Entrance', async () => {
    hidePauseMenu(true);
    const { fadeToBlack, fadeInFromBlack } = await import('../Overlay/index.js');
    await fadeToBlack(800);
    if (exitCallback) exitCallback();
    await fadeInFromBlack(800);
  });
  menu.appendChild(exitBtn);

  pauseOverlay.appendChild(menu);
  document.body.appendChild(pauseOverlay);
}

function createMenuButton(text, onClick) {
  const btn = document.createElement('button');
  btn.textContent = text;
  btn.style.cssText = `
    display: block;
    width: 100%;
    padding: 12px 20px;
    margin: 8px 0;
    background: rgba(255, 122, 43, 0.08);
    color: #ff7a2b;
    border: 1px solid rgba(255, 122, 43, 0.3);
    border-radius: 8px;
    font-family: 'Courier New', Courier, monospace;
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.2s ease;
    text-transform: uppercase;
    letter-spacing: 1px;
    outline: none;
  `;
  btn.addEventListener('mouseenter', () => {
    btn.style.background = 'rgba(255, 122, 43, 0.2)';
    btn.style.borderColor = '#ff7a2b';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.background = 'rgba(255, 122, 43, 0.08)';
    btn.style.borderColor = 'rgba(255, 122, 43, 0.3)';
  });
  btn.addEventListener('click', onClick);
  btn.addEventListener('touchend', (e) => {
    e.preventDefault();
    onClick();
  }, { passive: false });
  return btn;
}

export function showPauseMenu() {
  if (isPaused) return;
  isPaused = true;
  pauseOverlay.style.display = 'block';
  setHelpTextVisible(false);
  setExitButtonVisible(false);
  if (playerRef) {
    playerRef.body.velocity.set(0, 0, 0);
    playerRef.body.angularVelocity.set(0, 0, 0);
  }
}

export function hidePauseMenu(skipRelock = false) {
  if (!isPaused) return;
  isPaused = false;
  pauseOverlay.style.display = 'none';
  if (!skipRelock && playerRef && playerRef.controls && !isMobile()) {
    playerRef.controls.lock();
  }
}

export function isPausedFn() {
  return isPaused;
}
