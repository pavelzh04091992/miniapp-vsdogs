import { spawn } from 'node:child_process';
import { access, mkdir, readdir, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const [, , sourceArgument, videoId] = process.argv;

if (!sourceArgument || !videoId) {
  fail('Usage: npm run video:prepare -- <source-file> <video-id>');
}

if (!/^[a-z0-9][a-z0-9-]{0,127}$/.test(videoId)) {
  fail('video-id may contain only lowercase Latin letters, numbers, and hyphens');
}

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const sourcePath = resolve(process.cwd(), sourceArgument);
const videoDirectory = resolve(projectRoot, 'media', videoId);
const profiles = [
  { name: '360p', height: 360, videoBitrate: '700k', maxRate: '800k', bufferSize: '1200k', audioBitrate: '96k' },
  { name: '720p', height: 720, videoBitrate: '2200k', maxRate: '2600k', bufferSize: '3900k', audioBitrate: '128k' },
  { name: '1080p', height: 1080, videoBitrate: '4500k', maxRate: '5200k', bufferSize: '7800k', audioBitrate: '128k' },
];

await access(sourcePath).catch(() => fail(`Source file not found: ${sourcePath}`));
await mkdir(videoDirectory, { recursive: true });

const existingFiles = await readdir(videoDirectory);

if (existingFiles.length > 0) {
  fail(`Target directory is not empty: ${videoDirectory}`);
}

console.log(`[video] source: ${basename(sourcePath)}`);
console.log(`[video] target: media/${videoId}`);

for (const profile of profiles) {
  const outputDirectory = resolve(videoDirectory, profile.name);
  await mkdir(outputDirectory, { recursive: true });
  console.log(`[video] encoding ${profile.name}...`);

  await runFfmpeg([
    '-hide_banner',
    '-loglevel',
    'warning',
    '-i',
    sourcePath,
    '-map',
    '0:v:0',
    '-map',
    '0:a:0?',
    '-vf',
    `scale=-2:${profile.height}:force_original_aspect_ratio=decrease`,
    '-c:v',
    'libx264',
    '-preset',
    'medium',
    '-profile:v',
    'main',
    '-pix_fmt',
    'yuv420p',
    '-b:v',
    profile.videoBitrate,
    '-maxrate',
    profile.maxRate,
    '-bufsize',
    profile.bufferSize,
    '-force_key_frames',
    'expr:gte(t,n_forced*4)',
    '-c:a',
    'aac',
    '-b:a',
    profile.audioBitrate,
    '-ac',
    '2',
    '-ar',
    '48000',
    '-f',
    'hls',
    '-hls_time',
    '4',
    '-hls_playlist_type',
    'vod',
    '-hls_segment_type',
    'fmp4',
    '-hls_fmp4_init_filename',
    'init.mp4',
    '-hls_segment_filename',
    resolve(outputDirectory, 'segment_%05d.m4s'),
    resolve(outputDirectory, 'index.m3u8'),
  ]);
}

console.log('[video] encoding MP4 fallback...');
await runFfmpeg([
  '-hide_banner',
  '-loglevel',
  'warning',
  '-i',
  sourcePath,
  '-map',
  '0:v:0',
  '-map',
  '0:a:0?',
  '-vf',
  'scale=-2:720:force_original_aspect_ratio=decrease',
  '-c:v',
  'libx264',
  '-preset',
  'medium',
  '-profile:v',
  'main',
  '-pix_fmt',
  'yuv420p',
  '-crf',
  '22',
  '-c:a',
  'aac',
  '-b:a',
  '128k',
  '-movflags',
  '+faststart',
  resolve(videoDirectory, 'video.mp4'),
]);

console.log('[video] creating poster...');
await runFfmpeg([
  '-hide_banner',
  '-loglevel',
  'warning',
  '-ss',
  '1',
  '-i',
  sourcePath,
  '-frames:v',
  '1',
  '-vf',
  'scale=1280:-2:force_original_aspect_ratio=decrease',
  '-q:v',
  '75',
  resolve(videoDirectory, 'poster.webp'),
]);

const masterPlaylist = `#EXTM3U
#EXT-X-VERSION:7
#EXT-X-INDEPENDENT-SEGMENTS
#EXT-X-STREAM-INF:BANDWIDTH=900000,AVERAGE-BANDWIDTH=796000,RESOLUTION=640x360
360p/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2900000,AVERAGE-BANDWIDTH=2328000,RESOLUTION=1280x720
720p/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=5800000,AVERAGE-BANDWIDTH=4628000,RESOLUTION=1920x1080
1080p/index.m3u8
`;

await writeFile(resolve(videoDirectory, 'master.m3u8'), masterPlaylist, 'utf8');
console.log(`[video] ready: /media/${videoId}/master.m3u8`);

function runFfmpeg(argumentsList) {
  return new Promise((resolvePromise, rejectPromise) => {
    const command = spawn('ffmpeg', ['-y', ...argumentsList], { stdio: 'inherit' });

    command.on('error', (error) => {
      rejectPromise(new Error(`Unable to start ffmpeg: ${error.message}`));
    });
    command.on('exit', (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      rejectPromise(new Error(`ffmpeg exited with code ${code ?? 'unknown'}`));
    });
  });
}

function fail(message) {
  console.error(`[video] ${message}`);
  process.exit(1);
}
