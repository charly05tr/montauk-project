// Comprime con Draco los modelos GLB MÁS PESADOS del proyecto: el hospital y las
// raíces (geometría pura). El hospital pasa de ~118MB a ~20MB.
//
// El resto de modelos (demogorgon, escuela, túnel) se dejan SIN comprimir a
// propósito. Requiere que el runtime tenga DRACOLoader configurado (ver AssetCache.js).
//
// Preserva los nombres de los nodos (las colisiones y el nodo "object_9" del portal
// se detectan por nombre), así que NO usamos join/flatten/instancing.
//
// Uso:  node scripts/compress-models.mjs
//
// Reemplaza los .glb en public/models/ in-place. Los originales quedan en el
// historial de Git LFS (git checkout <archivo> para restaurar).

import { NodeIO, Root } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, dedup, prune, draco } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { statSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODELS = resolve(__dirname, '..', 'public', 'models');

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'draco3d.encoder': await draco3d.createEncoderModule(),
    'draco3d.decoder': await draco3d.createDecoderModule(),
  });

const mb = (bytes) => (bytes / 1048576).toFixed(1) + ' MB';

/**
 * @param {string} file        ruta relativa dentro de public/models
 * @param {string[]} keepAnims subcadenas de nombres de animación a CONSERVAR
 *                             (si se pasa, el resto se elimina). undefined = conservar todas.
 */
async function compress(file, keepAnims) {
  const path = resolve(MODELS, file);
  const before = statSync(path).size;
  const doc = await io.read(path);
  const root = doc.getRoot();

  if (keepAnims) {
    let removed = 0;
    for (const anim of root.listAnimations()) {
      const name = (anim.getName() || '').toLowerCase();
      const stay = keepAnims.some((k) => name.includes(k))
        && !name.includes('trans') && !name.includes('fall');
      if (!stay) {
        // Disponer explícitamente samplers y canales: dispose() de la animación
        // por sí solo NO libera sus accesores (quedan huérfanos y prune no los quita).
        anim.listSamplers().forEach((s) => s.dispose());
        anim.listChannels().forEach((c) => c.dispose());
        anim.dispose();
        removed++;
      }
    }
    // Disponer accesores huérfanos (los de las animaciones eliminadas: ~63k en el demogorgon).
    let orphans = 0;
    for (const acc of root.listAccessors()) {
      const parents = acc.listParents().filter((p) => !(p instanceof Root));
      if (parents.length === 0) { acc.dispose(); orphans++; }
    }
    const kept = root.listAnimations().map((a) => a.getName());
    console.log(`  animaciones: eliminadas ${removed}, accesores liberados ${orphans}, conservadas [${kept.join(', ')}]`);
  }

  await doc.transform(
    dedup(),
    weld(),
    prune(), // limpia accesores huérfanos (p.ej. de animaciones eliminadas)
    draco(),
  );

  await io.write(path, doc);
  const after = statSync(path).size;
  console.log(`  ${file}: ${mb(before)} -> ${mb(after)}\n`);
}

// Permite procesar solo algunos modelos:  node scripts/compress-models.mjs demogorgon
const only = process.argv.slice(2);
const want = (file) => only.length === 0 || only.some((a) => file.toLowerCase().includes(a.toLowerCase()));

console.log('Comprimiendo modelos pesados...\n');

if (want('Velez_Paiz')) await compress('Velez_Paiz.glb'); // hospital: ~118MB -> ~20MB
if (want('root')) await compress('root.glb');              // raíces:  ~5MB  -> ~0.6MB
// Demogorgon: 87MB. El peso son sus 92 animaciones (~60MB); solo usamos 2.
// Conservamos WalkHuntFT (aparición) y RunEndgame (persecución) -> ~13MB.
if (want('demogorgon')) await compress('demogorgon.glb', ['walkhuntft', 'runendgame']);

console.log('Listo.');
