import { formatPinyinForDisplay } from '$lib/study-text/pinyin';

const numericTokenPattern = /^\d+$/u;
const digitHanzi = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
const smallUnits = ['千', '百', '十', ''];
const bigUnits = ['', '万', '亿', '兆'];
const numberReadingPinyin: Record<string, string> = {
	零: 'ling2',
	一: 'yi1',
	二: 'er4',
	三: 'san1',
	四: 'si4',
	五: 'wu3',
	六: 'liu4',
	七: 'qi1',
	八: 'ba1',
	九: 'jiu3',
	十: 'shi2',
	百: 'bai3',
	千: 'qian1',
	万: 'wan4',
	亿: 'yi4',
	兆: 'zhao4'
};

export function isNumericToken(text: string): boolean {
	return numericTokenPattern.test(text.trim());
}

function normalizeIntegerString(text: string): string {
	const trimmed = text.trim();
	const withoutLeadingZeros = trimmed.replace(/^0+/u, '');
	return withoutLeadingZeros.length > 0 ? withoutLeadingZeros : '0';
}

function splitIntoFourDigitGroups(text: string): string[] {
	const groups: string[] = [];
	for (let end = text.length; end > 0; end -= 4) {
		groups.unshift(text.slice(Math.max(0, end - 4), end));
	}
	return groups;
}

function convertFourDigitGroup(groupText: string): string {
	const padded = groupText.padStart(4, '0');
	let result = '';
	let pendingZero = false;

	for (const [index, digitText] of [...padded].entries()) {
		const digit = Number.parseInt(digitText, 10);
		if (digit === 0) {
			if (result.length > 0) {
				pendingZero = true;
			}
			continue;
		}

		if (pendingZero) {
			result += '零';
			pendingZero = false;
		}

		const unit = smallUnits[index] ?? '';
		const isLeadingTeen = digit === 1 && unit === '十' && result.length === 0;
		if (!isLeadingTeen) {
			result += digitHanzi[digit] ?? '';
		}
		result += unit;
	}

	return result;
}

export function integerToChineseReading(text: string): string | undefined {
	if (!isNumericToken(text)) {
		return undefined;
	}

	const normalized = normalizeIntegerString(text);
	if (normalized === '0') {
		return '零';
	}

	const groups = splitIntoFourDigitGroups(normalized);
	let result = '';
	let pendingZero = false;

	for (const [index, groupText] of groups.entries()) {
		const groupValue = Number.parseInt(groupText, 10);
		const bigUnit = bigUnits[groups.length - 1 - index] ?? '';
		if (groupValue === 0) {
			pendingZero = result.length > 0;
			continue;
		}

		if (result.length > 0 && (pendingZero || groupValue < 1000)) {
			result += '零';
		}

		result += `${convertFourDigitGroup(groupText)}${bigUnit}`;
		pendingZero = false;
	}

	return result.replace(/零+/gu, '零').replace(/零$/u, '');
}

export function chineseNumberReadingToPinyin(reading: string): string {
	return formatPinyinForDisplay(
		[...reading]
			.map((character) => numberReadingPinyin[character] ?? '')
			.filter((part) => part.length > 0)
			.join(' ')
	);
}

export function numberTokenToPinyin(text: string): string | undefined {
	const reading = integerToChineseReading(text);
	return reading ? chineseNumberReadingToPinyin(reading) : undefined;
}
