import { describe, expect, it } from 'vitest';
import { compareCharacter } from '$lib/scoring/compareCharacter';
import { thresholds } from '$lib/scoring/thresholds';
import type { TargetCharacter } from '$lib/hanzi/types';
import type { UserCharacterAttempt } from '$lib/practice/types';

const targetCharacter: TargetCharacter = {
	char: '十',
	strokes: [
		{
			index: 0,
			svgPath: '',
			medianRaw: [],
			median: [
				{ x: 0.5, y: 0 },
				{ x: 0.5, y: 1 }
			],
			resampled: [
				{ x: 0.5, y: 0 },
				{ x: 0.5, y: 1 }
			]
		},
		{
			index: 1,
			svgPath: '',
			medianRaw: [],
			median: [
				{ x: 0, y: 0.5 },
				{ x: 1, y: 0.5 }
			],
			resampled: [
				{ x: 0, y: 0.5 },
				{ x: 1, y: 0.5 }
			]
		}
	]
};

describe('compareCharacter', () => {
	it('marks a missing stroke via alignment', () => {
		const userCharacter: UserCharacterAttempt = {
			id: 'char_1',
			strokes: [
				{
					points: [
						{ x: 0.5, y: 0 },
						{ x: 0.5, y: 1 }
					],
					processed: [
						{ x: 0.5, y: 0 },
						{ x: 0.5, y: 1 }
					]
				}
			]
		};

		const result = compareCharacter(targetCharacter, userCharacter, 0, thresholds);

		expect(result.status).toBe('bad');
		expect(result.matchedStrokeCount).toBe(1);
		expect(result.missingStrokeCount).toBe(1);
		expect(result.alignment.map((step) => step.op)).toEqual(['match', 'missing']);
	});
});
