import type { WordCard } from '$lib/practice/types';

function hashSeed(seed: string): number {
	let h = 1779033703 ^ seed.length;

	for (let i = 0; i < seed.length; i++) {
		h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
		h = (h << 13) | (h >>> 19);
	}

	h = Math.imul(h ^ (h >>> 16), 2246822507);
	h = Math.imul(h ^ (h >>> 13), 3266489909);

	return (h ^ (h >>> 16)) >>> 0;
}

function mulberry32(seed: number): () => number {
	return () => {
		let t = (seed += 0x6d2b79f5);
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export function createQueueSeed(): string {
	if (globalThis.crypto?.randomUUID) {
		return globalThis.crypto.randomUUID();
	}

	return `seed_${Math.random().toString(36).slice(2, 10)}`;
}

export function createQueue(cards: WordCard[], seed: string): WordCard[] {
	const queue = [...cards];
	const random = mulberry32(hashSeed(seed));

	for (let i = queue.length - 1; i > 0; i -= 1) {
		const j = Math.floor(random() * (i + 1));
		[queue[i], queue[j]] = [queue[j], queue[i]];
	}

	return queue;
}
