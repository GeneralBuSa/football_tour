#!/usr/bin/env node
// Next.js statik export'unun Windows'ta yanlış adlandırdığı segment dosyalarını düzeltir.
//
// İstemci yönlendiricisi, bağlantıları önceden yüklerken (prefetch) segment verisini
// "<route>/__next.<route>.__PAGE__.txt" gibi noktalı adlarla ister. Next.js bu adı
// path.relative() çıktısından üretir; Windows'ta ayraç "\" olduğundan dosyalar
// "<route>/__next.<route>/__PAGE__.txt" klasör yapısıyla yazılır ve prefetch 404 alır.
// Bu betik o klasörleri beklenen düz dosya adlarına dönüştürür. Linux/macOS'ta böyle
// klasör oluşmadığı için hiçbir şey yapmaz.
//
//   node scripts/fix-export-segments.mjs [outDir]
import { existsSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SEGMENT_DIR_PREFIX = '__next.';

function listFiles(dir, base = dir) {
  return readdirSync(dir).flatMap(name => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? listFiles(full, base) : [path.relative(base, full)];
  });
}

export function fixExportSegments(outDir) {
  const moved = [];
  const visit = dir => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (!statSync(full).isDirectory()) continue;
      if (!name.startsWith(SEGMENT_DIR_PREFIX)) {
        visit(full);
        continue;
      }
      // __next.history/__PAGE__.txt  ->  __next.history.__PAGE__.txt
      for (const relative of listFiles(full)) {
        const flatName = `${name}.${relative.split(path.sep).join('.')}`;
        const target = path.join(dir, flatName);
        if (!existsSync(target)) {
          renameSync(path.join(full, relative), target);
          moved.push(path.relative(outDir, target));
        }
      }
      rmSync(full, { recursive: true, force: true });
    }
  };
  if (existsSync(outDir)) visit(outDir);
  return moved;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outDir = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'out'));
  const moved = fixExportSegments(outDir);
  if (moved.length) console.log(`[fix-export-segments] ${moved.length} segment dosyası düzeltildi.`);
}
