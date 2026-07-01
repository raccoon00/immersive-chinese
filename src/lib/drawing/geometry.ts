import type { BoundingBox, Point, Polyline } from '$lib/drawing/types';

export function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
	return Math.hypot(a.x - b.x, a.y - b.y);
}

export function polylineLength(points: Polyline): number {
	let total = 0;

	for (let i = 1; i < points.length; i += 1) {
		total += distance(points[i - 1], points[i]);
	}

	return total;
}

export function interpolatePoint(a: Point, b: Point, t: number): Point {
	return {
		x: a.x + (b.x - a.x) * t,
		y: a.y + (b.y - a.y) * t,
		t: a.t !== undefined && b.t !== undefined ? a.t + (b.t - a.t) * t : undefined,
		pressure:
			a.pressure !== undefined && b.pressure !== undefined
				? a.pressure + (b.pressure - a.pressure) * t
				: undefined
	};
}

export function segmentMidpoint(a: Point, b: Point): Point {
	return interpolatePoint(a, b, 0.5);
}

export function pointToSegmentDistance(point: Point, a: Point, b: Point): number {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const lengthSquared = dx * dx + dy * dy;

	if (lengthSquared === 0) {
		return distance(point, a);
	}

	const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared));
	const projection = {
		x: a.x + dx * t,
		y: a.y + dy * t
	};

	return distance(point, projection);
}

export function pointToPolylineDistance(point: Point, polyline: Polyline): number {
	if (polyline.length === 0) {
		return Number.POSITIVE_INFINITY;
	}

	if (polyline.length === 1) {
		return distance(point, polyline[0]);
	}

	let minDistance = Number.POSITIVE_INFINITY;

	for (let i = 1; i < polyline.length; i += 1) {
		minDistance = Math.min(
			minDistance,
			pointToSegmentDistance(point, polyline[i - 1], polyline[i])
		);
	}

	return minDistance;
}

export function resampleByArcLength(points: Polyline, count: number): Polyline {
	if (points.length === 0 || count <= 0) {
		return [];
	}

	if (points.length === 1 || count === 1) {
		return Array.from({ length: Math.max(1, count) }, () => ({ ...points[0] }));
	}

	const totalLength = polylineLength(points);
	if (totalLength === 0) {
		return Array.from({ length: count }, () => ({ ...points[0] }));
	}

	const result: Polyline = [{ ...points[0] }];
	const step = totalLength / (count - 1);
	let segmentStartIndex = 0;
	let traversed = 0;

	for (let sampleIndex = 1; sampleIndex < count - 1; sampleIndex += 1) {
		const targetDistance = step * sampleIndex;

		while (segmentStartIndex < points.length - 2) {
			const segmentLength = distance(points[segmentStartIndex], points[segmentStartIndex + 1]);

			if (traversed + segmentLength >= targetDistance) {
				break;
			}

			traversed += segmentLength;
			segmentStartIndex += 1;
		}

		const start = points[segmentStartIndex];
		const end = points[segmentStartIndex + 1];
		const segmentLength = distance(start, end);

		if (segmentLength === 0) {
			result.push({ ...start });
			continue;
		}

		const localT = (targetDistance - traversed) / segmentLength;
		result.push(interpolatePoint(start, end, localT));
	}

	result.push({ ...points[points.length - 1] });
	return result;
}

export function getBoundingBox(points: Polyline): BoundingBox | null {
	if (points.length === 0) {
		return null;
	}

	let minX = points[0].x;
	let minY = points[0].y;
	let maxX = points[0].x;
	let maxY = points[0].y;

	for (const point of points) {
		minX = Math.min(minX, point.x);
		minY = Math.min(minY, point.y);
		maxX = Math.max(maxX, point.x);
		maxY = Math.max(maxY, point.y);
	}

	return { minX, minY, maxX, maxY };
}
