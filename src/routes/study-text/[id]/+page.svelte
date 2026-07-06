<!-- eslint-disable svelte/no-navigation-without-resolve -->
<script lang="ts">
	import { resolve } from '$app/paths';
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
	let visibleSentenceTranslations = $state<Record<string, boolean>>({});
	let visibleSentencePinyin = $state<Record<string, boolean>>({});
	let separateWords = $state(false);
	let activeTokenId = $state<string | null>(null);
	let selectionJustMadeTokenId = $state<string | null>(null);
	let changingTokenId = $state<string | null>(null);
	let sentenceTranslationEditorId = $state<string | null>(null);
	let sentenceSegmentationEditorId = $state<string | null>(null);
	let translationWarnings = $state<string[]>([]);
	let editingText = $state(false);
	let rawTextDraft = $state('');
	let savePending = $state(false);
	let message = $state<string | null>(null);
	let errorMessage = $state<string | null>(null);
	let initializedStudyId = $state('');
	let initializedStudyVersion = $state('');

	$effect(() => {
		const studyVersion = `${studyText.id}:${studyText.updatedAt}`;
		if (studyVersion === initializedStudyVersion) {
			return;
		}

		const studyIdChanged = studyText.id !== initializedStudyId;
		const sentenceIdSet = new Set(studyText.sentences.map((sentence) => sentence.id));

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
		activeTokenId = null;
		selectionJustMadeTokenId = null;
		changingTokenId = null;
		rawTextDraft = studyText.rawText;
		editingText = false;

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
		successMessage: string
	): Promise<void> {
		savePending = true;
		message = null;
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

			currentStudyText = payload.studyText;
			message = successMessage;
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

	async function mapWholeTranslation(): Promise<void> {
		savePending = true;
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
			savePending = false;
		}
	}

	async function applySentenceChanges(sentenceId: string, successMessage: string): Promise<void> {
		await saveStudyText(
			{
				title,
				wholeTranslation,
				sentenceTranslations: {
					[sentenceId]: sentenceTranslations[sentenceId] ?? ''
				},
				sentenceSegmentations: {
					[sentenceId]: sentenceSegmentationDrafts[sentenceId] ?? ''
				},
				tokenSelections: selectedTokenEntryIds,
				status: 'in_progress'
			},
			successMessage
		);
	}

	async function saveProgress(): Promise<void> {
		await saveStudyText(
			{
				title,
				wholeTranslation,
				sentenceTranslations,
				sentenceSegmentations: sentenceSegmentationDrafts,
				tokenSelections: selectedTokenEntryIds,
				status: 'in_progress'
			},
			'Progress saved.'
		);
	}

	function selectedMatchForToken(token: StudyToken): DictionaryMatch | undefined {
		const selectedEntryId = selectedTokenEntryIds[token.id] ?? token.selectedDictionaryEntryId;
		return selectedEntryId
			? token.dictionaryMatches.find((match) => match.entryId === selectedEntryId)
			: undefined;
	}

	function showTokenPopup(tokenId: string): void {
		activeTokenId = tokenId;
	}

	function hideTokenPopup(tokenId: string): void {
		if (activeTokenId !== tokenId) {
			return;
		}

		activeTokenId = null;
		if (selectionJustMadeTokenId === tokenId) {
			selectionJustMadeTokenId = null;
		}
		if (changingTokenId === tokenId) {
			changingTokenId = null;
		}
	}

	function handleTokenFocusOut(
		tokenId: string,
		event: FocusEvent & { currentTarget: EventTarget & HTMLElement }
	): void {
		const nextTarget = event.relatedTarget;
		if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
			return;
		}

		hideTokenPopup(tokenId);
	}

	function chooseTokenMatch(token: StudyToken, match: DictionaryMatch): void {
		selectedTokenEntryIds = {
			...selectedTokenEntryIds,
			[token.id]: match.entryId
		};
		selectionJustMadeTokenId = token.id;
		changingTokenId = null;
	}

	function changeTokenSelection(tokenId: string): void {
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
		return (
			selectedMatchForToken(token)?.pinyin?.trim() ||
			token.dictionaryMatches[0]?.pinyin?.trim() ||
			token.pinyin?.trim() ||
			''
		);
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
							disabled={savePending}
							class="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-300"
						>
							{savePending ? 'Saving…' : 'Finish editing text'}
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
																{#if token.pinyin}
																	<p class="text-[11px] text-zinc-300">{token.pinyin}</p>
																{/if}
															</div>

															{#if token.dictionaryMatches.length === 0}
																<p class="mt-2 text-zinc-300">No dictionary match found.</p>
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
																						<p class="mt-0.5 text-zinc-300">{match.pinyin}</p>
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
																							{selectedMatch.pinyin}
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
											onclick={() => toggleSentenceTranslationVisibility(sentence.id)}
											class="rounded-xl bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-800 ring-1 ring-zinc-200 transition hover:bg-zinc-200"
										>
											{visibleSentenceTranslations[sentence.id]
												? 'Hide translation'
												: 'Show translation'}
										</button>
										<button
											type="button"
											onclick={() => toggleSentencePinyinVisibility(sentence.id)}
											class="rounded-xl bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-800 ring-1 ring-zinc-200 transition hover:bg-zinc-200"
										>
											{visibleSentencePinyin[sentence.id] ? 'Hide pinyin' : 'Show pinyin'}
										</button>
										<button
											type="button"
											onclick={() => toggleSentenceSegmentationEditor(sentence.id)}
											class="rounded-xl bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-800 ring-1 ring-zinc-200 transition hover:bg-zinc-200"
										>
											Edit word separation
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
															onclick={() =>
																void applySentenceChanges(
																	sentence.id,
																	'Sentence translation saved.'
																)}
															disabled={savePending}
															class="rounded-xl bg-zinc-950 px-3 py-2 text-xs font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
														>
															{savePending ? 'Saving…' : 'Save translation'}
														</button>
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
												<span class="font-medium text-zinc-700"> 你 | 好 | ！</span>
											</p>
											<textarea
												value={sentenceSegmentationDrafts[sentence.id] ?? ''}
												oninput={(event) =>
													setSentenceSegmentationDraft(sentence.id, event.currentTarget.value)}
												rows="3"
												class="mt-2 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-950 outline-none transition focus:border-zinc-400 focus:bg-white"
											></textarea>
											<div class="mt-3 flex flex-wrap gap-2">
												<button
													type="button"
													onclick={() =>
														void applySentenceChanges(sentence.id, 'Word separation saved.')}
													disabled={savePending}
													class="rounded-xl bg-zinc-950 px-3 py-2 text-xs font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
												>
													{savePending ? 'Saving…' : 'Save word separation'}
												</button>
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

			<div class="mt-4 flex flex-wrap gap-3">
				<button
					type="button"
					onclick={() => void mapWholeTranslation()}
					disabled={savePending || wholeTranslation.trim().length === 0}
					class="rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-300"
				>
					{savePending ? 'Mapping…' : 'Map translation to sentences'}
				</button>
				<button
					type="button"
					onclick={() => void saveProgress()}
					disabled={savePending}
					class="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-300"
				>
					{savePending ? 'Saving…' : 'Save progress'}
				</button>
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
