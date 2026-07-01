import { describe, expect, it } from 'vitest';
import { polylineLength, resampleByArcLength } from '$lib/drawing/geometry';
import type { Polyline } from '$lib/drawing/types';

function line(points: Array<[number, number]>): Polyline {
	return points.map(([x, y]) => ({ x, y }));
}

describe('polylineLength', () => {
	it('measures a horizontal line', () => {
		expect(
			polylineLength(
				line([
					[0, 0],
					[1, 0]
				])
			)
		).toBeCloseTo(1);
	});

	it('measures multiple connected segments', () => {
		expect(
			polylineLength(
				line([
					[0, 0],
					[0, 1],
					[1, 1]
				])
			)
		).toBeCloseTo(2);
	});
});

describe('resampleByArcLength', () => {
	it('resamples a horizontal line to evenly spaced points', () => {
		const result = resampleByArcLength(
			line([
				[0, 0],
				[1, 0]
			]),
			5
		);

		expect(result).toHaveLength(5);
		expect(result[0]).toMatchObject({ x: 0, y: 0 });
		expect(result[2]).toMatchObject({ x: 0.5, y: 0 });
		expect(result[4]).toMatchObject({ x: 1, y: 0 });
	});

	it('resamples a vertical line to evenly spaced points', () => {
		const result = resampleByArcLength(
			line([
				[0, 0],
				[0, 1]
			]),
			4
		);

		expect(result).toHaveLength(4);
		expect(result[1].y).toBeCloseTo(1 / 3);
		expect(result[2].y).toBeCloseTo(2 / 3);
	});

	it('duplicates a single point when needed', () => {
		const result = resampleByArcLength(line([[0.25, 0.75]]), 3);

		expect(result).toEqual([
			{ x: 0.25, y: 0.75 },
			{ x: 0.25, y: 0.75 },
			{ x: 0.25, y: 0.75 }
		]);
	});
});
