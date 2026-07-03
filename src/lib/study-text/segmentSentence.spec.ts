import { describe, expect, it } from 'vitest';
import { autoSegmentSentence } from '$lib/study-text/segmentSentence';

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
