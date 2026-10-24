import { readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const coversRoot = new URL('../public/assets/covers/', import.meta.url);
const appPath = new URL('../src/app.ts', import.meta.url);

let savedBytes = 0;

for (const fileName of await readdir(coversRoot)) {
  if (extname(fileName).toLowerCase() !== '.jpg') {
    continue;
  }

  const inputPath = new URL(fileName, coversRoot);
  const outputPath = new URL(fileName.replace(/\.jpg$/i, '.webp'), coversRoot);
  const before = (await stat(inputPath)).size;
  await sharp(fileURLToPath(inputPath))
    .rotate()
    .resize({ width: 720, height: 480, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 78, effort: 6, smartSubsample: true })
    .toFile(fileURLToPath(outputPath));
  const after = (await stat(outputPath)).size;
  savedBytes += Math.max(0, before - after);
  await rm(inputPath);
}

for (const filePath of await walk(new URL('../public/assets/', import.meta.url))) {
  if (extname(filePath).toLowerCase() !== '.webp') {
    continue;
  }

  const normalized = filePath.replaceAll('\\', '/');
  const maxDimension = normalized.includes('/icons/') ? 384 : normalized.includes('/feedback/') ? 960 : 720;
  const before = (await stat(filePath)).size;
  const source = await readFile(filePath);
  const metadata = await sharp(source).metadata();

  if ((metadata.width ?? 0) <= maxDimension && (metadata.height ?? 0) <= maxDimension) {
    continue;
  }

  const optimized = await sharp(source)
    .rotate()
    .resize({ width: maxDimension, height: maxDimension, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80, alphaQuality: 88, effort: 6, smartSubsample: true })
    .toBuffer();
  const after = optimized.byteLength;

  if (after < before) {
    await writeFileWithRetry(filePath, optimized);
    savedBytes += before - after;
  }
}

for (const fileName of ['feedback-main.svg', 'feedback-sent.svg']) {
  const filePath = new URL(`../public/assets/feedback/${fileName}`, import.meta.url);
  const source = await readFile(filePath, 'utf8');
  const match = source.match(/data:image\/png;base64,([^"']+)/);

  if (!match) {
    continue;
  }

  const before = Buffer.byteLength(source);
  const optimized = await sharp(Buffer.from(match[1], 'base64'))
    .rotate()
    .resize({ width: 960, height: 960, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82, alphaQuality: 90, effort: 6, smartSubsample: true })
    .toBuffer();
  const nextSource = source.replace(match[0], `data:image/webp;base64,${optimized.toString('base64')}`);
  await writeFile(filePath, nextSource);
  savedBytes += Math.max(0, before - Buffer.byteLength(nextSource));
}

let appSource = await readFile(appPath, 'utf8');
appSource = appSource.replace(/(\/assets\/covers\/[^'"\s]+)\.jpg/g, '$1.webp');
await writeFile(appPath, appSource);

for (const unusedPath of [
  new URL('../public/assets/icons/leash.png', import.meta.url),
  new URL('../public/assets/icons/fitness.svg', import.meta.url),
]) {
  await rm(unusedPath, { force: true });
}

console.log(`Optimized application images; saved about ${(savedBytes / 1024 / 1024).toFixed(2)} MiB.`);

async function writeFileWithRetry(filePath, contents) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      await writeFile(filePath, contents);
      return;
    } catch (error) {
      if (!['EBUSY', 'EPERM', 'UNKNOWN'].includes(error.code) || attempt === 11) {
        throw error;
      }

      await new Promise((resolveDelay) => setTimeout(resolveDelay, 100 * (attempt + 1)));
    }
  }
}

async function walk(directoryUrl) {
  const directoryPath = directoryUrl.pathname.startsWith('/') && /^[A-Za-z]:/.test(directoryUrl.pathname.slice(1))
    ? directoryUrl.pathname.slice(1)
    : directoryUrl.pathname;
  const entries = await readdir(directoryPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...await walk(new URL(`${entry.name}/`, directoryUrl)));
    } else {
      files.push(entryPath);
    }
  }

  return files;
}
