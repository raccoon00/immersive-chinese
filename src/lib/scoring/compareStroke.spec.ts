import { describe, expect, it } from 'vitest';
import type { UserStroke } from '$lib/practice/types';
import { compareStroke, classifyStroke } from '$lib/scoring/compareStroke';
import { thresholds } from '$lib/scoring/thresholds';
import type { TargetStroke } from '$lib/hanzi/types';

function makeStroke(points: Array<[number, number]>): { target: TargetStroke; user: UserStroke } {
	const polyline = points.map(([x, y]) => ({ x, y }));

	return {
		target: {
			index: 0,
			svgPath: '',
			medianRaw: [],
			median: polyline,
			resampled: polyline
		},
		user: {
			points: polyline,
			processed: polyline
		}
	};
}

describe('compareStroke', () => {
	it('matches identical strokes', () => {
		const { target, user } = makeStroke([
			[0, 0],
			[0.5, 0],
			[1, 0]
		]);
		const comparison = compareStroke(target, user, thresholds);

		expect(comparison.score).toBeCloseTo(0);
		expect(classifyStroke(comparison, thresholds)).toBe('matched');
	});

	it('detects reversed direction', () => {
		const { target } = makeStroke([
			[0, 0],
			[0.5, 0],
			[1, 0]
		]);
		const reversed: UserStroke = {
			points: [
				{ x: 1, y: 0 },
				{ x: 0.5, y: 0 },
				{ x: 0, y: 0 }
			],
			processed: [
				{ x: 1, y: 0 },
				{ x: 0.5, y: 0 },
				{ x: 0, y: 0 }
			]
		};
		const comparison = compareStroke(target, reversed, thresholds);

		expect(comparison.directionPenalty).toBeGreaterThan(0);
		expect(classifyStroke(comparison, thresholds)).toBe('wrong_direction');
	});
});
