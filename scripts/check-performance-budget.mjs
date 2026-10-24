import { readFile, readdir } from 'node:fs/promises';
import { extname } from 'node:path';
import { gzipSync } from 'node:zlib';

const distRoot = new URL('../dist/', import.meta.url);
const bundleFiles = (await walk(distRoot)).filter((file) => ['.html', '.js', '.css'].includes(extname(file.pathname)));
const bundleBytes = (await Promise.all(bundleFiles.map(async (file) => gzipSync(await readFile(file)).byteLength)))
  .reduce((total, size) => total + size, 0);
const criticalArtwork = [
  new URL('../dist/assets/logo-dog.svg', import.meta.url),
  new URL('../dist/assets/hero-dog.webp', import.meta.url),
];
const artworkBytes = (await Promise.all(criticalArtwork.map(async (file) => (await readFile(file)).byteLength)))
  .reduce((total, size) => total + size, 0);
const criticalBytes = bundleBytes + artworkBytes;
const budgetBytes = 700 * 1024;

if (criticalBytes > budgetBytes) {
  throw new Error(`Cold-start budget exceeded: ${(criticalBytes / 1024).toFixed(0)} KiB > 700 KiB`);
}

console.log(`[performance-budget] critical resources: ${(criticalBytes / 1024).toFixed(0)} KiB / 700 KiB`);

async function walk(directoryUrl) {
  const entries = await readdir(directoryUrl, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryUrl = new URL(entry.isDirectory() ? `${entry.name}/` : entry.name, directoryUrl);
    files.push(...(entry.isDirectory() ? await walk(entryUrl) : [entryUrl]));
  }

  return files;
}
