<!-- eslint-disable svelte/no-navigation-without-resolve -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { speakChinese } from '$lib/client/speakText';
	import { formatPinyinForDisplay } from '$lib/study-text/pinyin';
	import { splitTranslationIntoSentences } from '$lib/study-text/parseTranslation';
	import { serializeSentenceSegmentation } from '$lib/study-text/segmentSentence';
	import type {
		DictionaryMatch,
		StudySentence,
		StudyText,
		StudyToken,
		TranslationMappingResult
	} from '$lib/study-text/types';

	type PageData = {
		studyText: StudyText;
	};

	type TokenManualOverrideDraft = {
		translation: string;
		pinyin: string;
	};

	let { data }: { data: PageData } = $props();
	let currentStudyText = $state<StudyText | null>(null);

	const studyText = $derived(currentStudyText ?? data.studyText);
	const paragraphs = $derived(studyText.paragraphs);
	const sentences = $derived(studyText.sentences);
	const sentencesById = $derived(
		Object.fromEntries(sentences.map((sentence) => [sentence.id, sentence]))
	);

	let title = $state('');
	let wholeTranslation = $state('');
	const parsedWholeTranslationSentences = $derived(splitTranslationIntoSentences(wholeTranslation));
	let sentenceTranslations = $state<Record<string, string>>({});
	let sentenceSegmentationDrafts = $state<Record<string, string>>({});
	let selectedTokenEntryIds = $state<Record<string, string>>({});
	let tokenManualOverrides = $state<Record<string, TokenManualOverrideDraft>>({});
	let visibleSentenceTranslations = $state<Record<string, boolean>>({});
	let visibleSentencePinyin = $state<Record<string, boolean>>({});
	let sentenceSegmentationErrors = $state<Record<string, string | null>>({});
	let separateWords = $state(false);
	let activeTokenId = $state<string | null>(null);
	let pinnedTokenId = $state<string | null>(null);
	let selectionJustMadeTokenId = $state<string | null>(null);
	let changingTokenId = $state<string | null>(null);
	let sentenceTranslationEditorId = $state<string | null>(null);
	let sentenceSegmentationEditorId = $state<string | null>(null);
	let translationWarnings = $state<string[]>([]);
	let editingText = $state(false);
	let rawTextDraft = $state('');
	let savePending = $state(false);
	let mappingPending = $state(false);
	const autosaveDelayMs = 800;
	let message = $state<string | null>(null);
	let errorMessage = $state<string | null>(null);
	let initializedStudyId = $state('');
	let initializedStudyVersion = $state('');
	let preserveLocalDraftsOnNextSync = $state(false);

	$effect(() => {
		const studyVersion = `${studyText.id}:${studyText.updatedAt}`;
		if (studyVersion === initializedStudyVersion) {
			return;
		}

		const studyIdChanged = studyText.id !== initializedStudyId;
		const sentenceIdSet = new Set(studyText.sentences.map((sentence) => sentence.id));
		const preserveLocalDrafts = preserveLocalDraftsOnNextSync && !studyIdChanged;

		if (!preserveLocalDrafts) {
			title = studyText.title;
			wholeTranslation = studyText.wholeTranslation ?? '';
			sentenceTranslations = Object.fromEntries(
				studyText.sentences.map((sentence) => [sentence.id, sentence.translation ?? ''])
			);
			sentenceSegmentationDrafts = Object.fromEntries(
				studyText.sentences.map((sentence) => [
					sentence.id,
					serializeSentenceSegmentation(sentence.segmentation.tokens)
				])
			);
			tokenManualOverrides = Object.fromEntries(
				studyText.sentences
					.flatMap((sentence) => sentence.segmentation.tokens)
					.map((token) => [
						token.id,
						{
							translation: token.manualTranslation ?? '',
							pinyin: token.manualPinyin ?? ''
						}
					])
			);
		}
		selectedTokenEntryIds = Object.fromEntries(
			studyText.sentences
				.flatMap((sentence) => sentence.segmentation.tokens)
				.filter((token) => typeof token.selectedDictionaryEntryId === 'string')
				.map((token) => [token.id, token.selectedDictionaryEntryId ?? ''])
		);
		visibleSentenceTranslations = studyIdChanged
			? {}
			: Object.fromEntries(
					Object.entries(visibleSentenceTranslations).filter(
						([sentenceId, visible]) => visible && sentenceIdSet.has(sentenceId)
					)
				);
		visibleSentencePinyin = studyIdChanged
			? {}
			: Object.fromEntries(
					Object.entries(visibleSentencePinyin).filter(
						([sentenceId, visible]) => visible && sentenceIdSet.has(sentenceId)
					)
				);
		sentenceSegmentationErrors = studyIdChanged
			? {}
			: Object.fromEntries(
					Object.entries(sentenceSegmentationErrors).filter(
						([sentenceId, error]) => typeof error === 'string' && sentenceIdSet.has(sentenceId)
					)
				);
		if (!preserveLocalDrafts) {
			activeTokenId = null;
			pinnedTokenId = null;
			selectionJustMadeTokenId = null;
			changingTokenId = null;
			rawTextDraft = studyText.rawText;
			editingText = false;
		}

		if (sentenceTranslationEditorId && !sentenceIdSet.has(sentenceTranslationEditorId)) {
			sentenceTranslationEditorId = null;
		}
		if (sentenceSegmentationEditorId && !sentenceIdSet.has(sentenceSegmentationEditorId)) {
			sentenceSegmentationEditorId = null;
		}

		if (studyIdChanged) {
			sentenceTranslationEditorId = null;
			sentenceSegmentationEditorId = null;
			translationWarnings = [];
			message = null;
			errorMessage = null;
		}

		initializedStudyId = studyText.id;
		initializedStudyVersion = studyVersion;
		preserveLocalDraftsOnNextSync = false;
	});

	function sentenceForParagraph(sentenceId: string): StudySentence | undefined {
		return sentencesById[sentenceId];
	}

	function startEditingText(): void {
		rawTextDraft = studyText.rawText;
		editingText = true;
		message = null;
		errorMessage = null;
	}

	function cancelEditingText(): void {
		rawTextDraft = studyText.rawText;
		editingText = false;
		errorMessage = null;
	}

	function setSentenceTranslation(sentenceId: string, translation: string): void {
		sentenceTranslations = {
			...sentenceTranslations,
			[sentenceId]: translation
		};
	}

	function setSentenceSegmentationDraft(sentenceId: string, segmentation: string): void {
		sentenceSegmentationDrafts = {
			...sentenceSegmentationDrafts,
			[sentenceId]: segmentation
		};
		sentenceSegmentationErrors = {
			...sentenceSegmentationErrors,
			[sentenceId]: null
		};
	}

	function toggleSentenceTranslationVisibility(sentenceId: string): void {
		const nextVisible = !visibleSentenceTranslations[sentenceId];
		visibleSentenceTranslations = {
			...visibleSentenceTranslations,
			[sentenceId]: nextVisible
		};

		if (!nextVisible && sentenceTranslationEditorId === sentenceId) {
			sentenceTranslationEditorId = null;
		}
	}

	function toggleSentencePinyinVisibility(sentenceId: string): void {
		visibleSentencePinyin = {
			...visibleSentencePinyin,
			[sentenceId]: !visibleSentencePinyin[sentenceId]
		};
	}

	function toggleSentenceTranslationEditor(sentenceId: string): void {
		visibleSentenceTranslations = {
			...visibleSentenceTranslations,
			[sentenceId]: true
		};
		sentenceTranslationEditorId = sentenceTranslationEditorId === sentenceId ? null : sentenceId;
	}

	function toggleSentenceSegmentationEditor(sentenceId: string): void {
		sentenceSegmentationEditorId = sentenceSegmentationEditorId === sentenceId ? null : sentenceId;
	}

	async function saveStudyText(
		updates: Record<string, unknown>,
		successMessage?: string,
		options?: {
			preserveLocalDrafts?: boolean;
		}
	): Promise<void> {
		savePending = true;
		if (!options?.preserveLocalDrafts) {
			message = null;
		}
		errorMessage = null;

		try {
			const response = await fetch(`/api/study-texts/${studyText.id}`, {
				method: 'PUT',
				headers: {
					'content-type': 'application/json'
				},
				body: JSON.stringify(updates)
			});

			const payload = (await response.json()) as {
				studyText?: StudyText;
				error?: string;
			};

			if (!response.ok || !payload.studyText) {
				throw new Error(payload.error ?? `Save failed with status ${response.status}`);
			}

			if (options?.preserveLocalDrafts) {
				preserveLocalDraftsOnNextSync = true;
			}
			currentStudyText = payload.studyText;
			if (successMessage) {
				message = successMessage;
			}
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Failed to save study text.';
		} finally {
			savePending = false;
		}
	}

	async function finishEditingText(): Promise<void> {
		await saveStudyText(
			{
				title,
				rawText: rawTextDraft,
				wholeTranslation,
				status: 'in_progress'
			},
			'Text re-split successfully.'
		);
		editingText = false;
	}

	function normalizeWhitespace(text: string): string {
		return text.replace(/\s+/gu, '');
	}

	function canonicalizeSentenceSegmentation(segmentationText: string): string {
		return segmentationText
			.split('|')
			.map((part) => part.trim())
			.filter((part) => part.length > 0)
			.join(' | ');
	}

	function currentTokenManualOverride(token: StudyToken): TokenManualOverrideDraft {
		return (
			tokenManualOverrides[token.id] ?? {
				translation: token.manualTranslation ?? '',
				pinyin: token.manualPinyin ?? ''
			}
		);
	}

	function setTokenManualTranslation(token: StudyToken, translation: string): void {
		tokenManualOverrides = {
			...tokenManualOverrides,
			[token.id]: {
				...currentTokenManualOverride(token),
				translation
			}
		};
	}

	function setTokenManualPinyin(token: StudyToken, pinyin: string): void {
		tokenManualOverrides = {
			...tokenManualOverrides,
			[token.id]: {
				...currentTokenManualOverride(token),
				pinyin
			}
		};
	}

	function createAutosavePayload(): Record<string, unknown> {
		return {
			title: title.trim().length > 0 ? title.trim() : studyText.title,
			wholeTranslation,
			sentenceTranslations: Object.fromEntries(
				studyText.sentences.map((sentence) => [
					sentence.id,
					(sentenceTranslations[sentence.id] ?? '').trim()
				])
			),
			sentenceSegmentations: Object.fromEntries(
				studyText.sentences.map((sentence) => [
					sentence.id,
					canonicalizeSentenceSegmentation(sentenceSegmentationDrafts[sentence.id] ?? '')
				])
			),
			tokenSelections: Object.fromEntries(
				Object.entries(selectedTokenEntryIds)
					.filter(([, value]) => value.length > 0)
					.sort(([left], [right]) => left.localeCompare(right))
			),
			tokenManualOverrides: Object.fromEntries(
				studyText.sentences
					.flatMap((sentence) => sentence.segmentation.tokens)
					.filter((token) => token.kind === 'word')
					.map((token) => [
						token.id,
						{
							translation: currentTokenManualOverride(token).translation.trim(),
							pinyin: currentTokenManualOverride(token).pinyin.trim()
						}
					])
			),
			status: 'in_progress'
		};
	}

	function createPersistedAutosavePayload(): Record<string, unknown> {
		return {
			title: studyText.title,
			wholeTranslation: studyText.wholeTranslation ?? '',
			sentenceTranslations: Object.fromEntries(
				studyText.sentences.map((sentence) => [sentence.id, sentence.translation ?? ''])
			),
			sentenceSegmentations: Object.fromEntries(
				studyText.sentences.map((sentence) => [
					sentence.id,
					serializeSentenceSegmentation(sentence.segmentation.tokens)
				])
			),
			tokenSelections: Object.fromEntries(
				studyText.sentences
					.flatMap((sentence) => sentence.segmentation.tokens)
					.filter((token) => typeof token.selectedDictionaryEntryId === 'string')
					.map((token) => [token.id, token.selectedDictionaryEntryId ?? ''])
					.sort(([left], [right]) => left.localeCompare(right))
			),
			tokenManualOverrides: Object.fromEntries(
				studyText.sentences
					.flatMap((sentence) => sentence.segmentation.tokens)
					.filter((token) => token.kind === 'word')
					.map((token) => [
						token.id,
						{
							translation: token.manualTranslation ?? '',
							pinyin: token.manualPinyin ?? ''
						}
					])
			),
			status: 'in_progress'
		};
	}

	function validateAllSentenceSegmentations(): Record<string, string | null> {
		return Object.fromEntries(
			studyText.sentences.map((sentence) => [
				sentence.id,
				validateSentenceSegmentation(sentence.id)
			])
		);
	}

	$effect(() => {
		if (initializedStudyVersion.length === 0 || mappingPending) {
			return;
		}

		const autosavePayload = createAutosavePayload();
		const autosaveSignature = JSON.stringify(autosavePayload);
		const persistedSignature = JSON.stringify(createPersistedAutosavePayload());

		if (autosaveSignature === persistedSignature) {
			sentenceSegmentationErrors = Object.fromEntries(
				studyText.sentences.map((sentence) => [sentence.id, null])
			);
			return;
		}

		const nextErrors = validateAllSentenceSegmentations();
		const firstInvalidSentenceId = studyText.sentences.find(
			(sentence) => typeof nextErrors[sentence.id] === 'string'
		)?.id;
		const hasValidationError = Boolean(firstInvalidSentenceId);
		sentenceSegmentationErrors = nextErrors;
		if (hasValidationError) {
			sentenceSegmentationEditorId = firstInvalidSentenceId ?? sentenceSegmentationEditorId;
			message = null;
			errorMessage = null;
			return;
		}

		const timeoutId = setTimeout(() => {
			void saveStudyText(autosavePayload, undefined, { preserveLocalDrafts: true });
		}, autosaveDelayMs);

		return () => {
			clearTimeout(timeoutId);
		};
	});

	async function mapWholeTranslation(): Promise<void> {
		mappingPending = true;
		message = null;
		errorMessage = null;

		try {
			const response = await fetch(`/api/study-texts/${studyText.id}/parse-translation`, {
				method: 'POST',
				headers: {
					'content-type': 'application/json'
				},
				body: JSON.stringify({
					wholeTranslation,
					sourceSentenceIds: studyText.sentences.map((sentence) => sentence.id)
				})
			});

			const payload = (await response.json()) as {
				studyText?: StudyText;
				mapping?: TranslationMappingResult;
				error?: string;
			};

			if (!response.ok || !payload.studyText || !payload.mapping) {
				throw new Error(payload.error ?? `Mapping failed with status ${response.status}`);
			}

			currentStudyText = payload.studyText;
			translationWarnings = payload.mapping.warnings;
			sentenceTranslations = Object.fromEntries(
				payload.studyText.sentences.map((sentence) => [sentence.id, sentence.translation ?? ''])
			);
			message =
				payload.mapping.warnings.length > 0
					? 'Translation mapped with warnings.'
					: 'Translation mapped to sentences.';
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Failed to map translation.';
		} finally {
			mappingPending = false;
		}
	}

	function validateSentenceSegmentation(sentenceId: string): string | null {
		const sentence = sentencesById[sentenceId];
		if (!sentence) {
			return 'Sentence not found.';
		}

		const segmentationText = sentenceSegmentationDrafts[sentenceId] ?? '';
		const rebuiltText = segmentationText
			.split('|')
			.map((part) => part.trim())
			.filter((part) => part.length > 0)
			.join('');
		const normalizedRebuiltText = normalizeWhitespace(rebuiltText);
		const normalizedSentenceText = normalizeWhitespace(sentence.text);

		if (normalizedRebuiltText === normalizedSentenceText) {
			return null;
		}

		if (normalizedRebuiltText.length === 0) {
			return 'Word separation cannot be empty.';
		}

		return `This split rebuilds "${rebuiltText}" but the sentence is "${sentence.text}". Whitespace differences are ignored.`;
	}

	function selectedMatchForToken(token: StudyToken): DictionaryMatch | undefined {
		const selectedEntryId = selectedTokenEntryIds[token.id] ?? token.selectedDictionaryEntryId;
		return selectedEntryId
			? token.dictionaryMatches.find((match) => match.entryId === selectedEntryId)
			: undefined;
	}

	function showTokenPopup(tokenId: string): void {
		if (pinnedTokenId && pinnedTokenId !== tokenId) {
			return;
		}

		activeTokenId = tokenId;
	}

	function closeTokenPopup(tokenId: string): void {
		if (activeTokenId !== tokenId && pinnedTokenId !== tokenId) {
			return;
		}

		if (activeTokenId === tokenId) {
			activeTokenId = null;
		}
		if (pinnedTokenId === tokenId) {
			pinnedTokenId = null;
		}
		if (selectionJustMadeTokenId === tokenId) {
			selectionJustMadeTokenId = null;
		}
		if (changingTokenId === tokenId) {
			changingTokenId = null;
		}
	}

	function hideTokenPopup(tokenId: string): void {
		if (pinnedTokenId === tokenId) {
			return;
		}

		closeTokenPopup(tokenId);
	}

	function togglePinnedTokenPopup(tokenId: string): void {
		if (pinnedTokenId === tokenId) {
			closeTokenPopup(tokenId);
			return;
		}

		if (pinnedTokenId) {
			closeTokenPopup(pinnedTokenId);
		}

		pinnedTokenId = tokenId;
		activeTokenId = tokenId;
	}

	function handleWindowClick(event: MouseEvent): void {
		if (!pinnedTokenId) {
			return;
		}

		const clickedInsidePopup = event
			.composedPath()
			.some((node) => node instanceof Element && node.matches('[data-token-popup-root="true"]'));
		if (clickedInsidePopup) {
			return;
		}

		closeTokenPopup(pinnedTokenId);
	}

	function handleTokenFocusOut(
		tokenId: string,
		event: FocusEvent & { currentTarget: EventTarget & HTMLElement }
	): void {
		if (pinnedTokenId === tokenId) {
			return;
		}

		const nextTarget = event.relatedTarget;
		if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
			return;
		}

		hideTokenPopup(tokenId);
	}

	async function chooseTokenMatch(token: StudyToken, match: DictionaryMatch): Promise<void> {
		selectedTokenEntryIds = {
			...selectedTokenEntryIds,
			[token.id]: match.entryId
		};
		selectionJustMadeTokenId = token.id;
		changingTokenId = null;

		await saveStudyText(
			{
				tokenSelections: {
					[token.id]: match.entryId
				},
				status: 'in_progress'
			},
			undefined,
			{ preserveLocalDrafts: true }
		);
	}

	function changeTokenSelection(tokenId: string): void {
		pinnedTokenId = tokenId;
		activeTokenId = tokenId;
		changingTokenId = tokenId;
		selectionJustMadeTokenId = null;
	}

	function showFullMatchList(token: StudyToken): boolean {
		if (changingTokenId === token.id || selectionJustMadeTokenId === token.id) {
			return true;
		}

		return !selectedMatchForToken(token);
	}

	function currentSentenceTranslation(sentence: StudySentence): string {
		return (sentenceTranslations[sentence.id] ?? sentence.translation ?? '').trim();
	}

	function sentenceTranslationCandidates(sentence: StudySentence): string[] {
		const current = currentSentenceTranslation(sentence);
		return [
			...new Set([current, ...parsedWholeTranslationSentences].filter((value) => value.length > 0))
		];
	}

	function displayPinyinForToken(token: StudyToken): string {
		return formatPinyinForDisplay(
			currentTokenManualOverride(token).pinyin.trim() ||
				selectedMatchForToken(token)?.pinyin?.trim() ||
				token.dictionaryMatches[0]?.pinyin?.trim() ||
				token.pinyin?.trim() ||
				''
		);
	}

	function displayMatchPinyin(pinyin: string | undefined): string {
		return formatPinyinForDisplay(pinyin?.trim() || '');
	}

	function tokenTextClassName(token: StudyToken): string {
		if (token.kind === 'punctuation') {
			return 'text-zinc-500';
		}

		if (token.dictionaryMatches.length === 0) {
			return 'text-amber-900 underline decoration-amber-300 decoration-dotted underline-offset-4';
		}

		if (selectedMatchForToken(token)) {
			return 'text-emerald-900 underline decoration-emerald-300 decoration-dotted underline-offset-4';
		}

		return 'text-sky-900 underline decoration-sky-300 decoration-dotted underline-offset-4';
	}

	async function playSentenceTts(text: string): Promise<void> {
		message = null;
		errorMessage = null;

		try {
			await speakChinese(text);
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Failed to play sentence audio.';
		}
	}

	function sentenceActionButtonClass(
		kind: 'audio' | 'translation' | 'pinyin' | 'segmentation',
		active: boolean
	): string {
		const base =
			'inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium ring-1 transition';

		if (kind === 'audio') {
			return active
				? `${base} bg-emerald-600 text-white ring-emerald-600 hover:bg-emerald-500`
				: `${base} bg-emerald-50 text-emerald-900 ring-emerald-200 hover:bg-emerald-100`;
		}

		if (kind === 'translation') {
			return active
				? `${base} bg-sky-600 text-white ring-sky-600 hover:bg-sky-500`
				: `${base} bg-sky-50 text-sky-900 ring-sky-200 hover:bg-sky-100`;
		}

		if (kind === 'pinyin') {
			return active
				? `${base} bg-violet-600 text-white ring-violet-600 hover:bg-violet-500`
				: `${base} bg-violet-50 text-violet-900 ring-violet-200 hover:bg-violet-100`;
		}

		return active
			? `${base} bg-amber-500 text-white ring-amber-500 hover:bg-amber-400`
			: `${base} bg-amber-50 text-amber-900 ring-amber-200 hover:bg-amber-100`;
	}

	function openGoogleTranslate(text: string): void {
		const url = new URL('https://translate.google.com/');
		url.searchParams.set('sl', 'zh-CN');
		url.searchParams.set('tl', 'en');
		url.searchParams.set('text', text);
		url.searchParams.set('op', 'translate');
		window.open(url.toString(), '_blank', 'noopener,noreferrer');
	}
</script>

<svelte:head>
	<title>{studyText.title} · Study Text</title>
	<meta
		name="description"
		content="Read Chinese text, choose word meanings, and manage sentence translations."
	/>
</svelte:head>

<svelte:window onclick={handleWindowClick} />

<div class="min-h-screen bg-zinc-100 text-zinc-950">
	<div
		class="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-5 sm:px-6 sm:py-8 lg:py-10"
	>
		<header class="space-y-2">
			<div class="flex flex-wrap items-center justify-between gap-3">
				<div>
					<p class="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">Study Text</p>
					<h1 class="text-3xl font-semibold">{studyText.title}</h1>
					<p class="mt-1 break-all text-sm text-zinc-500">{studyText.id}</p>
				</div>
				<div class="flex flex-wrap gap-3 text-sm">
					<a
						href={resolve('/study-text')}
						class="rounded-xl bg-white px-4 py-2 font-medium text-zinc-800 ring-1 ring-zinc-200 transition hover:bg-zinc-50"
					>
						Back to studies
					</a>
					<button
						type="button"
						onclick={startEditingText}
						class="rounded-xl bg-white px-4 py-2 font-medium text-zinc-800 ring-1 ring-zinc-200 transition hover:bg-zinc-50"
					>
						Edit source text
					</button>
					{#if studyText.relatedDrillId}
						<a
							href={`${resolve('/drill')}?id=${studyText.relatedDrillId}`}
							class="rounded-xl bg-white px-4 py-2 font-medium text-zinc-800 ring-1 ring-zinc-200 transition hover:bg-zinc-50"
						>
							Open related drill
						</a>
					{/if}
				</div>
			</div>
			<p class="text-sm text-zinc-600">
				Hover words to choose meanings. Use the buttons below each sentence to reveal translations
				or edit word separation.
			</p>
		</header>

		{#if editingText}
			<section class="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-zinc-200 sm:p-6">
				<div class="space-y-3">
					<label class="space-y-2">
						<span class="text-sm font-medium text-zinc-800">Title</span>
						<input
							type="text"
							bind:value={title}
							class="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-400 focus:bg-white"
						/>
					</label>
					<textarea
						bind:value={rawTextDraft}
						rows="12"
						class="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-400 focus:bg-white"
					></textarea>
					<div class="flex flex-wrap gap-3">
						<button
							type="button"
							onclick={() => void finishEditingText()}
							disabled={savePending || mappingPending}
							class="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-300"
						>
							{savePending || mappingPending ? 'Saving…' : 'Finish editing text'}
						</button>
						<button
							type="button"
							onclick={cancelEditingText}
							class="rounded-xl bg-zinc-100 px-4 py-3 text-sm font-medium text-zinc-800 ring-1 ring-zinc-200 transition hover:bg-zinc-200"
						>
							Cancel editing
						</button>
					</div>
				</div>
			</section>
		{/if}

		<section class="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-zinc-200 sm:p-6">
			<div
				class="flex flex-col gap-4 border-b border-zinc-200 pb-4 sm:flex-row sm:items-center sm:justify-between"
			>
				<div>
					<p class="text-lg font-semibold text-zinc-950">Chinese text</p>
					<p class="text-sm text-zinc-500">
						Word hover always works. Toggle word spacing if you want to inspect segmentation.
					</p>
				</div>
				<div class="flex flex-wrap items-center gap-3 text-sm">
					<button
						type="button"
						onclick={() => (separateWords = !separateWords)}
						class={`rounded-xl px-4 py-2 font-medium ring-1 transition ${separateWords ? 'bg-zinc-950 text-white ring-zinc-950 hover:bg-zinc-800' : 'bg-white text-zinc-800 ring-zinc-200 hover:bg-zinc-50'}`}
					>
						{separateWords ? 'Separate words: On' : 'Separate words: Off'}
					</button>
				</div>
			</div>

			<div class="mt-5 space-y-6">
				{#each paragraphs as paragraph (paragraph.id)}
					<div class="space-y-3 rounded-2xl bg-zinc-50 p-4 ring-1 ring-zinc-200">
						{#each paragraph.sentenceIds as sentenceId (sentenceId)}
							{@const sentence = sentenceForParagraph(sentenceId)}
							{#if sentence}
								<div class="rounded-xl px-2 py-1">
									<div class="text-2xl leading-10 text-zinc-950 sm:text-3xl sm:leading-[3.25rem]">
										{#each sentence.segmentation.tokens as token, index (token.id)}
											{@const tokenPinyin = displayPinyinForToken(token)}
											{#if separateWords && index > 0}<span aria-hidden="true"> </span>{/if}
											<span
												data-token-popup-root="true"
												role="group"
												class="relative inline-flex flex-col items-center align-top"
												onmouseenter={() => showTokenPopup(token.id)}
												onmouseleave={() => hideTokenPopup(token.id)}
												onfocusout={(event) => handleTokenFocusOut(token.id, event)}
											>
												{#if visibleSentencePinyin[sentence.id]}
													<span
														class="min-h-4 text-xs font-medium leading-4 text-zinc-500 sm:text-sm sm:leading-5"
													>
														{tokenPinyin}
													</span>
												{/if}
												<button
													type="button"
													onclick={() => togglePinnedTokenPopup(token.id)}
													onfocus={() => showTokenPopup(token.id)}
													class={`inline rounded-sm px-0.5 py-0.5 align-baseline transition hover:bg-white focus-visible:bg-white ${tokenTextClassName(token)}`}
												>
													{token.text}
												</button>

												{#if token.kind === 'word' && activeTokenId === token.id}
													<div class="absolute left-0 top-full z-20 w-80 max-w-[85vw] pt-2">
														<div
															class="rounded-2xl bg-zinc-950 p-3 text-left text-xs text-white shadow-lg ring-1 ring-zinc-800"
														>
															<div class="flex items-center justify-between gap-2">
																<p class="text-sm font-semibold text-white">{token.text}</p>
																{#if tokenPinyin}
																	<p class="text-[11px] text-zinc-300">{tokenPinyin}</p>
																{/if}
															</div>

															{#if token.dictionaryMatches.length === 0}
																<p class="mt-2 text-zinc-300">No dictionary match found.</p>
																<div
																	class="mt-3 space-y-3 rounded-xl bg-white/5 p-3 ring-1 ring-white/10"
																>
																	<label class="block space-y-1.5">
																		<span
																			class="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-400"
																		>
																			Translation
																		</span>
																		<input
																			type="text"
																			value={currentTokenManualOverride(token).translation}
																			oninput={(event) =>
																				setTokenManualTranslation(token, event.currentTarget.value)}
																			placeholder="Add your own translation"
																			class="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-sky-300/50 focus:bg-white/15"
																		/>
																	</label>
																	<label class="block space-y-1.5">
																		<span
																			class="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-400"
																		>
																			Pinyin
																		</span>
																		<input
																			type="text"
																			value={currentTokenManualOverride(token).pinyin}
																			oninput={(event) =>
																				setTokenManualPinyin(token, event.currentTarget.value)}
																			placeholder="Use numbers or tone marks"
																			class="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-sky-300/50 focus:bg-white/15"
																		/>
																	</label>
																	{#if currentTokenManualOverride(token).pinyin.trim()}
																		<p class="text-[11px] text-zinc-400">
																			Shown as {formatPinyinForDisplay(
																				currentTokenManualOverride(token).pinyin.trim()
																			)}
																		</p>
																	{/if}
																</div>
															{:else if showFullMatchList(token)}
																<div class="mt-2 max-h-96 space-y-2 overflow-y-auto pr-1">
																	{#each token.dictionaryMatches as match (match.entryId)}
																		<button
																			type="button"
																			onclick={() => chooseTokenMatch(token, match)}
																			class={`block w-full rounded-xl p-2 text-left ring-1 transition hover:bg-white/10 ${selectedMatchForToken(token)?.entryId === match.entryId ? 'bg-sky-500/15 ring-sky-300/40' : 'bg-white/5 ring-white/10'}`}
																		>
																			<div class="flex items-start justify-between gap-2">
																				<div>
																					<p class="font-medium text-white">
																						{match.simplified}
																						{#if match.traditional !== match.simplified}
																							<span class="text-zinc-300">
																								· {match.traditional}</span
																							>
																						{/if}
																					</p>
																					{#if match.pinyin}
																						<p class="mt-0.5 text-zinc-300">
																							{displayMatchPinyin(match.pinyin)}
																						</p>
																					{/if}
																				</div>
																				<p
																					class="shrink-0 text-[10px] uppercase tracking-[0.14em] text-zinc-400"
																				>
																					{match.source}
																				</p>
																			</div>

																			{#if typeof match.frequency === 'number' || (match.partsOfSpeech?.length ?? 0) > 0}
																				<p class="mt-1 text-zinc-300">
																					{#if typeof match.frequency === 'number'}freq {match.frequency}{/if}{#if typeof match.frequency === 'number' && (match.partsOfSpeech?.length ?? 0) > 0}
																						·
																					{/if}{#if (match.partsOfSpeech?.length ?? 0) > 0}POS {match.partsOfSpeech?.join(
																							', '
																						)}{/if}
																				</p>
																			{/if}
																			{#if (match.tags?.length ?? 0) > 0 || (match.classifiers?.length ?? 0) > 0}
																				<p class="mt-1 text-zinc-300">
																					{#if (match.tags?.length ?? 0) > 0}{match.tags?.join(
																							', '
																						)}{/if}{#if (match.tags?.length ?? 0) > 0 && (match.classifiers?.length ?? 0) > 0}
																						·
																					{/if}{#if (match.classifiers?.length ?? 0) > 0}CL {match.classifiers?.join(
																							', '
																						)}{/if}
																				</p>
																			{/if}
																			<ul class="mt-2 list-disc space-y-1 pl-4 text-zinc-200">
																				{#each match.definitions as definition, definitionIndex (definitionIndex)}
																					<li>{definition}</li>
																				{/each}
																			</ul>
																		</button>
																	{/each}
																</div>
															{:else}
																{@const selectedMatch = selectedMatchForToken(token)}
																{#if selectedMatch}
																	<div class="mt-2 space-y-3">
																		<div
																			class="rounded-xl bg-sky-500/15 p-2 ring-1 ring-sky-300/40"
																		>
																			<div class="flex items-start justify-between gap-2">
																				<div>
																					<p class="font-medium text-white">
																						{selectedMatch.simplified}
																						{#if selectedMatch.traditional !== selectedMatch.simplified}
																							<span class="text-zinc-300">
																								· {selectedMatch.traditional}</span
																							>
																						{/if}
																					</p>
																					{#if selectedMatch.pinyin}
																						<p class="mt-0.5 text-zinc-300">
																							{displayMatchPinyin(selectedMatch.pinyin)}
																						</p>
																					{/if}
																				</div>
																				<p
																					class="shrink-0 text-[10px] uppercase tracking-[0.14em] text-zinc-400"
																				>
																					{selectedMatch.source}
																				</p>
																			</div>
																			{#if typeof selectedMatch.frequency === 'number' || (selectedMatch.partsOfSpeech?.length ?? 0) > 0}
																				<p class="mt-1 text-zinc-300">
																					{#if typeof selectedMatch.frequency === 'number'}freq {selectedMatch.frequency}{/if}{#if typeof selectedMatch.frequency === 'number' && (selectedMatch.partsOfSpeech?.length ?? 0) > 0}
																						·
																					{/if}{#if (selectedMatch.partsOfSpeech?.length ?? 0) > 0}POS
																						{selectedMatch.partsOfSpeech?.join(', ')}{/if}
																				</p>
																			{/if}
																			{#if (selectedMatch.tags?.length ?? 0) > 0 || (selectedMatch.classifiers?.length ?? 0) > 0}
																				<p class="mt-1 text-zinc-300">
																					{#if (selectedMatch.tags?.length ?? 0) > 0}{selectedMatch.tags?.join(
																							', '
																						)}{/if}{#if (selectedMatch.tags?.length ?? 0) > 0 && (selectedMatch.classifiers?.length ?? 0) > 0}
																						·
																					{/if}{#if (selectedMatch.classifiers?.length ?? 0) > 0}CL {selectedMatch.classifiers?.join(
																							', '
																						)}{/if}
																				</p>
																			{/if}
																			<ul class="mt-2 list-disc space-y-1 pl-4 text-zinc-200">
																				{#each selectedMatch.definitions as definition, definitionIndex (definitionIndex)}
																					<li>{definition}</li>
																				{/each}
																			</ul>
																		</div>
																		<button
																			type="button"
																			onclick={() => changeTokenSelection(token.id)}
																			class="rounded-xl bg-white/10 px-3 py-2 text-xs font-medium text-white ring-1 ring-white/15 transition hover:bg-white/20"
																		>
																			Change
																		</button>
																	</div>
																{/if}
															{/if}
														</div>
													</div>
												{/if}
											</span>
										{/each}
									</div>

									<div class="mt-3 flex flex-wrap gap-2">
										<button
											type="button"
											onclick={() => void playSentenceTts(sentence.text)}
											class={sentenceActionButtonClass('audio', false)}
											aria-label="Play sentence audio"
											title="Play sentence audio"
										>
											<span aria-hidden="true" class="text-sm">🔊</span>
										</button>
										<button
											type="button"
											onclick={() => toggleSentenceTranslationVisibility(sentence.id)}
											class={sentenceActionButtonClass(
												'translation',
												Boolean(visibleSentenceTranslations[sentence.id])
											)}
										>
											<span aria-hidden="true" class="text-sm">文</span>
											<span>Translation</span>
										</button>
										<button
											type="button"
											onclick={() => toggleSentencePinyinVisibility(sentence.id)}
											class={sentenceActionButtonClass(
												'pinyin',
												Boolean(visibleSentencePinyin[sentence.id])
											)}
										>
											<span aria-hidden="true" class="text-sm">拼</span>
											<span>Pinyin</span>
										</button>
										<button
											type="button"
											onclick={() => toggleSentenceSegmentationEditor(sentence.id)}
											class={sentenceActionButtonClass(
												'segmentation',
												sentenceSegmentationEditorId === sentence.id
											)}
										>
											<span aria-hidden="true" class="text-sm">✂</span>
											<span>Word separation</span>
										</button>
									</div>

									{#if visibleSentenceTranslations[sentence.id]}
										<div class="mt-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-200">
											<div class="flex flex-wrap items-start justify-between gap-3">
												<div>
													<p class="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
														Translation
													</p>
													<p class="mt-2 text-sm leading-6 text-zinc-900">
														{currentSentenceTranslation(sentence) || 'No sentence translation yet.'}
													</p>
												</div>
												<button
													type="button"
													onclick={() => toggleSentenceTranslationEditor(sentence.id)}
													class="rounded-xl bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-800 ring-1 ring-zinc-200 transition hover:bg-zinc-200"
												>
													Edit
												</button>
											</div>

											{#if sentenceTranslationEditorId === sentence.id}
												<div class="mt-4 space-y-3 rounded-2xl bg-zinc-50 p-3 ring-1 ring-zinc-200">
													<p class="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
														Choose sentence translation
													</p>
													{#if sentenceTranslationCandidates(sentence).length === 0}
														<p class="text-sm text-zinc-500">
															No parsed sentence translations yet.
														</p>
													{:else}
														<div class="space-y-2">
															{#each sentenceTranslationCandidates(sentence) as candidate, index (candidate + index)}
																<button
																	type="button"
																	onclick={() => setSentenceTranslation(sentence.id, candidate)}
																	class={`block w-full rounded-xl px-3 py-2 text-left text-sm ring-1 transition ${currentSentenceTranslation(sentence) === candidate ? 'bg-sky-50 text-sky-950 ring-sky-200' : 'bg-white text-zinc-800 ring-zinc-200 hover:bg-zinc-50'}`}
																>
																	{candidate}
																</button>
															{/each}
														</div>
													{/if}

													<label class="block space-y-2">
														<span
															class="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500"
														>
															Manual translation
														</span>
														<textarea
															value={sentenceTranslations[sentence.id] ?? ''}
															oninput={(event) =>
																setSentenceTranslation(sentence.id, event.currentTarget.value)}
															rows="3"
															class="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-950 outline-none transition focus:border-zinc-400 focus:bg-white"
														></textarea>
													</label>

													<div class="flex flex-wrap gap-2">
														<button
															type="button"
															onclick={() => toggleSentenceTranslationEditor(sentence.id)}
															class="rounded-xl bg-white px-3 py-2 text-xs font-medium text-zinc-800 ring-1 ring-zinc-200 transition hover:bg-zinc-50"
														>
															Done
														</button>
													</div>
												</div>
											{/if}
										</div>
									{/if}

									{#if sentenceSegmentationEditorId === sentence.id}
										<div class="mt-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-200">
											<p class="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
												Word separation
											</p>
											<p class="mt-2 text-xs text-zinc-500">
												Use <span class="font-semibold">|</span> between tokens, for example:
												<span class="font-medium text-zinc-700"> 你 | 好 | ！</span>. Whitespace is
												ignored for validation.
											</p>
											<textarea
												value={sentenceSegmentationDrafts[sentence.id] ?? ''}
												oninput={(event) =>
													setSentenceSegmentationDraft(sentence.id, event.currentTarget.value)}
												rows="3"
												class={`mt-2 w-full rounded-2xl border px-3 py-2 text-sm text-zinc-950 outline-none transition focus:bg-white ${sentenceSegmentationErrors[sentence.id] ? 'border-red-300 bg-red-50 focus:border-red-400' : 'border-zinc-200 bg-zinc-50 focus:border-zinc-400'}`}
											></textarea>
											{#if sentenceSegmentationErrors[sentence.id]}
												<p class="mt-2 text-sm text-red-600">
													{sentenceSegmentationErrors[sentence.id]}
												</p>
											{/if}
											<div class="mt-3 flex flex-wrap gap-2">
												<button
													type="button"
													onclick={() => toggleSentenceSegmentationEditor(sentence.id)}
													class="rounded-xl bg-white px-3 py-2 text-xs font-medium text-zinc-800 ring-1 ring-zinc-200 transition hover:bg-zinc-50"
												>
													Done
												</button>
											</div>
										</div>
									{/if}
								</div>
							{/if}
						{/each}
					</div>
				{/each}
			</div>
		</section>

		<section class="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-zinc-200 sm:p-6">
			<div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
				<div>
					<p class="text-lg font-semibold text-zinc-950">Whole-text translation</p>
					<p class="text-sm text-zinc-500">
						Paste or edit the translation for the full text. Sentence mapping uses this field.
					</p>
				</div>
				<button
					type="button"
					onclick={() => openGoogleTranslate(studyText.rawText)}
					class="rounded-xl bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-800 ring-1 ring-zinc-200 transition hover:bg-zinc-200"
				>
					Open source in Google Translate
				</button>
			</div>

			<textarea
				bind:value={wholeTranslation}
				rows="10"
				placeholder="Paste the full translation here"
				class="mt-5 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-400 focus:bg-white"
			></textarea>

			<div class="mt-4 flex flex-wrap items-center gap-3">
				<button
					type="button"
					onclick={() => void mapWholeTranslation()}
					disabled={savePending || mappingPending || wholeTranslation.trim().length === 0}
					class="rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-300"
				>
					{mappingPending ? 'Mapping…' : 'Map translation to sentences'}
				</button>
				<p class="text-sm text-zinc-500">Changes autosave automatically.</p>
			</div>

			{#if translationWarnings.length > 0}
				<div class="mt-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
					<p class="font-medium">Translation mapping warnings</p>
					<ul class="mt-2 list-disc space-y-1 pl-5">
						{#each translationWarnings as warning, index (index)}
							<li>{warning}</li>
						{/each}
					</ul>
				</div>
			{/if}

			{#if message}
				<p class="mt-4 text-sm text-emerald-700">{message}</p>
			{/if}
			{#if errorMessage}
				<p class="mt-2 text-sm text-red-600">{errorMessage}</p>
			{/if}
		</section>
	</div>
</div>
