import type { Point } from '$lib/drawing/types';

export type ValidationStage = 'count_only' | 'full';
export type WordCountStatus = 'same_count' | 'missing_characters' | 'extra_characters';
export type StrokeMatchStatus =
	'matched' | 'bad_shape' | 'wrong_direction' | 'wrong_order' | 'missing' | 'extra';

export type MissedSegment = {
	from: Point;
	to: Point;
	distance: number;
};

export type StrokeComparison = {
	score: number;
	shapeDistance: number;
	endpointDistance: number;
	directionPenalty: number;
	lengthPenalty: number;
	missedSegments: MissedSegment[];
	targetStart: Point;
	targetEnd: Point;
	userStart: Point;
	userEnd: Point;
};

export type StrokeValidationResult = {
	status: StrokeMatchStatus;
	targetStrokeIndex?: number;
	userStrokeIndex?: number;
	wrongOrderTargetStrokeIndex?: number;
	score?: number;
	shapeDistance?: number;
	endpointDistance?: number;
	directionPenalty?: number;
	lengthPenalty?: number;
	missedSegments?: MissedSegment[];
};

export type StrokeAlignmentStep = {
	op: 'match' | 'missing' | 'extra';
	targetStrokeIndex?: number;
	userStrokeIndex?: number;
	cost: number;
};

export type CharacterValidationResult = {
	targetChar: string;
	userCharacterIndex: number;
	status: 'ok' | 'bad' | 'missing' | 'extra';
	targetStrokeCount: number;
	userStrokeCount: number;
	strokeResults: StrokeValidationResult[];
	alignment: StrokeAlignmentStep[];
	totalScore: number;
	matchedStrokeCount: number;
	missingStrokeCount: number;
	extraStrokeCount: number;
	wrongDirectionCount: number;
	wrongOrderCount: number;
	badShapeCount: number;
};

export type WordValidationResult = {
	validationStage: ValidationStage;
	status: 'ok' | 'missing_characters' | 'extra_characters' | 'bad_characters';
	countStatus: WordCountStatus;
	targetHanzi: string;
	userCharacterCount: number;
	targetCharacterCount: number;
	characterStrokeCounts: number[];
	characterResults: CharacterValidationResult[];
	message?: string;
};
