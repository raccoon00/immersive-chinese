import { resampleByArcLength } from '$lib/drawing/geometry';
import type { RawHanziWriterData, TargetCharacter } from '$lib/hanzi/types';
import { normalizeTargetPoint } from '$lib/hanzi/normalizeHanziData';

export const RESAMPLED_POINTS = 64;

export function preprocessHanziData(
	char: string,
	raw: RawHanziWriterData,
	resampledPoints = RESAMPLED_POINTS
): TargetCharacter {
	return {
		char,
		strokes: raw.strokes.map((svgPath, index) => {
			const medianRaw = raw.medians[index] ?? [];
			const median = medianRaw.map((point) => normalizeTargetPoint(point as [number, number]));

			return {
				index,
				svgPath,
				medianRaw,
				median,
				resampled: resampleByArcLength(median, resampledPoints)
			};
		})
	};
}
