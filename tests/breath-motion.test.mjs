import assert from 'node:assert/strict';
import test from 'node:test';
import { breathMoment } from '../src/lib/breath-motion.ts';
import { patterns } from '../src/lib/patterns.ts';

const at = (slug, time) => breathMoment(patterns.find(pattern => pattern.slug === slug), time);

test('fractional coherent timing wraps without skipping a phase', () => {
  assert.equal(at('coherent', 5.499).index, 0);
  assert.equal(at('coherent', 5.5).index, 1);
  assert.deepEqual(at('coherent', 11), { index: 0, elapsed: 0, seconds: 5.5, round: 1 });
});

test('box breathing distinguishes a full hold from an empty hold', () => {
  assert.equal(at('box', 4).index, 1);
  assert.equal(at('box', 8).index, 2);
  assert.equal(at('box', 12).index, 3);
  assert.equal(at('box', 16).round, 1);
});

test('sigh keeps the top-up as its own one-second phase', () => {
  assert.equal(at('sigh', 2).index, 1);
  assert.equal(at('sigh', 2.999).index, 1);
  assert.equal(at('sigh', 3).index, 2);
});

test('4-7-8 preserves its full seven-second hold and eight-second exhale', () => {
  assert.equal(at('478', 4).index, 1);
  assert.equal(at('478', 10.999).index, 1);
  assert.equal(at('478', 11).index, 2);
  assert.equal(at('478', 19).round, 1);
});

test('Wim Hof completes 30 breaths before hold and recovery in every round', () => {
  assert.equal(at('wimhof', 89.999).index, 59);
  assert.equal(at('wimhof', 90).index, 60);
  assert.equal(at('wimhof', 120).index, 61);
  assert.deepEqual(at('wimhof', 122), { index: 0, elapsed: 0, seconds: 1.5, round: 1 });
  assert.equal(at('wimhof', 334).index, 60);
  assert.equal(at('wimhof', 366).round, 3);
});

test('Buteyko holds after exhalation and restarts at twelve seconds', () => {
  assert.equal(at('buteyko', 3).index, 1);
  assert.equal(at('buteyko', 7).index, 2);
  assert.equal(at('buteyko', 12).index, 0);
});
