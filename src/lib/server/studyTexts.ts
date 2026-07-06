import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { buildStudyTextStructure, parseStudyText } from '$lib/study-text/parseStudyText';
import { mapWholeTranslationToStudyText } from '$lib/study-text/parseTranslation';
import { autoSegmentSentence, manualSegmentSentence } from '$lib/study-text/segmentSentence';
import type {
	RawStudyTextInput,
	StudyText,
	StudyTextSummary,
	StudyToken,
	TranslationMappingResult
} from '$lib/study-text/types';
import { lookupCharacterFallbackPinyin, lookupDictionaryMatches } from '$lib/server/lexicon';

const studyTextsDir = resolve('data/study-texts');
const studyTextIdPattern = /^[a-z0-9_-]{6,120}$/i;

type SaveStudyTextUpdates = Partial<
	Pick<
		StudyText,
		'title' | 'rawText' | 'wholeTranslation' | 'selectedSentenceIds' | 'relatedDrillId' | 'status'
	>
> & {
	sentenceTranslations?: Record<string, string>;
	sentenceSegmentations?: Record<string, string>;
	tokenSelections?: Record<string, string>;
};

function getStudyTextPath(studyTextId: string): string {
	return resolve(studyTextsDir, `${studyTextId}.json`);
}

function nowIso(): string {
	return new Date().toISOString();
}

async function ensureStudyTextsDir(): Promise<void> {
	await mkdir(dirname(getStudyTextPath('placeholder')), { recursive: true });
}

export function isValidStudyTextId(studyTextId: string): boolean {
	return studyTextIdPattern.test(studyTextId);
}

export function createStudyTextId(): string {
	if (globalThis.crypto?.randomUUID) {
		return `study_${globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
	}

	return `study_${Math.random().toString(36).slice(2, 18)}`;
}

function selectAllSentences(studyText: StudyText): StudyText {
	const selectedSentenceIds = studyText.sentences.map((sentence) => sentence.id);

	return {
		...studyText,
		selectedSentenceIds,
		sentences: studyText.sentences.map((sentence) => ({
			...sentence,
			selected: true
		}))
	};
}

function summarizeStudyText(studyText: StudyText): StudyTextSummary {
	const normalizedStudyText = selectAllSentences(studyText);

	return {
		id: normalizedStudyText.id,
		title: normalizedStudyText.title,
		status: normalizedStudyText.status,
		relatedDrillId: normalizedStudyText.relatedDrillId,
		createdAt: normalizedStudyText.createdAt,
		updatedAt: normalizedStudyText.updatedAt,
		sentenceCount: normalizedStudyText.sentences.length,
		selectedSentenceCount: normalizedStudyText.selectedSentenceIds.length
	};
}

function createStoredStudyText(studyTextId: string, input: RawStudyTextInput): StudyText {
	const parsed = parseStudyText(input.rawText, input.title);
	const structure = buildStudyTextStructure(parsed, studyTextId);
	const timestamp = nowIso();

	return {
		id: studyTextId,
		...structure,
		status: structure.sentences.length > 0 ? 'in_progress' : 'draft',
		createdAt: timestamp,
		updatedAt: timestamp
	};
}

async function enrichToken(token: StudyToken): Promise<StudyToken> {
	if (token.kind !== 'word') {
		return {
			...token,
			dictionaryMatches: [],
			pinyin: undefined,
			tags: []
		};
	}

	const dictionaryMatches = await lookupDictionaryMatches(token.text);
	const selectedDictionaryMatch = token.selectedDictionaryEntryId
		? dictionaryMatches.find((match) => match.entryId === token.selectedDictionaryEntryId)
		: undefined;
	const fallbackPinyin =
		dictionaryMatches.length === 0 ? await lookupCharacterFallbackPinyin(token.text) : undefined;

	return {
		...token,
		dictionaryMatches,
		pinyin:
			selectedDictionaryMatch?.pinyin?.trim() ||
			dictionaryMatches[0]?.pinyin?.trim() ||
			token.pinyin ||
			fallbackPinyin,
		selectedTranslation:
			token.selectedTranslation ?? selectedDictionaryMatch?.definitions.join('; '),
		tags: [...new Set(dictionaryMatches.flatMap((match) => match.tags ?? []))]
	};
}

async function enrichSentenceSegmentation(studyText: StudyText): Promise<StudyText> {
	const sentences = await Promise.all(
		studyText.sentences.map(async (sentence) => {
			const baseTokens =
				sentence.segmentation.source === 'auto' || sentence.segmentation.tokens.length === 0
					? autoSegmentSentence(sentence.id, sentence.text).tokens
					: sentence.segmentation.tokens;
			const tokens = await Promise.all(baseTokens.map((token) => enrichToken(token)));

			return {
				...sentence,
				segmentation: {
					...sentence.segmentation,
					sentenceId: sentence.id,
					tokens,
					updatedAt:
						sentence.segmentation.source === 'auto' || sentence.segmentation.tokens.length === 0
							? nowIso()
							: sentence.segmentation.updatedAt
				}
			};
		})
	);

	return {
		...studyText,
		sentences
	};
}

function applySentenceSegmentations(
	studyText: StudyText,
	sentenceSegmentations: Record<string, string> | undefined
): StudyText {
	if (!sentenceSegmentations) {
		return studyText;
	}

	return {
		...studyText,
		sentences: studyText.sentences.map((sentence) => ({
			...sentence,
			segmentation:
				typeof sentenceSegmentations[sentence.id] === 'string'
					? manualSegmentSentence(sentence.id, sentence.text, sentenceSegmentations[sentence.id])
					: sentence.segmentation
		}))
	};
}

function applyTokenSelections(
	studyText: StudyText,
	tokenSelections: Record<string, string> | undefined
): StudyText {
	if (!tokenSelections) {
		return studyText;
	}

	return {
		...studyText,
		sentences: studyText.sentences.map((sentence) => ({
			...sentence,
			segmentation: {
				...sentence.segmentation,
				tokens: sentence.segmentation.tokens.map((token) => {
					const selectedDictionaryEntryId = tokenSelections[token.id];
					const selectedDictionaryMatch = selectedDictionaryEntryId
						? token.dictionaryMatches.find((match) => match.entryId === selectedDictionaryEntryId)
						: undefined;

					return typeof selectedDictionaryEntryId === 'string'
						? {
								...token,
								selectedDictionaryEntryId,
								selectedTranslation: selectedDictionaryMatch?.definitions.join('; ')
							}
						: token;
				})
			}
		}))
	};
}

function applySentenceTranslations(
	studyText: StudyText,
	sentenceTranslations: Record<string, string> | undefined
): StudyText {
	if (!sentenceTranslations) {
		return studyText;
	}

	return {
		...studyText,
		sentences: studyText.sentences.map((sentence) => ({
			...sentence,
			translation:
				typeof sentenceTranslations[sentence.id] === 'string'
					? sentenceTranslations[sentence.id].trim() || undefined
					: sentence.translation
		}))
	};
}

function clearSentenceTranslations(studyText: StudyText): StudyText {
	return {
		...studyText,
		sentences: studyText.sentences.map((sentence) => ({
			...sentence,
			translation: undefined
		}))
	};
}

function applyWholeTranslationMapping(
	studyText: StudyText,
	wholeTranslation: string,
	sourceSentenceIds?: string[]
): { studyText: StudyText; mapping: TranslationMappingResult } {
	const mapping = mapWholeTranslationToStudyText(studyText, wholeTranslation, sourceSentenceIds);
	const translationsBySentenceId = Object.fromEntries(
		mapping.pairs.map((pair) => [pair.sourceSentenceId, pair.translation])
	);

	return {
		studyText: {
			...studyText,
			wholeTranslation,
			sentences: studyText.sentences.map((sentence) => ({
				...sentence,
				translation:
					typeof translationsBySentenceId[sentence.id] === 'string'
						? translationsBySentenceId[sentence.id] || undefined
						: sentence.translation
			}))
		},
		mapping
	};
}

async function readStoredStudyText(studyTextId: string): Promise<StudyText | null> {
	if (!isValidStudyTextId(studyTextId)) {
		return null;
	}

	try {
		const contents = await readFile(getStudyTextPath(studyTextId), 'utf8');
		return selectAllSentences(JSON.parse(contents) as StudyText);
	} catch {
		return null;
	}
}

export async function listStudyTexts(): Promise<StudyTextSummary[]> {
	await ensureStudyTextsDir();
	const fileNames = await readdir(studyTextsDir).catch(() => []);
	const studies = await Promise.all(
		fileNames
			.filter((fileName) => fileName.endsWith('.json'))
			.map(async (fileName) => {
				const studyTextId = fileName.replace(/\.json$/, '');
				return readStoredStudyText(studyTextId);
			})
	);

	return studies
		.filter((studyText): studyText is StudyText => studyText !== null)
		.map(summarizeStudyText)
		.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function readStudyText(studyTextId: string): Promise<StudyText | null> {
	const stored = await readStoredStudyText(studyTextId);
	if (!stored) {
		return null;
	}

	return enrichSentenceSegmentation(stored);
}

export async function createStudyTextFromRawText(input: RawStudyTextInput): Promise<StudyText> {
	const studyText = createStoredStudyText(createStudyTextId(), input);
	await ensureStudyTextsDir();
	await writeFile(getStudyTextPath(studyText.id), JSON.stringify(studyText, null, 2), 'utf8');
	return studyText;
}

export async function saveStudyText(
	studyTextId: string,
	updates: SaveStudyTextUpdates
): Promise<StudyText> {
	if (!isValidStudyTextId(studyTextId)) {
		throw new Error('Invalid study text id.');
	}

	const existing = await readStudyText(studyTextId);
	if (!existing) {
		throw new Error('Study text not found.');
	}

	const rawTextChanged = updates.rawText !== undefined && updates.rawText !== existing.rawText;
	let nextStudyText: StudyText;

	if (rawTextChanged) {
		nextStudyText = createStoredStudyText(studyTextId, {
			rawText: updates.rawText ?? existing.rawText,
			title: updates.title ?? existing.title,
			createdFrom: 'manual'
		});
		nextStudyText.createdAt = existing.createdAt;
		nextStudyText.relatedDrillId = updates.relatedDrillId ?? existing.relatedDrillId;
		nextStudyText.status = updates.status ?? existing.status;
	} else {
		nextStudyText = selectAllSentences({
			...existing,
			title: updates.title?.trim() || existing.title,
			relatedDrillId: updates.relatedDrillId ?? existing.relatedDrillId,
			status: updates.status ?? existing.status
		});
	}

	const nextWholeTranslation = updates.wholeTranslation ?? existing.wholeTranslation;
	if (typeof nextWholeTranslation === 'string') {
		if (nextWholeTranslation.trim().length > 0) {
			nextStudyText = applyWholeTranslationMapping(nextStudyText, nextWholeTranslation).studyText;
		} else {
			nextStudyText = clearSentenceTranslations({
				...nextStudyText,
				wholeTranslation: undefined
			});
		}
	}

	nextStudyText = applySentenceSegmentations(nextStudyText, updates.sentenceSegmentations);
	nextStudyText = applyTokenSelections(nextStudyText, updates.tokenSelections);
	nextStudyText = applySentenceTranslations(nextStudyText, updates.sentenceTranslations);

	if (nextStudyText.title.trim().length === 0) {
		nextStudyText.title = existing.title;
	}

	nextStudyText.updatedAt = nowIso();
	await ensureStudyTextsDir();
	await writeFile(getStudyTextPath(studyTextId), JSON.stringify(nextStudyText, null, 2), 'utf8');
	return enrichSentenceSegmentation(nextStudyText);
}

export async function mapWholeTranslationForStudyText(
	studyTextId: string,
	wholeTranslation: string,
	sourceSentenceIds?: string[]
): Promise<{ studyText: StudyText; mapping: TranslationMappingResult }> {
	const existing = await readStudyText(studyTextId);
	if (!existing) {
		throw new Error('Study text not found.');
	}

	const applied = applyWholeTranslationMapping(existing, wholeTranslation, sourceSentenceIds);
	applied.studyText.updatedAt = nowIso();
	await ensureStudyTextsDir();
	await writeFile(
		getStudyTextPath(studyTextId),
		JSON.stringify(applied.studyText, null, 2),
		'utf8'
	);
	return {
		studyText: await enrichSentenceSegmentation(applied.studyText),
		mapping: applied.mapping
	};
}

export async function deleteStudyText(studyTextId: string): Promise<void> {
	if (!isValidStudyTextId(studyTextId)) {
		throw new Error('Invalid study text id.');
	}

	await rm(getStudyTextPath(studyTextId), { force: true });
}
