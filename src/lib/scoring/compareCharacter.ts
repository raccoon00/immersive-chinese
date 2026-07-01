import type { TargetCharacter } from '$lib/hanzi/types';
import type { UserCharacterAttempt } from '$lib/practice/types';
import { alignStrokes } from '$lib/scoring/alignStrokes';
import { classifyStroke, compareStroke } from '$lib/scoring/compareStroke';
import { thresholds, type Thresholds } from '$lib/scoring/thresholds';
import type { CharacterValidationResult, StrokeValidationResult } from '$lib/validation/types';

export function markMissingCharacter(
	userCharacterIndex: number,
	targetCharacter: TargetCharacter,
	customThresholds: Thresholds = thresholds
): CharacterValidationResult {
	return {
		targetChar: targetCharacter.char,
		userCharacterIndex,
		status: 'missing',
		targetStrokeCount: targetCharacter.strokes.length,
		userStrokeCount: 0,
		strokeResults: targetCharacter.strokes.map((stroke) => ({
			status: 'missing',
			targetStrokeIndex: stroke.index,
			score: customThresholds.missingStrokePenalty
		})),
		alignment: targetCharacter.strokes.map((stroke) => ({
			op: 'missing',
			targetStrokeIndex: stroke.index,
			cost: customThresholds.missingStrokePenalty
		})),
		totalScore: targetCharacter.strokes.length * customThresholds.missingStrokePenalty,
		matchedStrokeCount: 0,
		missingStrokeCount: targetCharacter.strokes.length,
		extraStrokeCount: 0,
		wrongDirectionCount: 0,
		wrongOrderCount: 0,
		badShapeCount: 0
	};
}

export function markExtraCharacter(
	userCharacterIndex: number,
	userCharacter: UserCharacterAttempt,
	customThresholds: Thresholds = thresholds
): CharacterValidationResult {
	return {
		targetChar: '',
		userCharacterIndex,
		status: 'extra',
		targetStrokeCount: 0,
		userStrokeCount: userCharacter.strokes.length,
		strokeResults: userCharacter.strokes.map((_, index) => ({
			status: 'extra',
			userStrokeIndex: index,
			score: customThresholds.extraStrokePenalty
		})),
		alignment: userCharacter.strokes.map((_, index) => ({
			op: 'extra',
			userStrokeIndex: index,
			cost: customThresholds.extraStrokePenalty
		})),
		totalScore: userCharacter.strokes.length * customThresholds.extraStrokePenalty,
		matchedStrokeCount: 0,
		missingStrokeCount: 0,
		extraStrokeCount: userCharacter.strokes.length,
		wrongDirectionCount: 0,
		wrongOrderCount: 0,
		badShapeCount: 0
	};
}

function findWrongOrderTargetStrokeIndex(
	targetCharacter: TargetCharacter,
	userCharacter: UserCharacterAttempt,
	intendedTargetStrokeIndex: number,
	userStrokeIndex: number,
	customThresholds: Thresholds
): number | undefined {
	for (const targetStroke of targetCharacter.strokes) {
		if (targetStroke.index === intendedTargetStrokeIndex) {
			continue;
		}

		const comparison = compareStroke(
			targetStroke,
			userCharacter.strokes[userStrokeIndex],
			customThresholds
		);

		if (classifyStroke(comparison, customThresholds) === 'matched') {
			return targetStroke.index;
		}
	}

	return undefined;
}

export function compareCharacter(
	targetCharacter: TargetCharacter,
	userCharacter: UserCharacterAttempt,
	userCharacterIndex: number,
	customThresholds: Thresholds = thresholds
): CharacterValidationResult {
	const { alignment, totalAlignmentCost } = alignStrokes(
		targetCharacter.strokes,
		userCharacter.strokes,
		customThresholds
	);
	const strokeResults: StrokeValidationResult[] = [];
	let matchedStrokeCount = 0;
	let missingStrokeCount = 0;
	let extraStrokeCount = 0;
	let wrongDirectionCount = 0;
	let wrongOrderCount = 0;
	let badShapeCount = 0;

	for (const step of alignment) {
		if (
			step.op === 'match' &&
			step.targetStrokeIndex !== undefined &&
			step.userStrokeIndex !== undefined
		) {
			const comparison = compareStroke(
				targetCharacter.strokes[step.targetStrokeIndex],
				userCharacter.strokes[step.userStrokeIndex],
				customThresholds
			);
			const baseStatus = classifyStroke(comparison, customThresholds);
			const wrongOrderTargetStrokeIndex =
				baseStatus === 'matched'
					? undefined
					: findWrongOrderTargetStrokeIndex(
							targetCharacter,
							userCharacter,
							step.targetStrokeIndex,
							step.userStrokeIndex,
							customThresholds
						);
			const status = wrongOrderTargetStrokeIndex !== undefined ? 'wrong_order' : baseStatus;

			if (status === 'matched') {
				matchedStrokeCount += 1;
			} else if (status === 'wrong_direction') {
				wrongDirectionCount += 1;
			} else if (status === 'wrong_order') {
				wrongOrderCount += 1;
			} else if (status === 'bad_shape') {
				badShapeCount += 1;
			}

			strokeResults.push({
				status,
				targetStrokeIndex: step.targetStrokeIndex,
				userStrokeIndex: step.userStrokeIndex,
				wrongOrderTargetStrokeIndex,
				score: comparison.score,
				shapeDistance: comparison.shapeDistance,
				endpointDistance: comparison.endpointDistance,
				directionPenalty: comparison.directionPenalty,
				lengthPenalty: comparison.lengthPenalty,
				missedSegments: comparison.missedSegments
			});
		} else if (step.op === 'missing' && step.targetStrokeIndex !== undefined) {
			missingStrokeCount += 1;
			strokeResults.push({
				status: 'missing',
				targetStrokeIndex: step.targetStrokeIndex,
				score: step.cost
			});
		} else if (step.op === 'extra' && step.userStrokeIndex !== undefined) {
			extraStrokeCount += 1;
			strokeResults.push({
				status: 'extra',
				userStrokeIndex: step.userStrokeIndex,
				score: step.cost
			});
		}
	}

	const status =
		missingStrokeCount === 0 &&
		extraStrokeCount === 0 &&
		wrongDirectionCount === 0 &&
		wrongOrderCount === 0 &&
		badShapeCount === 0
			? 'ok'
			: 'bad';

	return {
		targetChar: targetCharacter.char,
		userCharacterIndex,
		status,
		targetStrokeCount: targetCharacter.strokes.length,
		userStrokeCount: userCharacter.strokes.length,
		strokeResults,
		alignment,
		totalScore: totalAlignmentCost,
		matchedStrokeCount,
		missingStrokeCount,
		extraStrokeCount,
		wrongDirectionCount,
		wrongOrderCount,
		badShapeCount
	};
}
