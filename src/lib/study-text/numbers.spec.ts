import { describe, expect, it } from 'vitest';
import {
	chineseNumberReadingToPinyin,
	integerToChineseReading,
	isNumericToken,
	numberTokenToPinyin
} from '$lib/study-text/numbers';

describe('isNumericToken', () => {
	it('detects pure digit tokens', () => {
		expect(isNumericToken('20')).toBe(true);
		expect(isNumericToken('007')).toBe(true);
		expect(isNumericToken('20a')).toBe(false);
	});
});

describe('integerToChineseReading', () => {
	it('converts simple integers', () => {
		expect(integerToChineseReading('0')).toBe('零');
		expect(integerToChineseReading('7')).toBe('七');
		expect(integerToChineseReading('10')).toBe('十');
		expect(integerToChineseReading('11')).toBe('十一');
		expect(integerToChineseReading('20')).toBe('二十');
	});

	it('handles internal zeros and larger numbers', () => {
		expect(integerToChineseReading('101')).toBe('一百零一');
		expect(integerToChineseReading('1005')).toBe('一千零五');
		expect(integerToChineseReading('1337')).toBe('一千三百三十七');
		expect(integerToChineseReading('10001')).toBe('一万零一');
		expect(integerToChineseReading('12003')).toBe('一万二千零三');
		expect(integerToChineseReading('1002003')).toBe('一百万二千零三');
	});

	it('ignores leading zeros', () => {
		expect(integerToChineseReading('007')).toBe('七');
	});
});

describe('numberTokenToPinyin', () => {
	it('converts numeric tokens to pinyin', () => {
		expect(chineseNumberReadingToPinyin('二十')).toBe('èr shí');
		expect(numberTokenToPinyin('20')).toBe('èr shí');
		expect(numberTokenToPinyin('1337')).toBe('yī qiān sān bǎi sān shí qī');
	});
});
