function normalizeSyllableBody(text: string): string {
	return text
		.replace(/u:/gi, (value) => (value[0] === 'U' ? 'Ü' : 'ü'))
		.replace(/v/gi, (value) => (value === 'V' ? 'Ü' : 'ü'));
}

function applyToneMark(syllable: string, tone: number): string {
	if (tone === 5) {
		return syllable;
	}

	const lower = syllable.toLowerCase();
	let vowelIndex = lower.indexOf('a');
	if (vowelIndex === -1) {
		vowelIndex = lower.indexOf('e');
	}
	if (vowelIndex === -1 && lower.includes('ou')) {
		vowelIndex = lower.indexOf('o');
	}
	if (vowelIndex === -1) {
		const vowels = ['a', 'e', 'i', 'o', 'u', 'ü'];
		for (let index = lower.length - 1; index >= 0; index -= 1) {
			if (vowels.includes(lower[index] ?? '')) {
				vowelIndex = index;
				break;
			}
		}
	}
	if (vowelIndex === -1) {
		return syllable;
	}

	const marks: Record<string, string[]> = {
		a: ['ā', 'á', 'ǎ', 'à'],
		e: ['ē', 'é', 'ě', 'è'],
		i: ['ī', 'í', 'ǐ', 'ì'],
		o: ['ō', 'ó', 'ǒ', 'ò'],
		u: ['ū', 'ú', 'ǔ', 'ù'],
		ü: ['ǖ', 'ǘ', 'ǚ', 'ǜ']
	};
	const originalChar = syllable[vowelIndex] ?? '';
	const baseChar = lower[vowelIndex] ?? '';
	const markedBaseChar = marks[baseChar]?.[tone - 1];
	if (!markedBaseChar) {
		return syllable;
	}

	const markedChar =
		originalChar === originalChar.toUpperCase() ? markedBaseChar.toUpperCase() : markedBaseChar;
	return `${syllable.slice(0, vowelIndex)}${markedChar}${syllable.slice(vowelIndex + 1)}`;
}

function convertNumericSyllable(match: string, body: string, toneDigit: string): string {
	const normalizedBody = normalizeSyllableBody(body);
	const tone = Number.parseInt(toneDigit, 10);
	if (!Number.isInteger(tone) || tone < 1 || tone > 5) {
		return normalizeSyllableBody(match);
	}

	return applyToneMark(normalizedBody, tone);
}

export function formatPinyinForDisplay(text: string | undefined): string {
	if (!text) {
		return '';
	}

	return text.replace(/([A-Za-züÜvV:]+)([1-5])/gu, convertNumericSyllable);
}
