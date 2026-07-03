import { autoSegmentSentence } from '$lib/study-text/segmentSentence';
import type { StudyParagraph, StudySentence } from '$lib/study-text/types';

type ParsedParagraph = Omit<StudyParagraph, 'id' | 'sentenceIds'> & {
	startOffset: number;
	endOffset: number;
	sentences: Array<{
		indexInParagraph: number;
		globalIndex: number;
		text: string;
		startOffset: number;
		endOffset: number;
	}>;
};

export type ParsedStudyText = {
	normalizedText: string;
	title: string;
	paragraphs: ParsedParagraph[];
	sentenceCount: number;
};

function normalizeText(rawText: string): string {
	return rawText.replace(/\r\n?/g, '\n').trim();
}

export function inferStudyTextTitle(rawText: string): string {
	const firstNonEmptyLine = normalizeText(rawText)
		.split('\n')
		.map((line) => line.trim())
		.find((line) => line.length > 0);

	if (!firstNonEmptyLine) {
		return 'Untitled study text';
	}

	return firstNonEmptyLine.length > 48
		? `${firstNonEmptyLine.slice(0, 45).trimEnd()}…`
		: firstNonEmptyLine;
}

function segmentSentences(
	paragraphText: string
): Array<{ text: string; start: number; end: number }> {
	const SegmenterCtor = globalThis.Intl?.Segmenter;
	if (SegmenterCtor) {
		const segmenter = new SegmenterCtor('zh-CN', { granularity: 'sentence' });
		const segments = Array.from(segmenter.segment(paragraphText))
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

	const results: Array<{ text: string; start: number; end: number }> = [];
	const regex = /.+?(?:[。！？!?]+[”」』）】》]*|$)/gu;

	for (const match of paragraphText.matchAll(regex)) {
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

export function parseStudyText(rawText: string, title?: string): ParsedStudyText {
	const normalizedText = normalizeText(rawText);
	const paragraphs: ParsedParagraph[] = [];

	if (normalizedText.length === 0) {
		return {
			normalizedText,
			title: title?.trim() || 'Untitled study text',
			paragraphs,
			sentenceCount: 0
		};
	}

	const paragraphChunks = normalizedText.split(/\n\s*\n+/);
	let cursor = 0;
	let globalSentenceIndex = 0;

	for (const [paragraphIndex, paragraphChunk] of paragraphChunks.entries()) {
		const paragraphText = paragraphChunk.trim();
		const paragraphStart = normalizedText.indexOf(paragraphChunk, cursor);
		const paragraphEnd = paragraphStart + paragraphChunk.length;
		cursor = paragraphEnd;

		const sentenceSegments = segmentSentences(paragraphText);
		const sentences = sentenceSegments.map((segment, indexInParagraph) => ({
			indexInParagraph,
			globalIndex: globalSentenceIndex++,
			text: segment.text,
			startOffset: paragraphStart + segment.start,
			endOffset: paragraphStart + segment.end
		}));

		paragraphs.push({
			index: paragraphIndex,
			text: paragraphText,
			startOffset: paragraphStart,
			endOffset: paragraphStart + paragraphText.length,
			sentences
		});
	}

	return {
		normalizedText,
		title: title?.trim() || inferStudyTextTitle(normalizedText),
		paragraphs,
		sentenceCount: globalSentenceIndex
	};
}

export function buildStudyTextStructure(
	parsed: ParsedStudyText,
	studyId: string
): Pick<
	import('$lib/study-text/types').StudyText,
	'paragraphs' | 'sentences' | 'selectedSentenceIds' | 'rawText' | 'title'
> {
	const paragraphs: StudyParagraph[] = [];
	const sentences: StudySentence[] = [];
	const selectedSentenceIds: string[] = [];
	for (const paragraph of parsed.paragraphs) {
		const paragraphId = `paragraph_${studyId}_${paragraph.index}`;
		const sentenceIds: string[] = [];

		for (const sentence of paragraph.sentences) {
			const sentenceId = `sentence_${studyId}_${sentence.globalIndex}`;
			sentenceIds.push(sentenceId);
			selectedSentenceIds.push(sentenceId);
			sentences.push({
				id: sentenceId,
				paragraphId,
				indexInParagraph: sentence.indexInParagraph,
				globalIndex: sentence.globalIndex,
				text: sentence.text,
				startOffset: sentence.startOffset,
				endOffset: sentence.endOffset,
				selected: true,
				segmentation: autoSegmentSentence(sentenceId, sentence.text)
			});
		}

		paragraphs.push({
			id: paragraphId,
			index: paragraph.index,
			text: paragraph.text,
			sentenceIds
		});
	}

	return {
		rawText: parsed.normalizedText,
		title: parsed.title,
		paragraphs,
		sentences,
		selectedSentenceIds
	};
}
