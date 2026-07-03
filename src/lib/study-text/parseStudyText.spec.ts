import { describe, expect, it } from 'vitest';
import {
	buildStudyTextStructure,
	inferStudyTextTitle,
	parseStudyText
} from '$lib/study-text/parseStudyText';

describe('parseStudyText', () => {
	it('splits paragraphs and Chinese sentences', () => {
		const parsed = parseStudyText('你好。你怎么样？\n\n我很好！谢谢。');

		expect(parsed.paragraphs).toHaveLength(2);
		expect(parsed.paragraphs[0].sentences.map((sentence) => sentence.text)).toEqual([
			'你好。',
			'你怎么样？'
		]);
		expect(parsed.paragraphs[1].sentences.map((sentence) => sentence.text)).toEqual([
			'我很好！',
			'谢谢。'
		]);
		expect(parsed.sentenceCount).toBe(4);
	});

	it('builds study structure with selected sentences by default', () => {
		const parsed = parseStudyText('学生很好。老师也很好。', 'Lesson 1');
		const structure = buildStudyTextStructure(parsed, 'study_1');

		expect(structure.title).toBe('Lesson 1');
		expect(structure.sentences).toHaveLength(2);
		expect(structure.selectedSentenceIds).toHaveLength(2);
		expect(structure.sentences.every((sentence) => sentence.selected)).toBe(true);
	});

	it('infers title from the first non-empty line', () => {
		expect(inferStudyTextTitle('\n\n第一行标题\n第二行')).toBe('第一行标题');
	});
});
