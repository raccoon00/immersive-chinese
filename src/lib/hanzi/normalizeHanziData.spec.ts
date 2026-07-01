import { describe, expect, it } from 'vitest';
import { normalizeTargetPoint } from '$lib/hanzi/normalizeHanziData';
import { preprocessHanziData } from '$lib/hanzi/preprocessHanziData';
import type { RawHanziWriterData } from '$lib/hanzi/types';

describe('normalizeTargetPoint', () => {
	it('maps Hanzi Writer coordinates into normalized top-left canvas space', () => {
		expect(normalizeTargetPoint([0, 900])).toEqual({ x: 0, y: 0 });
		expect(normalizeTargetPoint([1024, -124])).toEqual({ x: 1, y: 1 });
		expect(normalizeTargetPoint([512, 388])).toEqual({ x: 0.5, y: 0.5 });
	});
});

describe('preprocessHanziData', () => {
	it('normalizes and resamples each stroke median', () => {
		const raw: RawHanziWriterData = {
			strokes: ['M 0 900 L 1024 -124'],
			medians: [
				[
					[0, 900],
					[1024, -124]
				]
			]
		};

		const processed = preprocessHanziData('测', raw, 4);

		expect(processed.char).toBe('测');
		expect(processed.strokes).toHaveLength(1);
		expect(processed.strokes[0].median).toEqual([
			{ x: 0, y: 0 },
			{ x: 1, y: 1 }
		]);
		expect(processed.strokes[0].resampled).toHaveLength(4);
		expect(processed.strokes[0].resampled[0]).toMatchObject({ x: 0, y: 0 });
		expect(processed.strokes[0].resampled[3]).toMatchObject({ x: 1, y: 1 });
	});
});
