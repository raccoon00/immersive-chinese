import type { Polyline } from '$lib/drawing/types';

export type RawHanziWriterData = {
	strokes: string[];
	medians: number[][][];
	radStrokes?: number[];
};

export type TargetStroke = {
	index: number;
	svgPath: string;
	medianRaw: number[][];
	median: Polyline;
	resampled: Polyline;
};

export type TargetCharacter = {
	char: string;
	strokes: TargetStroke[];
};
