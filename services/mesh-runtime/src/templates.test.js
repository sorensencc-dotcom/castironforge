import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { resolveTemplates } from './templates.js';

describe('resolveTemplates — ${{ now }}', () => {
  test('resolves to a valid ISO 8601 string', () => {
    const result = resolveTemplates('time: ${{ now }}', {});
    const iso = result.replace('time: ', '');
    assert.ok(!isNaN(new Date(iso).getTime()), `not a valid date: ${iso}`);
  });

  test('two ${{ now }} refs in the same string both resolve', () => {
    const result = resolveTemplates('start=${{ now }}&end=${{ now }}', {});
    const matches = result.match(/\d{4}-\d{2}-\d{2}T/g);
    assert.ok(matches?.length === 2, `expected 2 timestamps in: ${result}`);
  });

  test('resolves ${{ now }} inside a nested object value', () => {
    const result = resolveTemplates({ prompt: 'as of ${{ now }}' }, {});
    assert.ok(!isNaN(new Date(result.prompt.replace('as of ', '')).getTime()));
  });
});

describe('resolveTemplates — context path resolution', () => {
  const ctx = {
    event: { type: 'pr.opened', repo: 'castironforge' },
    steps: {
      review:  { output: { verdict: 'approve', score: 0.97 } },
      triage:  { output: { labels: ['bug', 'p1'] } },
    },
  };

  test('resolves top-level event field', () => {
    assert.equal(resolveTemplates('${{ event.type }}', ctx), 'pr.opened');
  });

  test('resolves deep path steps.<id>.output.<field>', () => {
    assert.equal(resolveTemplates('${{ steps.review.output.verdict }}', ctx), 'approve');
  });

  test('resolves numeric value as string', () => {
    assert.equal(resolveTemplates('${{ steps.review.output.score }}', ctx), '0.97');
  });

  test('JSON-serialises array values', () => {
    const result = resolveTemplates('${{ steps.triage.output.labels }}', ctx);
    assert.deepEqual(JSON.parse(result), ['bug', 'p1']);
  });

  test('missing path returns empty string', () => {
    assert.equal(resolveTemplates('${{ steps.missing.output }}', ctx), '');
  });

  test('null intermediate in path returns empty string without throwing', () => {
    assert.equal(resolveTemplates('${{ event.nonexistent.deep }}', ctx), '');
  });

  test('multiple vars in one string are each resolved independently', () => {
    const result = resolveTemplates('repo=${{ event.repo }} type=${{ event.type }}', ctx);
    assert.equal(result, 'repo=castironforge type=pr.opened');
  });
});

describe('resolveTemplates — recursive resolution', () => {
  const ctx = { env: 'production' };

  test('resolves templates inside an array element-wise', () => {
    const result = resolveTemplates(['env: ${{ env }}', 'static'], ctx);
    assert.deepEqual(result, ['env: production', 'static']);
  });

  test('resolves templates inside object values', () => {
    const result = resolveTemplates({ key: 'env=${{ env }}' }, ctx);
    assert.deepEqual(result, { key: 'env=production' });
  });

  test('nested object with mixed static and template values', () => {
    const result = resolveTemplates({ prompt: 'Deploy ${{ env }}', retries: 3 }, ctx);
    assert.deepEqual(result, { prompt: 'Deploy production', retries: 3 });
  });

  test('passes through numbers without modification', () => {
    assert.equal(resolveTemplates(42, ctx), 42);
  });

  test('passes through booleans without modification', () => {
    assert.equal(resolveTemplates(true, ctx), true);
  });

  test('passes through null without modification', () => {
    assert.equal(resolveTemplates(null, ctx), null);
  });
});

describe('resolveTemplates — workflow executor context shape', () => {
  // Validates the exact context structure WorkflowExecutor passes: { event, steps, now }
  test('now field in context is not substituted when using ${{ now }} keyword path', () => {
    // The keyword path 'now' calls nowISO() directly; a context.now prop is ignored.
    // This guards against accidental capture of the context.now field.
    const ctx = { now: 'SHOULD_NOT_APPEAR', event: {} };
    const result = resolveTemplates('${{ now }}', ctx);
    assert.ok(result !== 'SHOULD_NOT_APPEAR', '${{ now }} resolved from context instead of datetime service');
    assert.ok(!isNaN(new Date(result).getTime()), `expected ISO date, got: ${result}`);
  });

  test('steps output available to downstream template vars', () => {
    const ctx = {
      event: { pr: 42 },
      steps: { reviewer: { output: { status: 'changes_requested' } } },
      now: 'ignored',
    };
    assert.equal(
      resolveTemplates('PR #${{ event.pr }} status=${{ steps.reviewer.output.status }}', ctx),
      'PR #42 status=changes_requested',
    );
  });
});
