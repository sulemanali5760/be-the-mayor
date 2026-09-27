// CI: validate every model with the Khronos glTF validator, check it is self-contained (one embedded
// buffer, LESSONS H1: it is decoded in memory) and within the budgets of build 0.2 §3.1 (docs/ASSETS.md).
// `--manifest` (kits.yml, after blender/kits.py wrote it) also checks assets/manifest.json against the files.
// Runs on GitHub only, never on the dev laptop (LESSONS T1, A1).
import validator from 'gltf-validator';
import { readFileSync, readdirSync, statSync } from 'node:fs';

const PER_MODEL = 5000, MB = 8, TOWN_TRIS = 60000, TOWN_DRAWS = 150; // docs/ASSETS.md "Budgets"
const files = readdirSync('assets/models').filter(n => n.endsWith('.gltf'));
let bad = 0, bytes = 0;
for (const f of files) {
  const buf = readFileSync(`assets/models/${f}`);
  bytes += buf.length;
  const report = await validator.validateBytes(new Uint8Array(buf), { uri: f });
  const { numErrors, numWarnings } = report.issues, tris = report.info?.totalTriangleCount ?? 0;
  const bufs = JSON.parse(buf.toString()).buffers ?? [];
  const embedded = bufs.length === 1 && String(bufs[0].uri).startsWith('data:');
  console.log(`${f}: ${numErrors} errors, ${numWarnings} warnings, ${tris} triangles${embedded ? '' : ', NOT one embedded buffer'}`);
  if (numErrors) console.log(report.issues.messages.filter(m => m.severity === 0).slice(0, 5));
  if (numErrors || !embedded || tris > PER_MODEL) bad++;
}
console.log(`total: ${(bytes / 1048576).toFixed(2)} MB (budget ${MB})`);
if (bytes > MB * 1048576) bad++;

if (process.argv.includes('--manifest')) {
  const man = JSON.parse(readFileSync('assets/manifest.json', 'utf8'));
  const ids = new Set(files.map(f => f.slice(0, -5)));
  for (const [id, m] of Object.entries(man.models)) {
    const ok = ids.has(id) && m.source && m.license && statSync(m.file).isFile();
    if (!ok) { console.log(`manifest: ${id} has no file, source or licence`); bad++; }
    ids.delete(id);
  }
  for (const id of ids) { console.log(`manifest: ${id}.gltf is missing from the manifest`); bad++; }
  const t = man.budget.townBuildings;
  console.log(`town buildings: ${t.tris} triangles (budget ${TOWN_TRIS}), ${t.draws} draw calls (budget ${TOWN_DRAWS})`);
  if (t.tris > TOWN_TRIS || t.draws > TOWN_DRAWS) bad++;
}
process.exit(bad ? 1 : 0);
