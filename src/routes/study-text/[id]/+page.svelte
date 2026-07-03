<!-- eslint-disable svelte/no-navigation-without-resolve -->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type {
		StudySentence,
		StudyText,
		StudyToken,
		TranslationMappingResult
	} from '$lib/study-text/types';

	type PageData = {
		studyText: StudyText;
	};

	let { data }: { data: PageData } = $props();

	const studyText = $derived(data.studyText);
	const paragraphs = $derived(studyText.paragraphs);
	const sentences = $derived(studyText.sentences);
	const sentencesById = $derived(
		Object.fromEntries(sentences.map((sentence) => [sentence.id, sentence]))
	);

	let title = $state('');
	let wholeTranslation = $state('');
	let selectedSentenceIds = $state<string[]>([]);
	let sentenceTranslations = $state<Record<string, string>>({});
	let translationWarnings = $state<string[]>([]);
	let editingText = $state(false);
	let rawTextDraft = $state('');
	let savePending = $state(false);
	let message = $state<string | null>(null);
	let errorMessage = $state<string | null>(null);
	let initializedStudyId = $state('');

	$effect(() => {
		if (studyText.id === initializedStudyId) {
			return;
		}

		title = studyText.title;
		wholeTranslation = studyText.wholeTranslation ?? '';
		selectedSentenceIds = [...studyText.selectedSentenceIds];
		sentenceTranslations = Object.fromEntries(
			studyText.sentences.map((sentence) => [sentence.id, sentence.translation ?? ''])
		);
		translationWarnings = [];
		rawTextDraft = studyText.rawText;
		editingText = false;
		message = null;
		errorMessage = null;
		initializedStudyId = studyText.id;
	});

	const selectedSentenceCount = $derived(selectedSentenceIds.length);
	const selectedSentences = $derived(
		selectedSentenceIds
			.map((sentenceId) => sentencesById[sentenceId])
			.filter((sentence): sentence is StudySentence => Boolean(sentence))
	);

	function sentenceForParagraph(sentenceId: string): StudySentence | undefined {
		return sentencesById[sentenceId];
	}

	function toggleSentence(sentenceId: string): void {
		selectedSentenceIds = selectedSentenceIds.includes(sentenceId)
			? selectedSentenceIds.filter((id) => id !== sentenceId)
			: [...selectedSentenceIds, sentenceId];
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

			message = successMessage;
			await goto(`${resolve('/study-text')}/${payload.studyText.id}`, {
				replaceState: true,
				invalidateAll: true
			});
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
				selectedSentenceIds,
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

	async function saveProgress(): Promise<void> {
		await saveStudyText(
			{
				title,
				wholeTranslation,
				selectedSentenceIds,
				sentenceTranslations,
				status: 'in_progress'
			},
			'Progress saved.'
		);
	}

	function tokenClassName(token: StudyToken): string {
		if (token.kind === 'punctuation') {
			return 'bg-zinc-100 text-zinc-500 ring-zinc-200';
		}

		if (token.dictionaryMatches.length === 0) {
			return 'bg-amber-50 text-amber-900 ring-amber-200';
		}

		return 'bg-sky-50 text-sky-950 ring-sky-200';
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
	<meta name="description" content="Select sentences and prepare a study text for drilling." />
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
				This first version covers import, text parsing, sentence selection, and editable whole-text
				translation.
			</p>
		</header>

		<section class="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
			<div class="space-y-4">
				<section class="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-zinc-200 sm:p-6">
					<div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
						<div>
							<p class="text-lg font-semibold text-zinc-950">Source text</p>
							<p class="text-sm text-zinc-500">
								Edit the text, then finish editing to split paragraphs and sentences again.
							</p>
						</div>
						<div class="flex flex-wrap gap-3">
							<button
								type="button"
								onclick={() => openGoogleTranslate(studyText.rawText)}
								class="rounded-xl bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-800 ring-1 ring-zinc-200 transition hover:bg-zinc-200"
							>
								Open in Google Translate
							</button>
							{#if !editingText}
								<button
									type="button"
									onclick={startEditingText}
									class="rounded-xl bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800"
								>
									Edit text
								</button>
							{/if}
						</div>
					</div>

					<div class="mt-5 space-y-3">
						<label class="space-y-2">
							<span class="text-sm font-medium text-zinc-800">Title</span>
							<input
								type="text"
								bind:value={title}
								class="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-400 focus:bg-white"
							/>
						</label>

						{#if editingText}
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
						{:else}
							<div
								class="rounded-2xl bg-zinc-50 p-4 text-sm leading-7 text-zinc-800 ring-1 ring-zinc-200"
							>
								{#each studyText.rawText.split('\n') as line, index (index)}
									{#if line.trim().length === 0}
										<div class="h-4"></div>
									{:else}
										<p>{line}</p>
									{/if}
								{/each}
							</div>
						{/if}
					</div>
				</section>

				<section class="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-zinc-200 sm:p-6">
					<div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
						<div>
							<p class="text-lg font-semibold text-zinc-950">Sentence selection</p>
							<p class="text-sm text-zinc-500">
								Choose which sentences should be included in later study steps.
							</p>
						</div>
						<p class="text-sm text-zinc-500">
							Selected: {selectedSentenceCount} / {sentences.length}
						</p>
					</div>

					<div class="mt-5 space-y-4">
						{#each paragraphs as paragraph (paragraph.id)}
							<div class="rounded-2xl bg-zinc-50 p-4 ring-1 ring-zinc-200">
								<p class="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
									Paragraph {paragraph.index + 1}
								</p>
								<div class="mt-3 space-y-2">
									{#each paragraph.sentenceIds as sentenceId (sentenceId)}
										{@const sentence = sentenceForParagraph(sentenceId)}
										{#if sentence}
											<label class="flex gap-3 rounded-2xl bg-white p-3 ring-1 ring-zinc-200">
												<input
													type="checkbox"
													checked={selectedSentenceIds.includes(sentence.id)}
													onchange={() => toggleSentence(sentence.id)}
													class="mt-1 h-4 w-4 shrink-0 rounded border-zinc-300"
												/>
												<div class="space-y-1">
													<p class="text-sm text-zinc-800">{sentence.text}</p>
													<p class="text-xs text-zinc-500">Sentence #{sentence.globalIndex + 1}</p>
												</div>
											</label>
										{/if}
									{/each}
								</div>
							</div>
						{/each}
					</div>
				</section>
			</div>

			<div class="space-y-4">
				<section class="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-zinc-200 sm:p-6">
					<div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
						<div>
							<p class="text-lg font-semibold text-zinc-950">Whole-text translation</p>
							<p class="text-sm text-zinc-500">
								Paste or edit a full translation here. Sentence mapping comes in the next step.
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
					</div>

					{#if translationWarnings.length > 0}
						<div
							class="mt-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200"
						>
							<p class="font-medium">Translation mapping warnings</p>
							<ul class="mt-2 list-disc space-y-1 pl-5">
								{#each translationWarnings as warning, index (index)}
									<li>{warning}</li>
								{/each}
							</ul>
						</div>
					{/if}
				</section>

				<section class="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-zinc-200 sm:p-6">
					<p class="text-lg font-semibold text-zinc-950">Selected sentence preview</p>
					<p class="mt-1 text-sm text-zinc-500">
						This is the subset that later segmentation and lookup will use. You can also adjust
						sentence-level translations here.
					</p>

					{#if selectedSentences.length === 0}
						<p class="mt-5 text-sm text-zinc-500">No selected sentences yet.</p>
					{:else}
						<div class="mt-5 space-y-3">
							{#each selectedSentences as sentence (sentence.id)}
								<div class="rounded-2xl bg-zinc-50 p-3 text-sm text-zinc-800 ring-1 ring-zinc-200">
									<div class="flex flex-wrap items-center justify-between gap-2">
										<p>{sentence.text}</p>
										<button
											type="button"
											onclick={() => openGoogleTranslate(sentence.text)}
											class="rounded-xl bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 ring-1 ring-zinc-200 transition hover:bg-zinc-100"
										>
											Google Translate
										</button>
									</div>

									<div class="mt-3">
										<p class="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
											Auto segmentation
										</p>
										<div class="mt-2 flex flex-wrap gap-2">
											{#each sentence.segmentation.tokens as token (token.id)}
												<span class="group relative inline-flex">
													<button
														type="button"
														class={`inline-flex items-center rounded-xl px-2.5 py-1 text-sm ring-1 ${tokenClassName(token)}`}
													>
														{token.text}
													</button>

													{#if token.kind === 'word'}
														<div
															class="pointer-events-none absolute left-0 top-full z-20 hidden w-80 max-w-[85vw] pt-2 group-hover:block group-focus-within:block"
														>
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
																{:else}
																	<div class="mt-2 space-y-2">
																		{#each token.dictionaryMatches.slice(0, 4) as match (match.entryId)}
																			<div class="rounded-xl bg-white/5 p-2 ring-1 ring-white/10">
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
																					{#each match.definitions.slice(0, 4) as definition, definitionIndex (definitionIndex)}
																						<li>{definition}</li>
																					{/each}
																				</ul>
																			</div>
																		{/each}
																		{#if token.dictionaryMatches.length > 4}
																			<p class="text-zinc-400">
																				+{token.dictionaryMatches.length - 4} more match(es)
																			</p>
																		{/if}
																	</div>
																{/if}
															</div>
														</div>
													{/if}
												</span>
											{/each}
										</div>
									</div>

									<textarea
										value={sentenceTranslations[sentence.id] ?? ''}
										oninput={(event) =>
											setSentenceTranslation(sentence.id, event.currentTarget.value)}
										rows="3"
										placeholder="Sentence translation"
										class="mt-3 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-950 outline-none transition focus:border-zinc-400"
									></textarea>
								</div>
							{/each}
						</div>
					{/if}
				</section>

				<section class="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-zinc-200 sm:p-6">
					<div class="flex flex-wrap gap-3">
						<button
							type="button"
							onclick={() => void saveProgress()}
							disabled={savePending}
							class="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-300"
						>
							{savePending ? 'Saving…' : 'Save progress'}
						</button>

						{#if studyText.relatedDrillId}
							<a
								href={`${resolve('/drill')}?id=${studyText.relatedDrillId}`}
								class="rounded-xl bg-zinc-100 px-4 py-3 text-sm font-medium text-zinc-800 ring-1 ring-zinc-200 transition hover:bg-zinc-200"
							>
								Open related drill
							</a>
						{/if}
					</div>

					{#if message}
						<p class="mt-4 text-sm text-emerald-700">{message}</p>
					{/if}
					{#if errorMessage}
						<p class="mt-2 text-sm text-red-600">{errorMessage}</p>
					{/if}
				</section>
			</div>
		</section>
	</div>
</div>
