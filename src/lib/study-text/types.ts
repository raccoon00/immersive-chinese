export type StudyTextStatus = 'draft' | 'in_progress' | 'ready';

export type StudyTokenKind = 'word' | 'named_entity' | 'punctuation' | 'unknown';

export type DictionaryMatch = {
	entryId: string;
	simplified: string;
	traditional: string;
	pinyin: string;
	definitions: string[];
	source: 'cc-cedict' | 'complete';
	tags?: string[];
	partsOfSpeech?: string[];
	classifiers?: string[];
	frequency?: number;
};

export type SentenceSegmentation = {
	sentenceId: string;
	source: 'auto' | 'manual' | 'mixed';
	tokens: StudyToken[];
	updatedAt: string;
};

export type StudyToken = {
	id: string;
	sentenceId: string;
	start: number;
	end: number;
	text: string;
	kind: StudyTokenKind;
	autoProposed: boolean;
	manuallyEdited: boolean;
	pinyin?: string;
	selectedDictionaryEntryId?: string;
	selectedTranslation?: string;
	manualTranslation?: string;
	dictionaryMatches: DictionaryMatch[];
	tags: string[];
};

export type StudyParagraph = {
	id: string;
	index: number;
	text: string;
	sentenceIds: string[];
};

export type StudySentence = {
	id: string;
	paragraphId: string;
	indexInParagraph: number;
	globalIndex: number;
	text: string;
	startOffset: number;
	endOffset: number;
	selected: boolean;
	translation?: string;
	segmentation: SentenceSegmentation;
};

export type StudyText = {
	id: string;
	title: string;
	rawText: string;
	paragraphs: StudyParagraph[];
	sentences: StudySentence[];
	selectedSentenceIds: string[];
	wholeTranslation?: string;
	relatedDrillId?: string;
	status: StudyTextStatus;
	createdAt: string;
	updatedAt: string;
};

export type StudyTextSummary = Pick<
	StudyText,
	'id' | 'title' | 'status' | 'relatedDrillId' | 'createdAt' | 'updatedAt'
> & {
	sentenceCount: number;
	selectedSentenceCount: number;
};

export type TranslationMappingResult = {
	sourceSentenceCount: number;
	translatedSentenceCount: number;
	pairs: Array<{
		sourceSentenceId: string;
		translation: string;
		confidence: 'exact_position' | 'count_mismatch';
	}>;
	warnings: string[];
};

export type RawStudyTextInput = {
	rawText: string;
	title?: string;
	createdFrom: 'clipboard' | 'manual';
};
