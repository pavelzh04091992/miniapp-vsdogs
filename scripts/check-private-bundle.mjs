import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const distPath = resolve(process.cwd(), 'dist');
const indexHtml = readFileSync(resolve(distPath, 'index.html'), 'utf8');
const publicPath = resolve(distPath, 'public');
const privatePath = resolve(distPath, 'private');
const publicScripts = readdirSync(publicPath).filter((name) => name.endsWith('.js'));
const privateScripts = readdirSync(privatePath).filter((name) => name.endsWith('.js'));

assert(publicScripts.length === 1, 'build must contain exactly one public auth bootstrap');
assert(privateScripts.length >= 1, 'build must contain private application chunks');
assert(/src="\/public\/[^"]+\.js"/.test(indexHtml), 'index must load only the public bootstrap');
assert(!indexHtml.includes('/private/'), 'index must not preload private chunks');
assert(!existsSync(resolve(distPath, 'data', 'videos.json')), 'video catalog must not enter dist');

const publicCode = publicScripts
  .map((name) => readFileSync(resolve(publicPath, name), 'utf8'))
  .join('\n');
const privateCode = privateScripts
  .map((name) => readFileSync(resolve(privatePath, name), 'utf8'))
  .join('\n');

for (const marker of ['lesson-player-card', 'video-card__title', 'complex-level-card']) {
  assert(!publicCode.includes(marker), `public bootstrap leaked private marker: ${marker}`);
}

assert(privateCode.includes('lesson-player-card'), 'private application code was not emitted');
console.log('[bundle-check] public bootstrap is separated from private application code');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
