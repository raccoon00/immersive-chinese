import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { DictionaryMatch } from '$lib/study-text/types';

type CompleteJsonEntry = {
	simplified?: string;
	level?: string[];
	frequency?: number;
	pos?: string[];
	forms?: Array<{
		traditional?: string;
		transcriptions?: {
			pinyin?: string;
			numeric?: string;
		};
		meanings?: string[];
		classifiers?: string[];
	}>;
};

type LexiconIndex = {
	byText: Map<string, DictionaryMatch[]>;
};

let lexiconCache: Promise<LexiconIndex> | null = null;

function lexiconCandidates(fileName: 'complete.json' | 'cedict_ts.u8'): string[] {
	const envPath =
		fileName === 'complete.json' ? process.env.HSK_COMPLETE_PATH : process.env.CEDICT_PATH;

	return [envPath, resolve('data/lexicon', fileName), resolve('tmp', fileName)].filter(
		(value): value is string => typeof value === 'string' && value.length > 0
	);
}

async function readFirstAvailable(paths: string[]): Promise<string | null> {
	for (const path of paths) {
		try {
			return await readFile(path, 'utf8');
		} catch {
			continue;
		}
	}

	return null;
}

function addMatch(
	index: Map<string, DictionaryMatch[]>,
	key: string,
	match: DictionaryMatch
): void {
	if (!key.trim()) {
		return;
	}

	const existing = index.get(key) ?? [];
	if (!existing.some((entry) => entry.entryId === match.entryId)) {
		existing.push(match);
		index.set(key, existing);
	}
}

function parseCompleteJson(contents: string, index: Map<string, DictionaryMatch[]>): void {
	const entries = JSON.parse(contents) as CompleteJsonEntry[];

	for (const entry of entries) {
		const simplified = entry.simplified?.trim();
		if (!simplified || !Array.isArray(entry.forms)) {
			continue;
		}

		for (const [formIndex, form] of entry.forms.entries()) {
			const traditional = form.traditional?.trim() || simplified;
			const pinyin =
				form.transcriptions?.pinyin?.trim() || form.transcriptions?.numeric?.trim() || '';
			const definitions = (form.meanings ?? []).map((meaning) => meaning.trim()).filter(Boolean);
			const classifiers = (form.classifiers ?? [])
				.map((classifier) => classifier.trim())
				.filter(Boolean);
			const levels = (entry.level ?? []).map((level) => level.trim()).filter(Boolean);
			const partsOfSpeech = (entry.pos ?? []).map((pos) => pos.trim()).filter(Boolean);
			const match: DictionaryMatch = {
				entryId: `complete:${simplified}:${traditional}:${formIndex}`,
				simplified,
				traditional,
				pinyin,
				definitions,
				source: 'complete',
				tags: levels,
				partsOfSpeech,
				classifiers,
				frequency: typeof entry.frequency === 'number' ? entry.frequency : undefined
			};

			addMatch(index, simplified, match);
			addMatch(index, traditional, match);
		}
	}
}

function parseCedict(contents: string, index: Map<string, DictionaryMatch[]>): void {
	for (const [sourcePosition, line] of contents.split(/\r?\n/).entries()) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) {
			continue;
		}

		const match = trimmed.match(/^(\S+)\s+(\S+)\s+\[(.+?)\]\s+\/(.+)\/$/u);
		if (!match) {
			continue;
		}

		const traditional = match[1];
		const simplified = match[2];
		const pinyin = match[3].trim();
		const definitions = match[4]
			.split('/')
			.map((definition) => definition.trim())
			.filter(Boolean);
		const dictionaryMatch: DictionaryMatch = {
			entryId: `cedict:${traditional}:${simplified}:${pinyin}`,
			simplified,
			traditional,
			pinyin,
			definitions,
			source: 'cc-cedict',
			sourcePosition
		};

		addMatch(index, simplified, dictionaryMatch);
		addMatch(index, traditional, dictionaryMatch);
	}
}

async function loadLexiconIndex(): Promise<LexiconIndex> {
	const byText = new Map<string, DictionaryMatch[]>();
	const [completeContents, cedictContents] = await Promise.all([
		readFirstAvailable(lexiconCandidates('complete.json')),
		readFirstAvailable(lexiconCandidates('cedict_ts.u8'))
	]);

	if (completeContents) {
		parseCompleteJson(completeContents, byText);
	}

	if (cedictContents) {
		parseCedict(cedictContents, byText);
	}

	for (const [key, matches] of byText.entries()) {
		byText.set(
			key,
			[...matches].sort((a, b) => {
				if (a.source !== b.source) {
					return a.source === 'complete' ? -1 : 1;
				}

				if (typeof a.frequency === 'number' && typeof b.frequency === 'number') {
					return a.frequency - b.frequency;
				}

				if (typeof a.frequency === 'number') {
					return -1;
				}

				if (typeof b.frequency === 'number') {
					return 1;
				}

				if (a.source === 'cc-cedict') {
					return (
						(a.sourcePosition ?? Number.MAX_SAFE_INTEGER) -
						(b.sourcePosition ?? Number.MAX_SAFE_INTEGER)
					);
				}

				return a.entryId.localeCompare(b.entryId);
			})
		);
	}

	return { byText };
}

async function getLexiconIndex(): Promise<LexiconIndex> {
	lexiconCache ??= loadLexiconIndex();
	return lexiconCache;
}

export async function lookupDictionaryMatches(text: string): Promise<DictionaryMatch[]> {
	const normalized = text.trim();
	if (!normalized) {
		return [];
	}

	const index = await getLexiconIndex();
	return [...(index.byText.get(normalized) ?? [])];
}

export async function lookupCharacterFallbackPinyin(text: string): Promise<string | undefined> {
	const normalized = text.trim();
	if (!normalized) {
		return undefined;
	}

	const parts = await Promise.all(
		[...normalized].map(async (character) => {
			if (/^[\p{P}\p{S}\s]+$/u.test(character)) {
				return '';
			}

			const matches = await lookupDictionaryMatches(character);
			if (matches.length === 0) {
				return '';
			}

			const cedictMatch = matches
				.filter((match) => match.source === 'cc-cedict')
				.sort(
					(a, b) =>
						(a.sourcePosition ?? Number.MAX_SAFE_INTEGER) -
						(b.sourcePosition ?? Number.MAX_SAFE_INTEGER)
				)[0];
			const preferredMatch = cedictMatch ?? matches[0];
			return preferredMatch?.pinyin?.trim() ?? '';
		})
	);

	const filteredParts = parts.filter((part) => part.length > 0);
	return filteredParts.length > 0 ? filteredParts.join(' ') : undefined;
}
