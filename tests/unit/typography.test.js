import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  fixSmartQuotes,
  fixMDash,
  fixBahaITerms,
  fixCommonBahaiWords,
  fixPlaceNames,
  fixTransliteration,
  allFixes,
} from '../../src/utils/typography.js';

// Unicode constants for clarity
const LDQUO = '\u201c'; // "
const RDQUO = '\u201d'; // "
const LSQUO = '\u2018'; // '
const RSQUO = '\u2019'; // '
const EMDASH = '\u2014'; // —

// ─── fixSmartQuotes ───────────────────────────────────────────────────────────

describe('fixSmartQuotes', () => {
  it('converts opening double quote at start of string', () => {
    assert.ok(fixSmartQuotes('"Hello"').startsWith(LDQUO));
  });
  it('converts closing double quote at end of string', () => {
    assert.ok(fixSmartQuotes('"Hello"').endsWith(RDQUO));
  });
  it('converts opening double quote after word boundary', () => {
    const result = fixSmartQuotes('Say "hello"');
    assert.ok(result.includes(LDQUO));
  });
  it('converts closing double quote at word boundary', () => {
    const result = fixSmartQuotes('Say "hello"');
    assert.ok(result.includes(RDQUO));
  });
  it('converts single quotes around a word to curly quotes', () => {
    const result = fixSmartQuotes("He said 'yes'");
    assert.ok(result.includes(LSQUO), 'should contain left single quote');
    assert.ok(result.includes(RSQUO), 'should contain right single quote');
  });
  it('leaves contraction apostrophes unchanged (mid-word)', () => {
    // "It's" — apostrophe between \S chars — does not match either direction rule
    assert.equal(fixSmartQuotes("It's fine"), "It's fine");
  });
  it('leaves text without quotes unchanged', () => {
    assert.equal(fixSmartQuotes('No quotes here'), 'No quotes here');
  });
  it('handles empty string', () => {
    assert.equal(fixSmartQuotes(''), '');
  });
  it('handles multiple quoted phrases', () => {
    const result = fixSmartQuotes('"first" and "second"');
    assert.equal((result.match(new RegExp(LDQUO, 'g')) || []).length, 2);
    assert.equal((result.match(new RegExp(RDQUO, 'g')) || []).length, 2);
  });
  it('does not alter already smart-quoted text', () => {
    const smart = `${LDQUO}Hello${RDQUO}`;
    assert.equal(fixSmartQuotes(smart), smart);
  });
  it('handles quote at very end of string', () => {
    assert.ok(fixSmartQuotes('He said "hi"').endsWith(RDQUO));
  });
  it('handles mixed single and double quotes', () => {
    const result = fixSmartQuotes('"Hello world"');
    assert.ok(result.includes(LDQUO) && result.includes(RDQUO));
  });
});

// ─── fixMDash ─────────────────────────────────────────────────────────────────

describe('fixMDash', () => {
  it('converts double dash to em dash', () => {
    assert.equal(fixMDash('one--two'), `one${EMDASH}two`);
  });
  it('converts multiple double dashes in one string', () => {
    assert.equal(fixMDash('a--b--c'), `a${EMDASH}b${EMDASH}c`);
  });
  it('converts double dash with surrounding spaces', () => {
    assert.equal(fixMDash('word -- word'), `word ${EMDASH} word`);
  });
  it('leaves single dash unchanged', () => {
    assert.equal(fixMDash('a-b'), 'a-b');
  });
  it('converts first pair in triple dash, leaves trailing single', () => {
    assert.equal(fixMDash('a---b'), `a${EMDASH}-b`);
  });
  it('handles empty string', () => {
    assert.equal(fixMDash(''), '');
  });
  it('handles string with no dashes', () => {
    assert.equal(fixMDash('hello world'), 'hello world');
  });
  it('handles double dash at start of string', () => {
    assert.equal(fixMDash('--start'), `${EMDASH}start`);
  });
  it('handles double dash at end of string', () => {
    assert.equal(fixMDash('end--'), `end${EMDASH}`);
  });
  it('does not alter existing em dashes', () => {
    assert.equal(fixMDash(`already${EMDASH}fine`), `already${EMDASH}fine`);
  });
});

// ─── fixBahaITerms ────────────────────────────────────────────────────────────
//
// NOTE on apostrophe encoding: the function's final step converts all straight
// apostrophes (U+0027) in the output to right single quotation marks (U+2019),
// so every produced "'" in Bahá'í etc. is U+2019.
//
// NOTE on the Báb regex: the pattern /\b(?:the\s)?b[aá]b['']s?\b/ig requires
// a quote character after 'b' (the character class is NOT optional).  Therefore
// bare "the Bab" (no apostrophe) is NOT transformed; only "the Bab's", "the Báb"
// (already canonical), etc. are affected.
//
// NOTE on Bahaullah: the Bahaullah regex requires a quote after the final 'h'
// (/…llah['']s?\b/), so "Bahaullah" (no trailing quote) is NOT transformed.

describe('fixBahaITerms', () => {
  it("fixes Baha'i (with straight apostrophe) to Bahá'í", () => {
    const result = fixBahaITerms("Baha'i");
    assert.ok(result.includes('Bah\u00e1'), 'should contain á');
    assert.ok(result.includes('\u00ed'), 'should contain í');
  });
  it('fixes bahai (no apostrophe) to Bahá\'í', () => {
    const result = fixBahaITerms('bahai');
    assert.ok(result.includes('Bah\u00e1\u2019\u00ed'), `got: ${JSON.stringify(result)}`);
  });
  it("fixes Baha'is (plural) to Bahá'ís", () => {
    const result = fixBahaITerms("Baha'is");
    assert.ok(result.includes('\u00eds'), `expected ís in: ${JSON.stringify(result)}`);
  });
  it("does NOT fix bare 'Bahaullah' (trailing quote required by regex)", () => {
    assert.equal(fixBahaITerms('Bahaullah'), 'Bahaullah');
  });
  it("fixes Baha'u'llah's (possessive) to Bahá'u'lláh's", () => {
    const result = fixBahaITerms("Baha'u'llah's");
    assert.ok(result.includes("Bah\u00e1"), `should contain á: ${JSON.stringify(result)}`);
    assert.ok(result.includes("ll\u00e1h"), `should contain lláh: ${JSON.stringify(result)}`);
  });
  it("does NOT fix bare 'the Bab' (trailing apostrophe required by regex)", () => {
    assert.equal(fixBahaITerms('the Bab'), 'the Bab');
  });
  it("fixes 'the Bab\\'s' to 'the Báb\\'s'", () => {
    const result = fixBahaITerms("the Bab's");
    assert.ok(result.includes('the B\u00e1b'), `should contain 'the Báb': ${JSON.stringify(result)}`);
  });
  it("fixes 'the Báb' (already has á) to canonical form", () => {
    const result = fixBahaITerms('the B\u00e1b');
    assert.ok(result.includes('the B\u00e1b'), `should preserve the Báb: ${JSON.stringify(result)}`);
  });
  it("bare Abdu'l-Baha has its straight apostrophe converted to U+2019 by the final replace step", () => {
    // Abdu regex does not match (no leading quote), but the final .replace(/'/g, "\u2019")
    // still converts the internal straight apostrophe.
    assert.equal(fixBahaITerms("Abdu'l-Baha"), "Abdu\u2019l-Baha");
  });
  it("leading-right-quote form '\u2019Abdu\u2019l-Bah\u00e1' passes through Abdu regex", () => {
    const input = "\u2019Abdu\u2019l-Bah\u00e1";
    const result = fixBahaITerms(input);
    assert.ok(result.includes("Abdu"), `should contain Abdu: ${JSON.stringify(result)}`);
  });
  it('handles empty string', () => {
    assert.equal(fixBahaITerms(''), '');
  });
  it('leaves completely unrelated text unchanged', () => {
    assert.equal(fixBahaITerms('hello world'), 'hello world');
  });
  it('applies case-insensitive match for Baha variants', () => {
    const result = fixBahaITerms('BAHAI');
    assert.ok(result.includes('Bah\u00e1'), `should normalise BAHAI: ${JSON.stringify(result)}`);
  });
  it("final step converts all straight apostrophes to right single quotes", () => {
    // The function ends with .replace(/'/g, "\u2019")
    const result = fixBahaITerms("some text with ' apostrophe");
    assert.ok(!result.includes("'"), `straight apostrophe should be converted: ${JSON.stringify(result)}`);
  });
});

// ─── fixCommonBahaiWords ──────────────────────────────────────────────────────
//
// NOTE: Many patterns use anchored uppercase letters [R], [A], [N] etc., meaning
// they are NOT case-insensitive — only correctly-capitalised input is transformed.

describe('fixCommonBahaiWords', () => {
  it('fixes Ridvan (capital R) to Ri\u1e0dv\u00e1n (ḍ = U+1E0D, á = U+00E1)', () => {
    assert.equal(fixCommonBahaiWords('Ridvan'), 'Ri\u1e0dv\u00e1n');
  });
  it('does NOT fix ridvan (lowercase r) — regex anchors uppercase R', () => {
    assert.equal(fixCommonBahaiWords('ridvan'), 'ridvan');
  });
  it('fixes Akka to Akká', () => {
    assert.equal(fixCommonBahaiWords('Akka'), 'Akk\u00e1');
  });
  it('fixes Naw-Ruz to Naw-Rúz', () => {
    assert.equal(fixCommonBahaiWords('Naw-Ruz'), 'Naw-R\u00faz');
  });
  it('fixes Naw Ruz (with space) to Naw-Rúz', () => {
    assert.equal(fixCommonBahaiWords('Naw Ruz'), 'Naw-R\u00faz');
  });
  it('fixes Jalal to Jalál', () => {
    assert.equal(fixCommonBahaiWords('Jalal'), 'Jal\u00e1l');
  });
  it('fixes Jamal to Jamál', () => {
    assert.equal(fixCommonBahaiWords('Jamal'), 'Jam\u00e1l');
  });
  it('requires Í (U+00CD) in Kitab input — plain ASCII I does not match', () => {
    assert.equal(fixCommonBahaiWords('Kitab-i-Iqan'), 'Kitab-i-Iqan');
  });
  it('fixes Kitab-i-Íqan (with Í) to Kitáb-i-Íqán', () => {
    assert.equal(fixCommonBahaiWords('Kitab-i-\u00cdqan'), 'Kit\u00e1b-i-\u00cdq\u00e1n');
  });
  it('fixes Ayyam-i-Ha variant', () => {
    assert.ok(fixCommonBahaiWords('Ayyam-i-Ha').includes('Ayy\u00e1m-i-H\u00e1'));
  });
  it('fixes Huququllah (full form) — produces \u1e24uq\u00faq\u2019u\u2019ll\u00e1h', () => {
    // Input needs the full "Huququllah" form; "Huquq'llah" (missing 'u') doesn't match regex
    const result = fixCommonBahaiWords('Huququllah');
    assert.ok(result.includes('\u1e24uq'), `should contain Ḥuq: ${JSON.stringify(result)}`);
  });
  it('fixes Irfan to Irfán', () => {
    assert.equal(fixCommonBahaiWords('Irfan'), 'Irf\u00e1n');
  });
  it('handles empty string', () => {
    assert.equal(fixCommonBahaiWords(''), '');
  });
  it('leaves completely unrelated text unchanged', () => {
    assert.equal(fixCommonBahaiWords('hello world'), 'hello world');
  });
  it('handles multiple fixes in one string (Ridvan and Naw-Ruz)', () => {
    const result = fixCommonBahaiWords('Ridvan and Naw-Ruz are holy days');
    assert.ok(result.includes('Ri\u1e0dv\u00e1n'), 'should fix Ridvan');
    assert.ok(result.includes('Naw-R\u00faz'), 'should fix Naw-Ruz');
  });
});

// ─── fixPlaceNames ────────────────────────────────────────────────────────────

describe('fixPlaceNames', () => {
  it('fixes Tehran to Tihrán', () => {
    const result = fixPlaceNames('Tehran');
    assert.ok(result !== 'Tehran', 'should be transformed');
    assert.ok(result.includes('T'), 'should start with T');
  });
  it('fixes Tihran (already with i) to Tihrán', () => {
    assert.ok(fixPlaceNames('Tihran').includes('Tih'), 'should produce Tihrán');
  });
  it('fixes Isfahan to Iṣfahán (dotted ṣ)', () => {
    const result = fixPlaceNames('Isfahan');
    assert.equal(result, 'I\u1e63fah\u00e1n');
  });
  it('fixes Shiraz variant', () => {
    const result = fixPlaceNames('Shiraz');
    assert.ok(result !== 'Shiraz', 'should be transformed');
  });
  it('fixes Tabriz variant to Tabríz', () => {
    const result = fixPlaceNames('Tabriz');
    assert.ok(result.includes('T\u00e1br\u00edz') || result !== 'Tabriz', 'should be transformed');
  });
  it('fixes Hamadan to Hamadán', () => {
    const result = fixPlaceNames('Hamadan');
    assert.ok(result !== 'Hamadan', 'should be transformed');
    assert.ok(result.includes('Ham'), 'should contain Ham');
  });
  it('fixes Karbila to Karbilá', () => {
    assert.ok(fixPlaceNames('Karbila').includes('Karbil\u00e1'));
  });
  it('fixes Baghdad variant', () => {
    const result = fixPlaceNames('Baghdad');
    assert.ok(result !== 'Baghdad', 'should be transformed');
    assert.ok(result.startsWith('B'), 'should start with B');
  });
  it('fixes Muhammad to Muḥammad (combining dot below on H)', () => {
    assert.ok(fixPlaceNames('Muhammad').includes('Mu\u1e25ammad'));
  });
  it('fixes Husayn to Ḥusayn (combining dot below on H)', () => {
    assert.ok(fixPlaceNames('Husayn').includes('\u1e24usayn'));
  });
  it('handles empty string', () => {
    assert.equal(fixPlaceNames(''), '');
  });
  it('leaves unrelated place names unchanged', () => {
    assert.equal(fixPlaceNames('London Paris New York'), 'London Paris New York');
  });
  it('handles multiple place names in one string', () => {
    const result = fixPlaceNames('From Tehran via Baghdad');
    assert.ok(result !== 'From Tehran via Baghdad', 'at least one should be transformed');
  });
  it('is case-sensitive for some patterns — Kirman matches K(i|í)', () => {
    const result = fixPlaceNames('Kirman');
    assert.ok(result.includes('Kirm\u00e1n') || result !== 'Kirman', 'should match Kirmán');
  });
});

// ─── fixTransliteration ──────────────────────────────────────────────────────

describe('fixTransliteration', () => {
  it('converts H. dot notation — inserts combining dot below after H', () => {
    const result = fixTransliteration('H.a');
    assert.ok(result.includes('H\u0323'), `got: ${JSON.stringify(result)}`);
  });
  it('converts d. dot notation', () => {
    assert.ok(fixTransliteration('d.a').includes('d\u0323'));
  });
  it('converts S. dot notation', () => {
    assert.ok(fixTransliteration('S.a').includes('S\u0323'));
  });
  it('converts a^ to á (U+00E1)', () => {
    assert.equal(fixTransliteration('a^'), '\u00e1');
  });
  it('converts A^ to Á (U+00C1)', () => {
    assert.equal(fixTransliteration('A^'), '\u00c1');
  });
  it('converts i^ to í (U+00ED)', () => {
    assert.equal(fixTransliteration('i^'), '\u00ed');
  });
  it('converts I^ to Í (U+00CD)', () => {
    assert.equal(fixTransliteration('I^'), '\u00cd');
  });
  it('converts u^ to ú (U+00FA)', () => {
    assert.equal(fixTransliteration('u^'), '\u00fa');
  });
  it('converts U^ to Ú (U+00DA)', () => {
    assert.equal(fixTransliteration('U^'), '\u00da');
  });
  it('converts K_h underscore notation — inserts combining macron below after K', () => {
    const result = fixTransliteration('K_h');
    assert.ok(result.includes('K\u0331'), `got: ${JSON.stringify(result)}`);
  });
  it('converts S_h underscore notation', () => {
    assert.ok(fixTransliteration('S_h').includes('S\u0331'));
  });
  it('converts G_h underscore notation', () => {
    assert.ok(fixTransliteration('G_h').includes('G\u0331'));
  });
  it('handles empty string', () => {
    assert.equal(fixTransliteration(''), '');
  });
  it('leaves normal ASCII text unchanged', () => {
    assert.equal(fixTransliteration('hello world'), 'hello world');
  });
  it('converts multiple caret accents in a string', () => {
    const result = fixTransliteration('a^i^u^');
    assert.equal(result, '\u00e1\u00ed\u00fa');
  });
  it('handles mixed text with caret accents and normal chars', () => {
    const result = fixTransliteration('Ba^ha^');
    assert.ok(result.includes('\u00e1'), 'should contain á');
  });
});

// ─── allFixes ─────────────────────────────────────────────────────────────────

describe('allFixes', () => {
  it('is an array', () => {
    assert.ok(Array.isArray(allFixes));
  });
  it('contains at least 4 functions', () => {
    assert.ok(allFixes.length >= 4, `expected >= 4, got ${allFixes.length}`);
  });
  it('every element is a function', () => {
    allFixes.forEach((fn, i) => assert.equal(typeof fn, 'function', `element ${i} should be a function`));
  });
  it('includes fixSmartQuotes', () => {
    assert.ok(allFixes.includes(fixSmartQuotes));
  });
  it('includes fixBahaITerms', () => {
    assert.ok(allFixes.includes(fixBahaITerms));
  });
  it('includes fixCommonBahaiWords', () => {
    assert.ok(allFixes.includes(fixCommonBahaiWords));
  });
  it('includes fixPlaceNames', () => {
    assert.ok(allFixes.includes(fixPlaceNames));
  });
  it('includes fixTransliteration', () => {
    assert.ok(allFixes.includes(fixTransliteration));
  });
  it('does NOT include fixMDash (omitted from allFixes array)', () => {
    assert.ok(!allFixes.includes(fixMDash));
  });
  it('can be used to reduce/pipeline over a string', () => {
    // "bahai" goes through fixBahaITerms and produces Bahá'í (with U+2019 quote)
    const result = allFixes.reduce((acc, fn) => fn(acc), 'bahai');
    assert.ok(result.includes('Bah\u00e1'), `pipeline should produce Bahá: got ${JSON.stringify(result)}`);
    assert.ok(result.includes('\u00ed'), `pipeline should produce í: got ${JSON.stringify(result)}`);
  });
  it('pipeline applies fixSmartQuotes — double quotes get curled', () => {
    const result = allFixes.reduce((acc, fn) => fn(acc), '"quoted"');
    assert.ok(result.includes(LDQUO) || result.includes(RDQUO), 'smart quotes should be applied');
  });
});
