import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { preprocessHanziData, RESAMPLED_POINTS } from '$lib/hanzi/preprocessHanziData';
import type { RawHanziWriterData, TargetCharacter } from '$lib/hanzi/types';

const cache = new Map<string, TargetCharacter>();

async function loadRawHanziData(char: string): Promise<RawHanziWriterData | null> {
	const path = join(resolve('node_modules/hanzi-writer-data'), `${char}.json`);

	try {
		const contents = await readFile(path, 'utf8');
		return JSON.parse(contents) as RawHanziWriterData;
	} catch {
		return null;
	}
}

export async function loadTargetCharacter(char: string): Promise<TargetCharacter | undefined> {
	const cached = cache.get(char);
	if (cached) {
		return cached;
	}

	const raw = await loadRawHanziData(char);
	if (!raw) {
		return undefined;
	}

	const targetCharacter = preprocessHanziData(char, raw, RESAMPLED_POINTS);
	cache.set(char, targetCharacter);
	return targetCharacter;
}

export async function loadTargetCharacters(
	chars: string[]
): Promise<Record<string, TargetCharacter>> {
	const uniqueChars = [...new Set(chars)].filter((char) => char.length > 0).sort();
	const entries = await Promise.all(
		uniqueChars.map(async (char) => {
			const targetCharacter = await loadTargetCharacter(char);
			return targetCharacter ? ([char, targetCharacter] as const) : null;
		})
	);

	return Object.fromEntries(entries.filter((entry) => entry !== null));
}
