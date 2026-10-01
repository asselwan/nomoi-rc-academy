#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => readFileSync(join(root, name), 'utf8');
const landing = read('index.html');
const first = read('lesson-1.html');
const second = read('lesson-2.html');
const stripe = read('scripts/setup-academy-stripe.mjs');
const dockerfile = read('Dockerfile');
for (const page of ['index.html', 'lesson-1.html', 'lesson-2.html']) {
  assert.ok(dockerfile.includes(`COPY ${page} /usr/share/nginx/html/${page}`), `production image omits ${page}`);
}

for (const [name, html] of [['index.html', landing], ['lesson-1.html', first], ['lesson-2.html', second]]) {
  for (const [, href] of html.matchAll(/href="(\/[^"#?]+)(?:#[^"]*)?"/g)) {
    assert.ok(existsSync(join(root, href.slice(1))), `${name}: broken local link ${href}`);
  }
}
assert.match(landing, /id="module-2"[\s\S]*?href="\/lesson-2\.html"[\s\S]*?Claim lifecycle fundamentals/);
assert.match(landing, /href="\/lesson-1\.html"/);
assert.match(first, /Denial pattern triage/);
for (const phrase of ['Registration and coverage', 'Documentation, coding, and charge review', 'Submission and technical acknowledgement', 'Adjudication and remittance', 'Denial review or correction', 'Posting and reconciliation', 'Illustrative sample worklist']) {
  assert.ok(second.includes(phrase), `module 2 missing ${phrase}`);
}
assert.equal((second.match(/<fieldset class="question"/g) || []).length, 3);
assert.equal((second.match(/class="feedback" hidden/g) || []).length, 3);
assert.equal((second.match(/data-answer="[abc]"/g) || []).length, 3);
assert.match(second, /feedback\.textContent=.*explanations\[i\]/);
assert.match(second, /done\['lesson-2'\]=true/);
assert.match(stripe, /unitAmountMinor:\s*0/);
assert.match(stripe, /if \(OFFER\.unitAmountMinor <= 0\)/);
assert.doesNotMatch(landing + second, /https:\/\/(?:buy\.|checkout\.)stripe\.com/);
console.log('Academy links, module 2 content, exercise feedback, progress, and price gate: OK');
