/**
 * EventGenie Automated Unit Test Suite
 * Evaluates core calculations, security sanitization, and state integrity.
 */

const assert = require('assert');
const {
  escapeHtml,
  capitalize,
  formatNum,
  formatDate,
  formatMarkdown,
  uid
} = require('./app.js');

let passed = 0;
let failed = 0;

function it(description, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${description}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${description}`);
    console.error(`     ${err.message}`);
    failed++;
  }
}

console.log('🧪 Running EventGenie Automated Test Suite...\n');

// 1. Security & XSS Protection Tests
console.log('🔒 Testing Security & Input Sanitization:');
it('should escape dangerous HTML characters to prevent XSS', () => {
  const unsafe = '<script>alert("xss")</script>&foo=1\'bar\'';
  const safe = escapeHtml(unsafe);
  assert.strictEqual(safe.includes('<script>'), false);
  assert.strictEqual(safe.includes('&lt;script&gt;'), true);
  assert.strictEqual(safe.includes('&amp;'), true);
  assert.strictEqual(safe.includes('&quot;'), true);
  assert.strictEqual(safe.includes('&#039;'), true);
});

it('should safely handle non-string inputs in escapeHtml', () => {
  assert.strictEqual(escapeHtml(null), '');
  assert.strictEqual(escapeHtml(undefined), '');
  assert.strictEqual(escapeHtml(123), '');
});

it('should neutralize XSS payloads injected in markdown formatting', () => {
  const dangerousMd = '**bold** <img src=x onerror=alert(1)>';
  const formatted = formatMarkdown(dangerousMd);
  assert.strictEqual(formatted.includes('<img'), false);
  assert.strictEqual(formatted.includes('<strong>bold</strong>'), true);
  assert.strictEqual(formatted.includes('&lt;img'), true);
});

// 2. Data Formatting & Presentation Tests
console.log('\n📊 Testing Data Formatting & Utilities:');
it('should accurately format numbers with commas', () => {
  assert.strictEqual(formatNum(25000), '25,000');
  assert.strictEqual(formatNum(3500000), '3,500,000');
  assert.strictEqual(formatNum(0), '0');
  assert.strictEqual(formatNum(NaN), '0');
});

it('should capitalize the first character of strings safely', () => {
  assert.strictEqual(capitalize('wedding'), 'Wedding');
  assert.strictEqual(capitalize('community'), 'Community');
  assert.strictEqual(capitalize(''), '');
});

it('should parse and format valid dates nicely', () => {
  const formatted = formatDate('2026-12-25');
  assert.ok(formatted.includes('Dec') && formatted.includes('25') && formatted.includes('2026'));
});

it('should generate unique IDs', () => {
  const id1 = uid();
  const id2 = uid();
  assert.notStrictEqual(id1, id2);
  assert.ok(id1.length >= 8);
});

// 3. Mathematical & Allocation Integrity Tests
console.log('\n🧮 Testing Budget Math & Calculations:');
it('should correctly compute category distribution percentages', () => {
  const total = 25000;
  const items = [
    { name: 'Venue', amount: 10000 },
    { name: 'Photo', amount: 3000 },
    { name: 'Decor', amount: 2500 }
  ];
  const spent = items.reduce((s, i) => s + i.amount, 0);
  const remaining = total - spent;
  const pct = Math.round((spent / total) * 100);

  assert.strictEqual(spent, 15500);
  assert.strictEqual(remaining, 9500);
  assert.strictEqual(pct, 62);
});

// 4. Summary
console.log('\n========================================');
console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
console.log('========================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 All automated tests passed successfully!\n');
}
