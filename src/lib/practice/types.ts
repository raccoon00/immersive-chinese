import type { Polyline } from '$lib/drawing/types';

export type WordCard = {
	id: string;
	hanzi: string;
	translation: string;
	tags?: string[];
};

export type UserStroke = {
	points: Polyline;
	processed?: Polyline;
};

export type UserCharacterAttempt = {
	id: string;
	strokes: UserStroke[];
};

export type WordAttempt = {
	cardId: string;
	characters: UserCharacterAttempt[];
};
