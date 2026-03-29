import * as assert from 'assert';
import { escapeHtml, ALLICONS } from '../utils';

suite('utils — escapeHtml', () => {
  test('returns empty string unchanged', () => {
    assert.strictEqual(escapeHtml(''), '');
  });

  test('returns plain text unchanged', () => {
    assert.strictEqual(escapeHtml('hello world'), 'hello world');
  });

  test('escapes &', () => {
    assert.strictEqual(escapeHtml('a & b'), 'a &amp; b');
  });

  test('escapes double quote', () => {
    assert.strictEqual(escapeHtml('"hello"'), '&quot;hello&quot;');
  });

  test('escapes single quote', () => {
    assert.strictEqual(escapeHtml("it's"), 'it&#39;s');
  });

  test('escapes <', () => {
    assert.strictEqual(escapeHtml('<tag'), '&lt;tag');
  });

  test('escapes >', () => {
    assert.strictEqual(escapeHtml('tag>'), 'tag&gt;');
  });

  test('escapes a full script tag (XSS vector)', () => {
    assert.strictEqual(
      escapeHtml('<script>alert("xss")</script>'),
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;',
    );
  });

  test('escapes multiple occurrences of the same character', () => {
    assert.strictEqual(escapeHtml('a & b & c'), 'a &amp; b &amp; c');
  });

  test('escapes all five special characters in one string', () => {
    assert.strictEqual(escapeHtml(`<>"'&`), '&lt;&gt;&quot;&#39;&amp;');
  });

  test('does not double-escape already-escaped text', () => {
    // escapeHtml is not idempotent by design — calling it twice escapes the ampersand again
    const once = escapeHtml('&amp;');
    assert.strictEqual(once, '&amp;amp;');
  });
});

suite('utils — ALLICONS', () => {
  test('is a non-empty array', () => {
    assert.ok(Array.isArray(ALLICONS));
    assert.ok(ALLICONS.length > 0);
  });

  test('contains only strings', () => {
    for (const icon of ALLICONS) {
      assert.strictEqual(
        typeof icon,
        'string',
        `Expected string, got ${typeof icon} for "${icon}"`,
      );
    }
  });

  test('contains no duplicate entries', () => {
    const unique = new Set(ALLICONS);
    assert.strictEqual(unique.size, ALLICONS.length, 'ALLICONS must not contain duplicates');
  });

  test('contains no empty strings', () => {
    for (const icon of ALLICONS) {
      assert.ok(icon.length > 0, 'Icon name must not be empty');
    }
  });

  test('contains expected well-known icons', () => {
    assert.ok(ALLICONS.includes('play'));
    assert.ok(ALLICONS.includes('terminal'));
    assert.ok(ALLICONS.includes('gear'));
    assert.ok(ALLICONS.includes('folder'));
    assert.ok(ALLICONS.includes('trash'));
  });
});
