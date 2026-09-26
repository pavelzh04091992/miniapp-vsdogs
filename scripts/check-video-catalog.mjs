import fs from 'node:fs';
import ts from 'typescript';

const sourceText = fs.readFileSync('src/app.ts', 'utf8');
const catalog = JSON.parse(fs.readFileSync('src/local-video-catalog.json', 'utf8'));
const sourceFile = ts.createSourceFile(
  'src/app.ts',
  sourceText,
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

const topicLessonCounts = new Map();
let lessonCount = 0;

for (const variableName of [
  'puppySituations',
  'adultLargeSituations',
  'adultSmallSituations',
]) {
  const declaration = sourceFile.statements
    .filter(ts.isVariableStatement)
    .flatMap((statement) => [...statement.declarationList.declarations])
    .find((candidate) => candidate.name.getText(sourceFile) === variableName);

  if (!declaration || !ts.isArrayLiteralExpression(declaration.initializer)) {
    throw new Error(`Cannot inspect ${variableName}`);
  }

  for (const situation of declaration.initializer.elements) {
    for (const topic of property(situation, 'topics').elements) {
      const topicSlug = stringValue(property(topic, 'slug'));
      const count = property(topic, 'lessons').elements.length;
      topicLessonCounts.set(topicSlug, count);
      lessonCount += count;
    }
  }
}

for (const [topicSlug, count] of topicLessonCounts) {
  const assignments = catalog.topicMedia[topicSlug];

  if (!assignments) throw new Error(`Missing topic assignment: ${topicSlug}`);
  if (assignments.length !== count) {
    throw new Error(`${topicSlug}: ${assignments.length} media assignments for ${count} lessons`);
  }

  for (const mediaId of assignments) {
    if (!catalog.mediaFiles[mediaId]) throw new Error(`Unknown media id: ${mediaId}`);
  }
}

const unknownTopics = Object.keys(catalog.topicMedia).filter(
  (topicSlug) => !topicLessonCounts.has(topicSlug),
);
if (unknownTopics.length) throw new Error(`Unknown topic assignments: ${unknownTopics.join(', ')}`);

console.log(
  `Video catalog OK: ${lessonCount} lesson cards, 6 complex cards, ${Object.keys(catalog.mediaFiles).length} local files`,
);
