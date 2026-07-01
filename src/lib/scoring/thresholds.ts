export const thresholds = {
	maxStrokeScore: 0.12,
	missingStrokePenalty: 0.35,
	extraStrokePenalty: 0.25,
	reversedStrokePenalty: 0.18,
	missedSegmentDistance: 0.08,
	shapeWeight: 0.45,
	endpointWeight: 0.25,
	directionWeight: 0.2,
	lengthWeight: 0.1,
	resampledPoints: 64
};

export type Thresholds = typeof thresholds;
