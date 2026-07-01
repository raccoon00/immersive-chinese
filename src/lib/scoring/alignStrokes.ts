import type { TargetStroke } from '$lib/hanzi/types';
import type { UserStroke } from '$lib/practice/types';
import { compareStroke } from '$lib/scoring/compareStroke';
import { thresholds, type Thresholds } from '$lib/scoring/thresholds';
import type { StrokeAlignmentStep } from '$lib/validation/types';

export function alignStrokes(
	targetStrokes: TargetStroke[],
	userStrokes: UserStroke[],
	customThresholds: Thresholds = thresholds
): { alignment: StrokeAlignmentStep[]; totalAlignmentCost: number } {
	const alignment: StrokeAlignmentStep[] = [];
	const sharedLength = Math.min(targetStrokes.length, userStrokes.length);
	let totalAlignmentCost = 0;

	for (let index = 0; index < sharedLength; index += 1) {
		const comparison = compareStroke(targetStrokes[index], userStrokes[index], customThresholds);
		alignment.push({
			op: 'match',
			targetStrokeIndex: index,
			userStrokeIndex: index,
			cost: comparison.score
		});
		totalAlignmentCost += comparison.score;
	}

	for (let index = sharedLength; index < targetStrokes.length; index += 1) {
		alignment.push({
			op: 'missing',
			targetStrokeIndex: index,
			cost: customThresholds.missingStrokePenalty
		});
		totalAlignmentCost += customThresholds.missingStrokePenalty;
	}

	for (let index = sharedLength; index < userStrokes.length; index += 1) {
		alignment.push({
			op: 'extra',
			userStrokeIndex: index,
			cost: customThresholds.extraStrokePenalty
		});
		totalAlignmentCost += customThresholds.extraStrokePenalty;
	}

	return {
		alignment,
		totalAlignmentCost
	};
}
