import type { StudyText, TranslationMappingResult } from '$lib/study-text/types';

function normalizeText(text: string): string {
	return text.replace(/\r\n?/g, '\n').trim();
}

function splitByParagraphs(text: string): string[] {
	return normalizeText(text)
		.split(/\n\s*\n+/)
		.map((paragraph) => paragraph.trim())
		.filter((paragraph) => paragraph.length > 0);
}

function segmentParagraphIntoSentences(
	paragraph: string,
	locale: string
): Array<{ text: string; start: number; end: number }> {
	const SegmenterCtor = globalThis.Intl?.Segmenter;
	if (SegmenterCtor) {
		const segmenter = new SegmenterCtor(locale, { granularity: 'sentence' });
		const segments = Array.from(segmenter.segment(paragraph))
			.map((segment) => ({
				text: segment.segment.trim(),
				start: segment.index,
				end: segment.index + segment.segment.length
			}))
			.filter((segment) => segment.text.length > 0);

		if (segments.length > 0) {
			return segments;
		}
	}

	const regex = /.+?(?:[。！？!?]+[”」』）】》]*|[.!?]+["')\]}]*|$)/gu;
	const results: Array<{ text: string; start: number; end: number }> = [];

	for (const match of paragraph.matchAll(regex)) {
		const raw = match[0] ?? '';
		const trimmed = raw.trim();
		if (trimmed.length === 0) {
			continue;
		}

		const startPadding = raw.indexOf(trimmed);
		const start = (match.index ?? 0) + Math.max(0, startPadding);
		results.push({
			text: trimmed,
			start,
			end: start + trimmed.length
		});
	}

	return results;
}

export function splitTranslationIntoSentences(text: string, locale = 'en'): string[] {
	const paragraphs = splitByParagraphs(text);
	return paragraphs.flatMap((paragraph) =>
		segmentParagraphIntoSentences(paragraph, locale).map((segment) => segment.text)
	);
}

export function mapWholeTranslationToStudyText(
	studyText: StudyText,
	wholeTranslation: string,
	sourceSentenceIds: string[] = studyText.sentences.map((sentence) => sentence.id)
): TranslationMappingResult {
	const sourceSentences = sourceSentenceIds
		.map((sentenceId) => studyText.sentences.find((sentence) => sentence.id === sentenceId))
		.filter((sentence): sentence is StudyText['sentences'][number] => Boolean(sentence));
	const translatedSentences = splitTranslationIntoSentences(wholeTranslation);
	const warnings: string[] = [];

	if (sourceSentences.length !== translatedSentences.length) {
		warnings.push(
			`Source sentences: ${sourceSentences.length}, translated sentences: ${translatedSentences.length}. Sequential mapping was applied and may need manual correction.`
		);
	}

	const pairs: TranslationMappingResult['pairs'] = sourceSentences.map((sentence, index) => ({
		sourceSentenceId: sentence.id,
		translation: translatedSentences[index] ?? '',
		confidence:
			sourceSentences.length === translatedSentences.length
				? 'exact_position'
				: 'count_mismatch'
	}));

	if (translatedSentences.length > sourceSentences.length) {
		warnings.push('Some translated sentences could not be assigned to source sentences.');
	}

	if (sourceSentences.length > translatedSentences.length) {
		warnings.push('Some source sentences have no mapped translation yet.');
	}

	return {
		sourceSentenceCount: sourceSentences.length,
		translatedSentenceCount: translatedSentences.length,
		pairs,
		warnings
	};
}
