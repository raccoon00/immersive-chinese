import type { Point } from '$lib/drawing/types';

const HANZI_COORDINATE_SIZE = 1024;
const HANZI_TOP_Y = 900;

export function normalizeTargetPoint([x, y]: [number, number]): Point {
	return {
		x: x / HANZI_COORDINATE_SIZE,
		y: (HANZI_TOP_Y - y) / HANZI_COORDINATE_SIZE
	};
}
