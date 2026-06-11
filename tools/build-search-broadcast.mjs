#!/usr/bin/env node
/* ============================================================
 * tools/build-search-broadcast.mjs
 * Builds learn/learn_data/search_broadcast.json — the "broadcast"
 * index that the louie. search SDK (louie1.com/lib/search/) fetches
 * at runtime so every lesson on louie.learn is globally searchable.
 *
 * Each course keeps its own internal architecture (schemas, engines,
 * playgrounds, lesson file formats…); this script only relies on the
 * one shape they all share: LEARN.course(slug, { title, desc,
 * lessons: [{ id, slug, title, chapter }], hasPlayground, … }).
 *
 * Run after editing any course/lesson index:
 *   node tools/build-search-broadcast.mjs
 *
 * (Or chain it into the deploy command:
 *   node tools/build-search-broadcast.mjs && npx wrangler deploy)
 * ============================================================ */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'learn', 'learn_data');

/* manifest.js assigns window.__LEARN_MANIFEST — evaluate with a shim */
const manifestSrc = readFileSync(join(DATA, 'manifest.js'), 'utf8');
const sandbox = {};
new Function('window', manifestSrc + '\n;return window.__LEARN_MANIFEST;')(sandbox);
const manifest = sandbox.__LEARN_MANIFEST;
if (!manifest || !Array.isArray(manifest.courses)) {
  console.error('manifest.js did not yield __LEARN_MANIFEST.courses');
  process.exit(1);
}

/* course.js calls LEARN.course(slug, def) (and lesson files, loaded
 * separately at runtime, call LEARN.lesson — shim both). */
function loadCourseDef(slug) {
  const src = readFileSync(join(DATA, slug, 'course.js'), 'utf8');
  let captured = null;
  const LEARN = {
    course: (_slug, def) => { captured = def; },
    lesson: () => {}
  };
  new Function('LEARN', src)(LEARN);
  return captured;
}

const out = {
  version: 1,
  generated: new Date().toISOString().slice(0, 10),
  courses: []
};

let lessonTotal = 0;
for (const c of manifest.courses) {
  if (c.coming) continue;
  const def = loadCourseDef(c.slug);
  if (!def) {
    console.warn(`! ${c.slug}: course.js yielded nothing — skipped`);
    continue;
  }
  const lessons = (def.lessons || [])
    .filter(l => l && l.id != null && l.title)
    .map(l => ({
      id: l.id,
      slug: l.slug || String(l.id),
      title: l.title,
      chapter: l.chapter || null
    }));
  lessonTotal += lessons.length;
  out.courses.push({
    slug: c.slug,
    title: def.title || c.title,
    desc: def.desc || c.desc || null,
    level: c.level || null,
    playground: def.hasPlayground ? { title: def.playgroundTitle || null } : null,
    lessons
  });
  console.log(`  ${c.slug}: ${lessons.length} lessons${def.hasPlayground ? ' + playground' : ''}`);
}

const file = join(DATA, 'search_broadcast.json');
writeFileSync(file, JSON.stringify(out, null, 1) + '\n');
console.log(`✓ ${file}`);
console.log(`✓ ${out.courses.length} courses, ${lessonTotal} lessons broadcast`);
