// Placeholder suite kept so the test runner always has at least one file.
// Substantive tests live in the sibling test files.
import * as assert from 'assert';

suite('Sanity', () => {
  test('assert module is operational', () => {
    assert.strictEqual(1 + 1, 2);
    assert.ok(true);
    assert.deepStrictEqual({ a: 1 }, { a: 1 });
  });
});
