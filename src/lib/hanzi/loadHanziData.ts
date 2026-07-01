import { hanziStrokeData } from '$lib/data/generated/hanziStrokeData';
import type { TargetCharacter } from '$lib/hanzi/types';

export function getTargetCharacter(char: string): TargetCharacter | undefined {
	return hanziStrokeData[char];
}

export function getMissingStrokeDataChars(chars: string[]): string[] {
	return chars.filter((char) => !(char in hanziStrokeData));
}
