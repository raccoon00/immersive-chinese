import { getContext, hasContext, setContext } from 'svelte';
import type { TargetCharacter } from '$lib/hanzi/types';

const hanziStrokeDataContextKey = Symbol('hanzi-stroke-data');

export type HanziStrokeDataMap = Record<string, TargetCharacter>;

type HanziStrokeDataContextValue = {
	getData: () => HanziStrokeDataMap;
};

export function setHanziStrokeDataContext(getData: () => HanziStrokeDataMap): void {
	setContext<HanziStrokeDataContextValue>(hanziStrokeDataContextKey, { getData });
}

export function getHanziStrokeDataContext(): HanziStrokeDataMap {
	if (!hasContext(hanziStrokeDataContextKey)) {
		return {};
	}

	return getContext<HanziStrokeDataContextValue>(hanziStrokeDataContextKey).getData();
}
