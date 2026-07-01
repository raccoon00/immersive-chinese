import { distance, resampleByArcLength } from '$lib/drawing/geometry';
import type { Point, Polyline } from '$lib/drawing/types';

const DEFAULT_RESAMPLED_POINTS = 64;

export function removeTinyMoves(points: Polyline, minDistance = 0.003): Polyline {
	if (points.length <= 1) {
		return [...points];
	}

	const filtered = [points[0]];

	for (let i = 1; i < points.length; i += 1) {
		const point = points[i];
		const previous = filtered[filtered.length - 1];

		if (distance(point, previous) >= minDistance) {
			filtered.push(point);
		}
	}

	const lastPoint = points[points.length - 1];
	const lastFilteredPoint = filtered[filtered.length - 1];

	if (lastPoint && lastFilteredPoint !== lastPoint) {
		filtered.push(lastPoint);
	}

	return filtered;
}

export function smoothMovingAverage(points: Polyline, windowSize = 3): Polyline {
	if (points.length <= 2 || windowSize <= 1) {
		return [...points];
	}

	const radius = Math.floor(windowSize / 2);

	return points.map((point, index) => {
		if (index === 0 || index === points.length - 1) {
			return { ...point };
		}

		let totalX = 0;
		let totalY = 0;
		let count = 0;

		for (let offset = -radius; offset <= radius; offset += 1) {
			const sample = points[index + offset];
			if (!sample) {
				continue;
			}

			totalX += sample.x;
			totalY += sample.y;
			count += 1;
		}

		const smoothed: Point = {
			x: count === 0 ? point.x : totalX / count,
			y: count === 0 ? point.y : totalY / count,
			t: point.t,
			pressure: point.pressure
		};

		return smoothed;
	});
}

export function processStroke(points: Polyline): Polyline {
	const filtered = removeTinyMoves(points);
	if (filtered.length <= 2) {
		return filtered;
	}

	const smoothed = smoothMovingAverage(filtered, 3);
	return resampleByArcLength(smoothed, DEFAULT_RESAMPLED_POINTS);
}
