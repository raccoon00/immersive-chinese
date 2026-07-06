import type { SentenceSegmentation, StudyToken, StudyTokenKind } from '$lib/study-text/types';

const punctuationPattern = /^[\p{P}\p{S}]+$/u;
const whitespacePattern = /^\s+$/u;

function normalizeWhitespace(text: string): string {
	return text.replace(/\s+/gu, '');
}

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
	isWordLike: boolean | undefined,
	options?: {
		autoProposed?: boolean;
		manuallyEdited?: boolean;
	}
): StudyToken {
	return {
		id: `${sentenceId}_${start}_${end}`,
		sentenceId,
		start,
		end,
		text,
		kind: inferTokenKind(text, isWordLike),
		autoProposed: options?.autoProposed ?? true,
		manuallyEdited: options?.manuallyEdited ?? false,
		dictionaryMatches: [],
		tags: []
	};
}

export function serializeSentenceSegmentation(tokens: StudyToken[]): string {
	return tokens.map((token) => token.text).join(' | ');
}

export function manualSegmentSentence(
	sentenceId: string,
	sentenceText: string,
	segmentationText: string
): SentenceSegmentation {
	const parts = segmentationText
		.split('|')
		.map((part) => part.trim())
		.filter((part) => part.length > 0);

	if (parts.length === 0) {
		throw new Error('Manual segmentation cannot be empty.');
	}

	if (normalizeWhitespace(parts.join('')) !== normalizeWhitespace(sentenceText)) {
		throw new Error(
			'Manual segmentation must match the sentence text when separators are removed, ignoring whitespace differences.'
		);
	}

	let cursor = 0;
	const tokens = parts.map((part) => {
		const start = cursor;
		const end = start + part.length;
		cursor = end;
		return createToken(sentenceId, part, start, end, !punctuationPattern.test(part), {
			autoProposed: false,
			manuallyEdited: true
		});
	});

	return {
		sentenceId,
		source: 'manual',
		tokens,
		updatedAt: new Date().toISOString()
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
