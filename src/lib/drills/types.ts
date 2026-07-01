import type { WordCard } from '$lib/practice/types';

export type StoredDrillStatus = 'draft' | 'ready';

export type StoredDrill = {
	id: string;
	createdAt: string;
	updatedAt: string;
	status: StoredDrillStatus;
	cards: WordCard[];
};

export type DrillRowInput = {
	hanzi: string;
	translation: string;
};
