import { describe, expect, it } from 'vitest';
import { formatPinyinForDisplay } from '$lib/study-text/pinyin';

describe('formatPinyinForDisplay', () => {
	it('converts numeric pinyin to diacritics', () => {
		expect(formatPinyinForDisplay('ni3 hao3')).toBe('nǐ hǎo');
	});

	it('handles ou and umlaut vowels', () => {
		expect(formatPinyinForDisplay('dou1 fu3 lü4')).toBe('dōu fǔ lǜ');
		expect(formatPinyinForDisplay('lu:4 se4')).toBe('lǜ sè');
		expect(formatPinyinForDisplay('nv3')).toBe('nǚ');
	});

	it('leaves neutral tone syllables without diacritics', () => {
		expect(formatPinyinForDisplay('ma5 ma')).toBe('ma ma');
	});

	it('preserves already formatted pinyin', () => {
		expect(formatPinyinForDisplay('nǐ hǎo')).toBe('nǐ hǎo');
	});
});
