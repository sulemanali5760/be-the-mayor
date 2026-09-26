// CI: validate every model with the Khronos glTF validator, check it is self-contained (one embedded
// buffer, LESSONS H1: wall.js decodes it in memory) and within the triangle budget in docs/ASSETS.md.
// Runs on GitHub only, never on the dev laptop (LESSONS T1, A1).
import validator from 'gltf-validator';
import { readFileSync, readdirSync } from 'node:fs';

const PER_MODEL = 5000, TOTAL = 15000; // docs/ASSETS.md "Triangle budget"
let bad = 0, total = 0;
for (const f of readdirSync('assets/models').filter(n => n.endsWith('.gltf'))) {
  const bytes = readFileSync(`assets/models/${f}`);
  const report = await validator.validateBytes(new Uint8Array(bytes), { uri: f });
  const { numErrors, numWarnings } = report.issues, tris = report.info?.totalTriangleCount ?? 0;
  const bufs = JSON.parse(bytes.toString()).buffers ?? [];
  const embedded = bufs.length === 1 && String(bufs[0].uri).startsWith('data:');
  total += tris;
  console.log(`${f}: ${numErrors} errors, ${numWarnings} warnings, ${tris} triangles${embedded ? '' : ', NOT one embedded buffer'}`);
  if (numErrors) console.log(report.issues.messages.filter(m => m.severity === 0).slice(0, 5));
  if (numErrors || !embedded || tris > PER_MODEL) bad++;
}
console.log(`total: ${total} triangles (budget ${TOTAL})`);
if (total > TOTAL) bad++;
process.exit(bad ? 1 : 0);
