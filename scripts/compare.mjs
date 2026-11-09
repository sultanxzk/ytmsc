import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REF_DIR = path.join(__dirname, '..', 'reference');
const OUT_DIR = path.join(__dirname, '..', 'reference', 'diff');

fs.mkdirSync(OUT_DIR, { recursive: true });

function compare(refName, localName) {
  const refPath = path.join(REF_DIR, refName);
  const localPath = path.join(REF_DIR, localName);
  if (!fs.existsSync(refPath) || !fs.existsSync(localPath)) {
    return { pass: false, reason: `faltou ${!fs.existsSync(refPath) ? refName : localName}` };
  }
  const ref = PNG.sync.read(fs.readFileSync(refPath));
  const local = PNG.sync.read(fs.readFileSync(localPath));
  const w = Math.min(ref.width, local.width);
  const h = Math.min(ref.height, local.height);
  const diff = new PNG({ width: w, height: h });
  const numDiffPixels = pixelmatch(ref.data, local.data, diff.data, w, h, { threshold: 0.1 });
  const total = w * h;
  const diffPct = (numDiffPixels / total) * 100;

  // delta de cor máximo (amostra)
  let maxDelta = 0;
  const step = 9973;
  for (let i = 0; i < ref.data.length; i += step * 4) {
    const r1 = ref.data[i], g1 = ref.data[i + 1], b1 = ref.data[i + 2];
    const r2 = local.data[i], g2 = local.data[i + 1], b2 = local.data[i + 2];
    const d = Math.max(Math.abs(r1 - r2), Math.abs(g1 - g2), Math.abs(b1 - b2));
    if (d > maxDelta) maxDelta = d;
  }

  const diffPath = path.join(OUT_DIR, localName.replace('.png', '-diff.png'));
  fs.writeFileSync(diffPath, PNG.sync.write(diff));

  const pass = numDiffPixels <= 2 && diffPct <= 1 && maxDelta <= 1;
  return { pass, refName, localName, diffPixels: numDiffPixels, total, diffPct: diffPct.toFixed(3), maxDelta, diffPath, size: `${w}x${h} (ref ${ref.width}x${ref.height} vs local ${local.width}x${local.height})` };
}

const pairs = [
  ['official-home.png', 'local-home.png'],
  ['official-home-scrolled.png', 'local-home-scrolled.png'],
];

const results = pairs.map(([r, l]) => compare(r, l));
for (const r of results) {
  console.log(JSON.stringify(r, null, 2));
}
const passed = results.every((r) => r.pass);
console.log(passed ? 'PASS — todos os diffs dentro do limite (2px / 1%)' : 'FAIL — corrigir e repetir');
process.exit(passed ? 0 : 1);
