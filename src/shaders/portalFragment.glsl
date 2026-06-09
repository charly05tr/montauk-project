uniform float uTime;
uniform float uProgress;
uniform sampler2D uTexture;
varying vec2 vUv;

// Función para obtener la altura de la textura (usada para relieve/normal mapping)
float getVal(vec2 uv) {
    // Tomamos la componente roja como altura/relieve
    return texture2D(uTexture, uv).r;
}

void main() {
    // Mapeo a coordenadas polares respecto al centro del portal (0.5, 0.5)
    vec2 center = vUv - 0.5;
    float dist = length(center);
    float angle = atan(center.y, center.x);

    // Si está fuera del disco, no pintar (con suavizado de bordes)
    // El radio de nuestro CircleGeometry es 0.71, pero en UV el centro es 0.5,
    // por lo que el borde del círculo está a dist = 0.5.
    float maxRadius = 0.5;
    float edgeAlpha = smoothstep(maxRadius, maxRadius - 0.05, dist);

    // --- EFECTO DE TÚNEL RADIAL ---
    // U representa el ángulo alrededor del cilindro (repetido)
    // V representa la distancia/perspectiva hacia el fondo (1.0 / dist)
    // Añadimos un pequeño offset de seguridad en el divisor para evitar divisiones por cero
    float u = angle / (2.0 * 3.14159265);
    float v = 0.22 / (dist + 0.015);

    // --- EFECTO DE VÓRTICE / ESPIRAL ANIMADO ---
    // Hacemos que el túnel gire (swirl) según nos adentramos en él (dist)
    u += dist * 1.1 - uTime * 0.08;
    
    // Animación de viaje constante hacia el fondo del túnel
    v -= uTime * 0.6;

    // Coordenadas UV finales del túnel
    vec2 tunnelUV = vec2(u, v);

    // --- RELIEVE EN 3D (BUMP MAPPING) ---
    // Calculamos el gradiente de la textura para generar normales falsas
    float h = 0.008; // paso del gradiente
    float val = getVal(tunnelUV);
    float valX = getVal(tunnelUV + vec2(h, 0.0));
    float valY = getVal(tunnelUV + vec2(0.0, h));
    
    // Normal perturbada basada en el gradiente de relieve
    // Multiplicamos la diferencia para acentuar el relieve (profundidad de las grietas)
    vec3 normal = normalize(vec3((val - valX) * 4.5, (val - valY) * 4.5, 1.0));

    // Vector de luz que viene desde la entrada del portal hacia el fondo
    // Esto crea reflejos en los bordes de la textura apuntando al observador
    vec3 lightDir = normalize(vec3(0.0, 0.0, 1.0));
    float diff = max(dot(normal, lightDir), 0.0);

    // Modulador de luz: da relieve 3D a la textura
    float shadow = mix(0.35, 1.35, diff);

    // Muestrear la textura con la sombra del relieve aplicada
    vec4 texColor = texture2D(uTexture, tunnelUV);
    vec3 litTexture = texColor.rgb * shadow;

    // --- EFECTOS VISUALES DEL PORTAL ---
    // 1. Neblina/Abismo oscuro en el fondo (el centro dist -> 0 debe ser negro)
    float abyssFog = smoothstep(0.02, 0.38, dist);
    
    // 2. Halo/Brillo de energía azul en el borde exterior del portal
    float edgeGlow = smoothstep(0.1, maxRadius, dist);
    vec3 portalBlue = vec3(0.05, 0.40, 1.0);
    vec3 energyColor = portalBlue * edgeGlow * 1.5;

    // 3. Destellos centrales / distorsión de energía
    float energySpiral = sin(angle * 6.0 - uTime * 4.0 + dist * 15.0) * 0.5 + 0.5;
    vec3 energyCore = vec3(0.2, 0.6, 1.0) * energySpiral * edgeGlow * 0.4;

    // Mezclamos la textura del túnel con la energía del portal
    // En el borde exterior domina la energía azul brillante; en el interior domina la textura del túnel en 3D
    vec3 finalColor = mix(litTexture * abyssFog, energyColor + energyCore, edgeGlow * 0.45);
    
    // Añadir un pequeño toque de luz ambiental azul general del portal
    finalColor += portalBlue * edgeGlow * 0.25;

    // Opacidad final controlada por el progreso de la apertura y el fade del borde
    float alpha = edgeAlpha * uProgress;

    gl_FragColor = vec4(finalColor, alpha);
}
