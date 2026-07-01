import { hanziStrokeData } from '$lib/data/generated/hanziStrokeData';
import type { HanziStrokeDataMap } from '$lib/hanzi/context';
import type { TargetCharacter } from '$lib/hanzi/types';

export function getTargetCharacter(
	char: string,
	data: HanziStrokeDataMap = hanziStrokeData
): TargetCharacter | undefined {
	return data[char];
}

export function getMissingStrokeDataChars(
	chars: string[],
	data: HanziStrokeDataMap = hanziStrokeData
): string[] {
	return chars.filter((char) => !(char in data));
}
