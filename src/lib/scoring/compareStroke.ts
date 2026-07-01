import {
	distance,
	pointToPolylineDistance,
	polylineLength,
	resampleByArcLength,
	segmentMidpoint
} from '$lib/drawing/geometry';
import type { Polyline } from '$lib/drawing/types';
import type { TargetStroke } from '$lib/hanzi/types';
import type { UserStroke } from '$lib/practice/types';
import type { StrokeComparison, StrokeValidationResult } from '$lib/validation/types';
import { thresholds, type Thresholds } from '$lib/scoring/thresholds';

function orderedMeanDistance(a: Polyline, b: Polyline): number {
	if (a.length === 0 || b.length === 0) {
		return Number.POSITIVE_INFINITY;
	}

	const count = Math.min(a.length, b.length);
	let total = 0;

	for (let i = 0; i < count; i += 1) {
		total += distance(a[i], b[i]);
	}

	return total / count;
}

function getPreparedUserPoints(userStroke: UserStroke, count: number): Polyline {
	const source = userStroke.processed ?? userStroke.points;
	if (source.length === count) {
		return source;
	}

	return resampleByArcLength(source, count);
}

function getMissedSegments(target: Polyline, user: Polyline, maxDistance: number) {
	const missedSegments: StrokeComparison['missedSegments'] = [];

	for (let i = 1; i < target.length; i += 1) {
		const from = target[i - 1];
		const to = target[i];
		const midpoint = segmentMidpoint(from, to);
		const nearestDistance = pointToPolylineDistance(midpoint, user);

		if (nearestDistance > maxDistance) {
			missedSegments.push({ from, to, distance: nearestDistance });
		}
	}

	return missedSegments;
}

export function compareStroke(
	targetStroke: TargetStroke,
	userStroke: UserStroke,
	customThresholds: Thresholds = thresholds
): StrokeComparison {
	const target = targetStroke.resampled;
	const user = getPreparedUserPoints(userStroke, target.length || customThresholds.resampledPoints);
	const reversedUser = [...user].reverse();

	const forwardShapeDistance = orderedMeanDistance(target, user);
	const reversedShapeDistance = orderedMeanDistance(target, reversedUser);
	const isReversed = reversedShapeDistance < forwardShapeDistance;
	const alignedUser = isReversed ? reversedUser : user;
	const shapeDistance = Math.min(forwardShapeDistance, reversedShapeDistance);
	const endpointDistance =
		distance(target[0], alignedUser[0]) +
		distance(target[target.length - 1], alignedUser[alignedUser.length - 1]);
	const directionPenalty = isReversed ? customThresholds.reversedStrokePenalty : 0;
	const targetLength = Math.max(1e-9, polylineLength(target));
	const userLength = polylineLength(user);
	const lengthPenalty = Math.abs(userLength / targetLength - 1);
	const missedSegments = getMissedSegments(
		targetStroke.median,
		user,
		customThresholds.missedSegmentDistance
	);
	const score =
		customThresholds.shapeWeight * shapeDistance +
		customThresholds.endpointWeight * endpointDistance +
		customThresholds.directionWeight * directionPenalty +
		customThresholds.lengthWeight * lengthPenalty;

	return {
		score,
		shapeDistance,
		endpointDistance,
		directionPenalty,
		lengthPenalty,
		missedSegments,
		targetStart: target[0],
		targetEnd: target[target.length - 1],
		userStart: user[0],
		userEnd: user[user.length - 1]
	};
}

export function classifyStroke(
	comparison: StrokeComparison,
	customThresholds: Thresholds = thresholds
): StrokeValidationResult['status'] {
	if (comparison.directionPenalty > 0) {
		return 'wrong_direction';
	}

	if (comparison.score > customThresholds.maxStrokeScore) {
		return 'bad_shape';
	}

	return 'matched';
}
