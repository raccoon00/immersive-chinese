export type Point = {
	x: number;
	y: number;
	t?: number;
	pressure?: number;
};

export type Polyline = Point[];

export type BoundingBox = {
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
};
