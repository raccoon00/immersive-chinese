import type { SentenceSegmentation, StudyToken, StudyTokenKind } from '$lib/study-text/types';

const punctuationPattern = /^[\p{P}\p{S}]+$/u;
const whitespacePattern = /^\s+$/u;

function inferTokenKind(text: string, isWordLike: boolean | undefined): StudyTokenKind {
	if (punctuationPattern.test(text)) {
		return 'punctuation';
	}

	if (isWordLike === false) {
		return 'unknown';
	}

	return 'word';
}

function createToken(
	sentenceId: string,
	text: string,
	start: number,
	end: number,
	isWordLike: boolean | undefined
): StudyToken {
	return {
		id: `${sentenceId}_${start}_${end}`,
		sentenceId,
		start,
		end,
		text,
		kind: inferTokenKind(text, isWordLike),
		autoProposed: true,
		manuallyEdited: false,
		dictionaryMatches: [],
		tags: []
	};
}

export function autoSegmentSentence(sentenceId: string, text: string): SentenceSegmentation {
	const SegmenterCtor = globalThis.Intl?.Segmenter;
	const updatedAt = new Date().toISOString();
	const tokens: StudyToken[] = [];

	if (SegmenterCtor) {
		const segmenter = new SegmenterCtor('zh-CN', { granularity: 'word' });
		for (const segment of segmenter.segment(text)) {
			if (whitespacePattern.test(segment.segment)) {
				continue;
			}

			tokens.push(
				createToken(
					sentenceId,
					segment.segment,
					segment.index,
					segment.index + segment.segment.length,
					segment.isWordLike
				)
			);
		}
	}

	if (tokens.length === 0) {
		for (let index = 0; index < text.length; index += 1) {
			const char = text[index];
			if (!char || whitespacePattern.test(char)) {
				continue;
			}

			tokens.push(
				createToken(sentenceId, char, index, index + char.length, !punctuationPattern.test(char))
			);
		}
	}

	return {
		sentenceId,
		source: 'auto',
		tokens,
		updatedAt
	};
}
