# Arquitectura del Proyecto Montauk

Montauk es un juego / experiencia interactiva en primera persona (First-Person) desarrollado en la web. El proyecto está construido para ejecutarse en el navegador, aprovechando WebGL para la renderización 3D y Web Audio API para el sonido espacial y sintetizado.

## 1. Tecnologías Base

*   **HTML/CSS/JavaScript (ES6 Modules):** Lenguajes base del proyecto. Toda la lógica del juego está modularizada.
*   **Vite:** Herramienta de build y servidor de desarrollo. Empaqueta los módulos de JavaScript de forma ultra-rápida y optimiza los assets estáticos para producción (en Vercel).
*   **Vercel:** Plataforma de despliegue y hosting para el entorno de producción. Se encarga de servir la aplicación generada por Vite.

## 2. Librerías Principales

*   **Three.js (`three`):** El motor gráfico principal. Maneja la renderización 3D (WebGLRenderer), la cámara, luces, sombras, materiales (PBR), carga de modelos GLTF y la estructura de escenas (Scene Graph).
*   **Cannon-es (`cannon-es`):** Motor de físicas 3D ligero escrito en JavaScript. Gestiona colisiones, gravedad, velocidades y cálculos de intersección para evitar que el jugador atraviese paredes o caiga al vacío.

## 3. Arquitectura General y Patrones

El proyecto utiliza una arquitectura basada en componentes modulares que actúan coordinadamente bajo un gestor central (Singleton). El bucle principal del juego se encuentra en `src/main.js`, el cual inicializa los sistemas, sincroniza Three.js (gráfico) con Cannon.js (físicas) y llama a los métodos de actualización (`update`) en cada frame (`requestAnimationFrame`).

### Scene Manager (`src/core/SceneManager.js`)
Actúa como el orquestador principal del juego.
*   **Gestión de Estado:** Conoce qué escena está activa (ej. `scene1`, `scene2`, etc.).
*   **Carga y Descarga:** Para evitar fugas de memoria (Memory Leaks), el `SceneManager` es responsable de limpiar exhaustivamente la escena de Three.js (VRAM, geometrías, materiales) y limpiar el mundo físico de Cannon.js antes de cargar una nueva escena.
*   **Inyección de Dependencias:** Inyecta explícitamente instancias globales (`physicsWorld`, `player`, `sceneManager`) hacia las funciones de inicialización de las sub-escenas para evitar dependencias circulares problemáticas en el bundle final de producción.
*   **Transiciones Cinemáticas:** Gestiona el paso entre niveles realizando fade-to-black, bloqueando controles, precompilando shaders en segundo plano (para eliminar el "lag spike" del primer frame de una escena) y realizando el fade-in de forma segura.

## 4. Componentes Core

### Renderer (`src/core/Renderer.js`)
Se encarga de configurar el `WebGLRenderer` de Three.js con configuraciones orientadas al rendimiento y la estética cinematográfica:
*   Espacio de color `THREE.SRGBColorSpace` y tone mapping `THREE.ACESFilmicToneMapping` para que la luz reaccione como el celuloide de una película real.
*   `powerPreference: 'high-performance'` para forzar al navegador a usar la tarjeta gráfica dedicada si existe.
*   Capacidad de alternar la precisión (`mediump` o `highp`) según la constante de calidad.

### Atmósfera (`src/core/AtmosphereManager.js`)
Controla el "mood" y la ambientación global en todo el juego.
*   Mantiene una paleta base de tonos gélidos y oscuros (azules y cianes profundos).
*   Inyecta una `HemisphereLight` de manera consistente en cualquier escena cargada, garantizando que haya una luz global de relleno de abajo-hacia-arriba (evitando que los techos sean 100% negros).
*   Configura `THREE.FogExp2` para un difuminado gradual en la distancia que oculta los bordes del mapa y otorga un aire de misterio.

### Iluminación (`src/core/Lights.js`)
Gestiona focos principales, como la linterna del jugador (`cameraLight`).
*   Configura una `SpotLight` posicionada ligeramente *detrás* del plano focal de la cámara (para evitar la singularidad matemática y la sobreexposición al pegar la cámara contra las paredes).
*   Calcula y actualiza un `target` a 5 metros frente al jugador, logrando que el cono de luz siempre siga perfectamente a la cámara de forma fluida.

### Físicas (`src/physics/PhysicsWorld.js` & `Collider.js`)
*   **Configuración (Cannon.js):** El mundo usa una escala realista 1:1, con una gravedad de la Tierra (`-9.81`). Utiliza `SAPBroadphase` (Sweep and Prune) para la detección de colisiones general, lo cual es inmensamente más rápido en mundos estáticos. La fricción por defecto es 0.0, permitiendo que el personaje controle la aceleración independientemente, resbalando sobre superficies en lugar de pegarse a ellas por colisiones laterales.
*   **Colisionadores Generados Automáticamente:** Mediante heurísticas complejas durante la carga de un GLTF (`Collider.js` y las escenas), el código analiza el tamaño de cada nodo de la malla 3D.
    *   **Box Colliders:** Para elementos estructurales regulares.
    *   **Trimesh Colliders:** Para estructuras arquitectónicas no cuadradas.
    *   **Filtros de Nodos Agrupados:** Muebles o "props" muy grandes o con ratios "huella/altura" anómalos son ignorados como colliders masivos (los cuales originaban plataformas o "techos invisibles" de colisión sobre las cabezas de los jugadores). En su lugar, usa un Raycaster para buscar el piso real y "surgir" (spawnear) de forma segura.

### Sonido (`src/core/SoundManager.js`)
Es una de las piezas más avanzadas del motor. Controla la inmersión auditiva total:
*   **Caché:** Precarga buffers (`AudioBuffer`) de sonidos frecuentes para no bloquear la red en media partida.
*   **Audios Posicionales (`THREE.PositionalAudio`):** Vincula un sonido tridimensional a una malla del juego (`Mesh`). Al moverse el jugador, calcula paneo estéreo, distancia y atenuación (`rolloff`).
*   **Web Audio API (Síntesis):** El manager tiene la capacidad de generar efectos de forma algorítmica si no se encuentra un MP3. Por ejemplo, `playSynthesizedDoorOpen()` orquesta osciladores, filtros biquad, ganancias y rampas exponenciales para sintetizar el crujido de una puerta de madera.
*   **Procesamiento de Señal Digital en Tiempo Real:** El mánager decodifica pistas de audio enteras (como pistas de pasos de 8 segundos) en tiempo de ejecución. Analiza picos de frecuencia y canales de audio (`detectFootsteps`) para auto-recortar "slices" perfectos de 400ms que corresponden a pasos singulares, y los sincroniza dinámicamente con la velocidad a la que el jugador pulse "W" o "S". Hace exactamente lo mismo con los clics de teclado, logrando foley procedural altamente complejo sin bibliotecas adicionales de sonido.
