import { describe, expect, it } from 'vitest';
import {
	autoSegmentSentence,
	manualSegmentSentence,
	serializeSentenceSegmentation
} from '$lib/study-text/segmentSentence';

describe('autoSegmentSentence', () => {
	it('segments a sentence into words and punctuation', () => {
		const segmentation = autoSegmentSentence('sentence_1', '你好，老师！');

		expect(segmentation.tokens.map((token) => token.text)).toEqual(['你好', '，', '老师', '！']);
		expect(segmentation.tokens.map((token) => token.kind)).toEqual([
			'word',
			'punctuation',
			'word',
			'punctuation'
		]);
	});
});

describe('manualSegmentSentence', () => {
	it('creates manual tokens from separator text', () => {
		const segmentation = manualSegmentSentence('sentence_1', '你好！', '你 | 好 | ！');

		expect(segmentation.source).toBe('manual');
		expect(segmentation.tokens.map((token) => token.text)).toEqual(['你', '好', '！']);
		expect(segmentation.tokens.every((token) => token.manuallyEdited)).toBe(true);
	});

	it('serializes tokens back to editable text', () => {
		const segmentation = manualSegmentSentence('sentence_1', '你好！', '你 | 好 | ！');
		expect(serializeSentenceSegmentation(segmentation.tokens)).toBe('你 | 好 | ！');
	});
});
