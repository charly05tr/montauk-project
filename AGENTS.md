# AGENTS.md — Proyecto Montauk

A Stranger Things interactive 3D web experience (Three.js + Cannon-es + Vite).

## Commands

| Command | Action |
|---------|--------|
| `npm run dev` | Start Vite dev server (opens browser, host: true for LAN) |
| `npm run build` | Production build to `dist/` (no typecheck/lint/test) |
| `npm run preview` | Preview production build |

## Tech Stack

- **Three.js** (`^0.184.0`) — WebGL renderer, post-processing (EffectComposer, FilmPass, VignetteShader), PointerLockControls
- **Cannon-es** (`^0.20.0`) — Physics with SAPBroadphase, sphere player body, gravity -9.81
- **Vite** (`^8.0.12`) — Build tool with `vite-plugin-glsl` for `.glsl` imports
- **Vercel** — Deployment (project: `montauk-project`)
- **Vanilla JS** (ES6 modules, no framework)
- Config: `vite-config.js` — GLSL plugin, host:true, open:true, chunkSizeWarningLimit:1500

## Architecture

- **Entry**: `src/main.js` — initialises all systems, game loop with `requestAnimationFrame`
- **SceneManager** singleton (`src/core/SceneManager.js`) — orchestrates 4 scenes, handles transitions (fade-to-black, precompiles shaders), injects atmosphere
- **Player** (`src/core/Player.js`) — FPS controls (PointerLockControls), sphere physics body (radius 0.3, eyeHeight 1.5), flashlight (F key, SpotLight), movementSpeed 8.0
- **SoundManager** singleton (`src/core/SoundManager.js`) — ambient/positional audio, procedural footstep/keyboard slice detection from audio buffers, Web Audio API synthesis fallback
- **Renderer** (`src/core/Renderer.js`) — `WebGLRenderer` with `ACESFilmicToneMapping`, `SRGBColorSpace`, `high-performance`, `mediump` precision
- **Post-processing**: RenderPass → FilmPass (0.35, 0.4, 648, false) → VignetteShader (offset:1.0, darkness:1.1)
- **Lights** (`src/core/Lights.js`) — camera-following SpotLight (flashlight), HemisphereLight via AtmosphereManager
- **Physics** (`src/physics/PhysicsWorld.js`) — gravity -9.81, friction 0.0, restitution 0.0, player-fixed rotation
- **Event bus** (`src/utils/eventBus.js`) — simple EventTarget wrapper
- **Constants** (`src/utils/constants.js`) — quality toggles: `LOW_QUALITY`, `USE_NORMAL_MAPS`, `USE_EXTRA_MAPS`, `ENABLE_SHADOWS`, `ENABLE_XMAS_POINT_LIGHTS`
- **CSS**: All inline/JS-generated (no `.css` files)

## Scene Flow

```
Scene1 (Joyce's living room) → Scene2 (Hawkins lab hallway) → Scene3 (organic tunnel) → Scene4 (rainbow room)
```

- **Scene1**: Loads `stranger_things_room/scene.gltf`. Interactive alphabet wall. Type/spell "HELP" letter-by-letter (or tap bulbs on mobile) to trigger portal sequence to Scene2.
- **Scene2**: Modular hallway segments cloned programmatically. Fluctuating lights + forward movement.
- **Scene3**: UV-scrolling texture tunnel (TubeGeometry, texture offset animation). Zero Z-movement — camera stays static, UV scroll creates motion illusion.
- **Scene4**: Destroyed rainbow room with particle system (spores), post-processing effects.

**Debug**: Type "help" anywhere (except Scene1, where the alphabet takes priority) to teleport to next scene.

## Key Assets

- **Models** (`public/models/`): `stranger_things_room/scene.gltf` + bin/textures, `tunel/tunelST.glb` + texture, `Escuela.glb`, `demogorgon.glb`, `Velez_Paiz.glb`
- **Sounds** (`public/sounds/`): `steps.mp3`, `keyboard.mp3`, `phone_ringing.mp3`, `door_open.mp3`, scene music files
- **Shaders** (`src/shaders/`): `portalFragment.glsl` / `portalVertex.glsl` (animated portal tunnel), `customFragment.glsl` / `customVertex.glsl`

## Quirks & Gotchas

- **Missing audio files fallback**: SoundManager auto-synthesises door/portal sounds via Web Audio API if MP3 not found
- **Mobile**: Custom virtual joystick (`src/ui/MobileControls/`), orientation lock to landscape (`src/utils/orientationLock.js`), `?mobile` query param forces mobile mode
- **No test/lint/typecheck tooling** — only build verification
- **No CSS files** — all styles injected via JS
- **Particle textures** generated procedurally (canvas → CanvasTexture)
- **GLTF cache** (`src/utils/AssetCache.js`) — only caches GLTF/GLB (not audio)
- **Scene transitions**: `fadeToBlack(1200ms)` → switch scene → compile shaders → `fadeInFromBlack(1200ms)`
- **Asset preloading**: `SceneManager.preloadSceneAssets(sceneId)` loads models before switching (used for Scene1 and Scene3)
- **Physics**: SAPBroadphase broadphase, sleep enabled, min thickness 0.02m for colliders, heuristics skip props with footprint/height ratio > 12
- **Entry HTML**: `index.html` with `#app-ui` overlay div and `#app` canvas div
