import * as THREE from 'three';
import { USE_NORMAL_MAPS, USE_EXTRA_MAPS, LOW_QUALITY } from '../../utils/constants.js';
import { loadingManager } from '../../ui/Loading/index.js';

const textureLoader = new THREE.TextureLoader(loadingManager);

// ---------------------------------------------------------
// Caché Global de Materiales (Prevención de Fugas de VRAM)
// ---------------------------------------------------------
const materialCache = new Map();

function loadTex(path, rx = 1, ry = 1) {
  const t = textureLoader.load(path);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  return t;
}

const ceilingTexture = loadTex('/models/stranger_things_room/textures/wood-planks_baseColor.jpeg', 4, 3);

export const xmasBulbMaterialNames = ['red_lamp', 'blue_lamp', 'yellow_lamp'];

export function getMaterialName(m) {
  return Array.isArray(m) ? m[0]?.name : m?.name;
}

export function isRoomSurfaceMaterial(n) {
  return [
    'ceiling', 'floor_wood', 'wall_texture',
    'wood-separator', 'wood-planks', 'plank',
    'letters', 'garland_wire'
  ].includes(n);
}

function getBulbColor(name) {
  switch (name) {
    case 'red_lamp': return new THREE.Color(0xff2514);
    case 'blue_lamp': return new THREE.Color(0x20c7ff);
    case 'yellow_lamp': return new THREE.Color(0xffe05a);
    default: return new THREE.Color(0xffffff);
  }
}

export function optimizeMaterial(m) {
  if (!m) return m;

  if (m.map) {
    m.map.generateMipmaps = true;
    m.map.minFilter = THREE.LinearMipmapLinearFilter;
    m.map.magFilter = THREE.LinearFilter;
    m.map.colorSpace = THREE.SRGBColorSpace;
  }

  if (!USE_NORMAL_MAPS && m.normalMap) m.normalMap = null;
  if (!USE_EXTRA_MAPS && m.roughnessMap) m.roughnessMap = null;
  if (!USE_EXTRA_MAPS && m.metalnessMap) m.metalnessMap = null;

  m.needsUpdate = true;
  return m;
}

export function tuneRoomMaterial(material) {
  if (!material) return material;

  // 1. Verificar Caché: Si el material ya fue procesado, devolver la instancia existente
  if (materialCache.has(material.uuid)) {
    return materialCache.get(material.uuid);
  }

  const src = material.clone();
  let finalMaterial = src;

  // 2. Lógica de Materiales Específicos
  if (src.name === 'letters') {
    optimizeMaterial(src);
    finalMaterial = new THREE.MeshBasicMaterial({
      map: src.map,
      color: 0x5a2a14,
      transparent: true,
      alphaTest: 0.02,
      depthTest: true,   // FIX: Mantenemos el test para que no se vea a través de las paredes (Efecto Rayos-X)
      depthWrite: false, // FIX: Desactivamos la escritura para evitar Z-Fighting con el tapiz de la pared
      side: THREE.DoubleSide,
      toneMapped: false,
      name: 'letters',
    });
  }
  else if (xmasBulbMaterialNames.includes(src.name)) {
    finalMaterial = new THREE.MeshBasicMaterial({
      color: getBulbColor(src.name),
      transparent: true,
      opacity: 0.9,
      toneMapped: false,
      name: src.name,
    });
  }
  else {
    // 3. Modificaciones Base (Ambiente Oscuro)
    if (src.color) src.color.multiplyScalar(0.62);
    if (src.emissive) src.emissive.multiplyScalar(0.2);

    // FIX DE HEMISPHERELIGHT: Si el modelo GLTF exportó las paredes/techo con "metalness",
    // al no tener un entorno de reflejos (envMap), el material se renderiza NEGRO ABSOLUTO.
    // Forzamos a que sean mate (roughness 1, metalness 0) para que absorban la luz ambiental.
    if (src.isMeshStandardMaterial) {
      src.metalness = 0.0;
      src.roughness = 1.0;
    }

    if (src.name === 'ceiling') {
      src.map = ceilingTexture;
      // FIX DE TECHO OSCURO: Quitamos el tinte marrón oscuro (0x4a3325) que absorbía toda la luz.
      // En blanco, la textura original de la madera se multiplicará solo por la luz ambiental.
      src.color.set(0xffffff);
    }

    // 4. Degradación Elegante (Fallback) para Calidad Baja
    if (LOW_QUALITY) {
      finalMaterial = new THREE.MeshLambertMaterial({
        color: src.color?.clone() || new THREE.Color(0xffffff),
        map: src.map || null,
        emissive: src.emissive?.clone() || new THREE.Color(0x000000),
        side: THREE.FrontSide,
        name: src.name || '',
      });
      finalMaterial = optimizeMaterial(finalMaterial);
    } else {
      src.side = isRoomSurfaceMaterial(src.name) ? THREE.DoubleSide : THREE.FrontSide;
      finalMaterial = optimizeMaterial(src);
    }
  }

  // 5. Almacenar el material finalizado en el caché antes de retornarlo
  materialCache.set(material.uuid, finalMaterial);
  return finalMaterial;
}