import { describe, expect, it } from 'vitest';
import {
	mapWholeTranslationToStudyText,
	splitTranslationIntoSentences
} from '$lib/study-text/parseTranslation';
import type { StudyText } from '$lib/study-text/types';

describe('splitTranslationIntoSentences', () => {
	it('splits basic translated text into sentences', () => {
		expect(splitTranslationIntoSentences('Hello. How are you? I am fine!')).toEqual([
			'Hello.',
			'How are you?',
			'I am fine!'
		]);
	});
});

describe('mapWholeTranslationToStudyText', () => {
	const studyText: StudyText = {
		id: 'study_1',
		title: 'Test',
		rawText: '你好。老师好。',
		paragraphs: [{ id: 'p1', index: 0, text: '你好。老师好。', sentenceIds: ['s1', 's2'] }],
		sentences: [
			{
				id: 's1',
				paragraphId: 'p1',
				indexInParagraph: 0,
				globalIndex: 0,
				text: '你好。',
				startOffset: 0,
				endOffset: 3,
				selected: true,
				segmentation: { sentenceId: 's1', source: 'auto', tokens: [], updatedAt: '' }
			},
			{
				id: 's2',
				paragraphId: 'p1',
				indexInParagraph: 1,
				globalIndex: 1,
				text: '老师好。',
				startOffset: 3,
				endOffset: 7,
				selected: true,
				segmentation: { sentenceId: 's2', source: 'auto', tokens: [], updatedAt: '' }
			}
		],
		selectedSentenceIds: ['s1', 's2'],
		status: 'in_progress',
		createdAt: '',
		updatedAt: ''
	};

	it('maps translation sequentially', () => {
		const result = mapWholeTranslationToStudyText(studyText, 'Hello. Hi teacher.');

		expect(result.pairs.map((pair) => pair.translation)).toEqual(['Hello.', 'Hi teacher.']);
		expect(result.warnings).toEqual([]);
	});

	it('warns on count mismatch', () => {
		const result = mapWholeTranslationToStudyText(studyText, 'Hello.');

		expect(result.pairs.map((pair) => pair.translation)).toEqual(['Hello.', '']);
		expect(result.warnings.length).toBeGreaterThan(0);
	});
});
