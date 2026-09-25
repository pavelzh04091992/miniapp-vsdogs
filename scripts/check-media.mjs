import { open, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const mediaRoot = resolve(projectRoot, 'media');
const entries = await readdir(mediaRoot, { withFileTypes: true });
const videoDirectories = entries.filter((entry) => entry.isDirectory());

if (videoDirectories.length === 0) {
  console.log('[media-check] no video directories found');
  process.exit(0);
}

let failed = false;

for (const directory of videoDirectories) {
  const videoPath = resolve(mediaRoot, directory.name, 'video.mp4');

  try {
    const atoms = await readTopLevelAtoms(videoPath);
    const moovOffset = atoms.get('moov');
    const mdatOffset = atoms.get('mdat');

    if (moovOffset === undefined || mdatOffset === undefined) {
      throw new Error('required moov/mdat atoms were not found');
    }

    if (moovOffset > mdatOffset) {
      failed = true;
      console.error(
        `[media-check] ${directory.name}: MP4 is not optimized for streaming (moov is after mdat)`,
      );
      continue;
    }

    console.log(`[media-check] ${directory.name}: OK (fast start)`);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      console.log(`[media-check] ${directory.name}: skipped (video.mp4 not found)`);
      continue;
    }

    failed = true;
    console.error(`[media-check] ${directory.name}: ${error.message}`);
  }
}

if (failed) {
  process.exitCode = 1;
}

async function readTopLevelAtoms(filePath) {
  const file = await open(filePath, 'r');

  try {
    const { size: fileSize } = await file.stat();
    const atoms = new Map();
    const header = Buffer.alloc(16);
    let offset = 0;

    while (offset + 8 <= fileSize) {
      const { bytesRead } = await file.read(header, 0, header.length, offset);

      if (bytesRead < 8) {
        break;
      }

      const size32 = header.readUInt32BE(0);
      const type = header.toString('ascii', 4, 8);
      let atomSize = size32;
      let headerSize = 8;

      if (size32 === 1) {
        if (bytesRead < 16) {
          throw new Error(`truncated extended atom header at byte ${offset}`);
        }

        atomSize = Number(header.readBigUInt64BE(8));
        headerSize = 16;
      } else if (size32 === 0) {
        atomSize = fileSize - offset;
      }

      if (!Number.isSafeInteger(atomSize) || atomSize < headerSize || offset + atomSize > fileSize) {
        throw new Error(`invalid ${type || 'unknown'} atom size at byte ${offset}`);
      }

      if (!atoms.has(type)) {
        atoms.set(type, offset);
      }

      if (atoms.has('moov') && atoms.has('mdat')) {
        break;
      }

      offset += atomSize;
    }

    return atoms;
  } finally {
    await file.close();
  }
}
