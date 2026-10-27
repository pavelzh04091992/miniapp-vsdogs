import fs from 'node:fs';
import ts from 'typescript';

const sourceText = fs.readFileSync('src/app.ts', 'utf8');
const catalog = JSON.parse(fs.readFileSync('src/local-video-catalog.json', 'utf8'));
const seasonalSourceText = fs.readFileSync('src/seasonal-content.ts', 'utf8');
const seasonalDescriptions = JSON.parse(
  fs.readFileSync('src/seasonal-video-descriptions.json', 'utf8'),
);
const sourceFile = ts.createSourceFile(
  'src/app.ts',
  sourceText,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS,
);
const seasonalSourceFile = ts.createSourceFile(
  'src/seasonal-content.ts',
  seasonalSourceText,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS,
);

const property = (object, name) =>
  object.properties.find(
    (candidate) =>
      ts.isPropertyAssignment(candidate) &&
      candidate.name.getText(sourceFile).replace(/["']/g, '') === name,
  )?.initializer;
const stringValue = (node) => (node && ts.isStringLiteral(node) ? node.text : '');
const declaration = (name) =>
  sourceFile.statements
    .filter(ts.isVariableStatement)
    .flatMap((statement) => [...statement.declarationList.declarations])
    .find((candidate) => candidate.name.getText(sourceFile) === name);

const activeCards = new Map();
let activeLessonCount = 0;

for (const variableName of ['puppySituations', 'adultLargeSituations']) {
  const situations = declaration(variableName)?.initializer;
  if (!situations || !ts.isArrayLiteralExpression(situations)) {
    throw new Error(`Cannot inspect ${variableName}`);
  }

  for (const situation of situations.elements) {
    for (const topic of property(situation, 'topics').elements) {
      const topicSlug = stringValue(property(topic, 'slug'));
      for (const lesson of property(topic, 'lessons').elements) {
        const lessonTitle = stringValue(property(lesson, 'title'));
        const key = `${topicSlug}\u0000${lessonTitle}`;
        if (activeCards.has(key)) throw new Error(`Duplicate active card: ${topicSlug} / ${lessonTitle}`);
        activeCards.set(key, { topicSlug, lessonTitle });
        activeLessonCount += 1;
      }
    }
  }
}

const assignedTargets = new Set();
const usedMedia = new Set();

for (const assignment of catalog.cardMedia) {
  const { topicSlug, lessonTitle, mediaId } = assignment;
  const key = `${topicSlug}\u0000${lessonTitle}`;

  if (!activeCards.has(key)) throw new Error(`Unknown active card: ${topicSlug} / ${lessonTitle}`);
  if (assignedTargets.has(key)) throw new Error(`Duplicate media assignment: ${topicSlug} / ${lessonTitle}`);
  if (!catalog.mediaFiles[mediaId]) throw new Error(`Unknown media id: ${mediaId}`);

  assignedTargets.add(key);
  usedMedia.add(mediaId);
}

const complexMediaIds = [
  'complex-timed-beginner',
  'complex-timed-intermediate',
  'complex-timed-advanced',
  'complex-self-check-beginner',
  'complex-self-check-intermediate',
  'complex-self-check-advanced',
];
for (const mediaId of complexMediaIds) {
  if (!catalog.mediaFiles[mediaId]) throw new Error(`Missing complex media: ${mediaId}`);
  usedMedia.add(mediaId);
}

const intentionallyUnassigned = new Set();
for (const mediaId of catalog.unassignedMedia) {
  if (!catalog.mediaFiles[mediaId]) throw new Error(`Unknown unassigned media id: ${mediaId}`);
  if (usedMedia.has(mediaId)) throw new Error(`Media is both assigned and unassigned: ${mediaId}`);
  if (intentionallyUnassigned.has(mediaId)) throw new Error(`Duplicate unassigned media id: ${mediaId}`);
  intentionallyUnassigned.add(mediaId);
}

const seasonalVideosDeclaration = seasonalSourceFile.statements
  .filter(ts.isVariableStatement)
  .flatMap((statement) => [...statement.declarationList.declarations])
  .find((candidate) => candidate.name.getText(seasonalSourceFile) === 'seasonalVideos');
const seasonalVideosInitializer = seasonalVideosDeclaration?.initializer;

if (!seasonalVideosInitializer || !ts.isArrayLiteralExpression(seasonalVideosInitializer)) {
  throw new Error('Cannot inspect seasonalVideos');
}

const seasonalMediaIds = new Set();
for (const video of seasonalVideosInitializer.elements) {
  const seasonalProperty = (name) => propertyFrom(seasonalSourceFile, video, name);
  const id = stringFrom(seasonalProperty('id'));
  const mediaId = stringFrom(seasonalProperty('mediaId'));
  const seasons = seasonalProperty('seasons');

  if (!id || !mediaId) throw new Error('Seasonal video must define id and mediaId');
  if (id !== mediaId) throw new Error(`Seasonal video id must match media id: ${id} / ${mediaId}`);
  if (seasonalMediaIds.has(mediaId)) throw new Error(`Duplicate seasonal media id: ${mediaId}`);
  if (!seasonalDescriptions[id]) throw new Error(`Missing seasonal description: ${id}`);
  if (!seasons || !ts.isArrayLiteralExpression(seasons)) {
    throw new Error(`Missing seasons for seasonal video: ${id}`);
  }
  if (seasons.elements.some((season) => stringFrom(season) !== 'autumn')) {
    throw new Error(`Only autumn seasonal videos are currently published: ${id}`);
  }

  seasonalMediaIds.add(mediaId);
}

const unusedSeasonalDescriptions = Object.keys(seasonalDescriptions).filter(
  (id) => !seasonalMediaIds.has(id),
);
if (unusedSeasonalDescriptions.length) {
  throw new Error(`Unused seasonal descriptions: ${unusedSeasonalDescriptions.join(', ')}`);
}

const unaccountedMedia = Object.keys(catalog.mediaFiles).filter(
  (mediaId) => !usedMedia.has(mediaId) && !intentionallyUnassigned.has(mediaId),
);
if (unaccountedMedia.length) {
  throw new Error(`Unaccounted media: ${unaccountedMedia.join(', ')}`);
}

console.log(
  `Video catalog OK: ${activeLessonCount} active cards, ${assignedTargets.size} mapped cards, ` +
    `${complexMediaIds.length} complex cards, ${seasonalMediaIds.size} seasonal cards, ` +
    `${intentionallyUnassigned.size} videos without cards`,
);

function propertyFrom(file, object, name) {
  if (!ts.isObjectLiteralExpression(object)) return undefined;
  return object.properties.find(
    (candidate) =>
      ts.isPropertyAssignment(candidate)
      && candidate.name.getText(file).replace(/["']/g, '') === name,
  )?.initializer;
}

function stringFrom(node) {
  return node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    ? node.text
    : '';
}
