import { describe, expect, it } from 'vitest';
import { validateWordAttempt } from '$lib/validation/validateWordAttempt';
import type { WordAttempt, WordCard } from '$lib/practice/types';

const card: WordCard = {
	id: 'zhongguo',
	hanzi: '中国',
	translation: 'China'
};

describe('validateWordAttempt', () => {
	it('detects missing characters', () => {
		const attempt: WordAttempt = {
			cardId: 'zhongguo',
			characters: []
		};

		const result = validateWordAttempt(card, attempt);

		expect(result.status).toBe('missing_characters');
		expect(result.countStatus).toBe('missing_characters');
	});

	it('runs full validation when character count matches', () => {
		const attempt: WordAttempt = {
			cardId: 'zhongguo',
			characters: [
				{
					id: 'char_0',
					strokes: [
						{
							points: [
								{ x: 0.5, y: 0.1 },
								{ x: 0.5, y: 0.9 }
							],
							processed: [
								{ x: 0.5, y: 0.1 },
								{ x: 0.5, y: 0.9 }
							]
						}
					]
				},
				{
					id: 'char_1',
					strokes: [
						{
							points: [
								{ x: 0.5, y: 0.1 },
								{ x: 0.5, y: 0.9 }
							],
							processed: [
								{ x: 0.5, y: 0.1 },
								{ x: 0.5, y: 0.9 }
							]
						}
					]
				}
			]
		};

		const result = validateWordAttempt(card, attempt);

		expect(result.validationStage).toBe('full');
		expect(result.characterResults).toHaveLength(2);
	});
});
