import * as THREE from 'three';
import { USE_NORMAL_MAPS, USE_EXTRA_MAPS, LOW_QUALITY } from '../../utils/constants.js';

// Caché Global de Materiales (Prevención de Fugas de VRAM)
const materialCache = new Map();

export function getMaterialName(m) {
  return Array.isArray(m) ? m[0]?.name : m?.name;
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

export function tuneSchoolMaterial(material) {
  if (!material) return material;

  // 1. Verificar Caché: Si el material ya fue procesado, devolver la instancia existente
  if (materialCache.has(material.uuid)) {
    return materialCache.get(material.uuid);
  }

  const src = material.clone();
  let finalMaterial = src;

  const name = (src.name || '').toLowerCase();

  // 2. Lógica específica para vidrios/cristales si los hay
  if (name.includes('glass') || name.includes('vidrio') || name.includes('transparente')) {
    src.transparent = true;
    src.opacity = 0.4;
    src.depthWrite = false;
    src.side = THREE.DoubleSide;
    finalMaterial = optimizeMaterial(src);
  } else if (name.includes('blood') || name.includes('sangre') || name.includes('mancha') || name.includes('stain') || name.includes('decal') || name.includes('hand') || name.includes('mano') || name.includes('huella') || name.includes('help')) {
    // Forzar transparencia para las manchas de sangre y huellas por si en Blender quedaron como opacas
    src.transparent = true;
    src.alphaTest = 0.1;
    src.depthWrite = false;
    src.side = THREE.DoubleSide;
    src.polygonOffset = true;
    src.polygonOffsetFactor = -1;
  } else {
    // 3. Modificaciones Base para ambiente oscuro y tétrico
    if (src.color) src.color.multiplyScalar(0.6); // Oscurecer un poco para dar tensión
    if (src.emissive) src.emissive.multiplyScalar(0.2);

    // Ajustar materiales estándar para que respondan correctamente sin envMap
    if (src.isMeshStandardMaterial) {
      src.metalness = 0.0;
      src.roughness = 1.0;
    }

    if (LOW_QUALITY) {
      finalMaterial = new THREE.MeshLambertMaterial({
        color: src.color?.clone() || new THREE.Color(0xffffff),
        map: src.map || null,
        emissive: src.emissive?.clone() || new THREE.Color(0x000000),
        side: THREE.FrontSide,
        name: src.name || '',
        transparent: src.transparent || false,
        opacity: src.opacity !== undefined ? src.opacity : 1.0,
        alphaTest: src.alphaTest !== undefined ? src.alphaTest : 0.0,
        depthWrite: src.depthWrite !== undefined ? src.depthWrite : true,
        polygonOffset: src.polygonOffset || false,
        polygonOffsetFactor: src.polygonOffsetFactor !== undefined ? src.polygonOffsetFactor : 0,
        polygonOffsetUnits: src.polygonOffsetUnits !== undefined ? src.polygonOffsetUnits : 0,
        alphaMap: src.alphaMap || null,
        blending: src.blending !== undefined ? src.blending : THREE.NormalBlending
      });
      finalMaterial = optimizeMaterial(finalMaterial);
    } else {
      src.side = THREE.DoubleSide;
      finalMaterial = optimizeMaterial(src);
    }
  }

  // 5. Almacenar en caché
  materialCache.set(material.uuid, finalMaterial);
  return finalMaterial;
}
