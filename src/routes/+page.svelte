<script lang="ts">
	import { onMount } from 'svelte';
	import AttemptStrip from '$lib/components/AttemptStrip.svelte';
	import CharacterResultBox from '$lib/components/CharacterResultBox.svelte';
	import CharacterStrokeOrderRow from '$lib/components/CharacterStrokeOrderRow.svelte';
	import DrawingCanvas from '$lib/components/DrawingCanvas.svelte';
	import TrainingBox from '$lib/components/TrainingBox.svelte';
	import { sendDevLog } from '$lib/client/devLog';
	import { createAttemptId, getOrCreateSessionId } from '$lib/client/ids';
	import { validateAttempt } from '$lib/client/validateAttempt';
	import { DATA_VERSION } from '$lib/config/app';
	import { cards } from '$lib/data/cards';
	import { getMissingStrokeDataChars, getTargetCharacter } from '$lib/hanzi/loadHanziData';
	import { createQueue, createQueueSeed } from '$lib/practice/createQueue';
	import type { WordAttempt, UserCharacterAttempt, WordCard } from '$lib/practice/types';
	import type { CharacterValidationResult, WordValidationResult } from '$lib/validation/types';

	const cardIds = cards.map((card) => card.id);
	const uniqueChars = [...new Set(cards.flatMap((card) => Array.from(card.hanzi)))].sort();
	const uniqueHanziCount = uniqueChars.length;
	const missingStrokeDataChars = getMissingStrokeDataChars(uniqueChars);

	type LogOverrides = {
		attemptId?: string | null;
		cardId?: string | null;
	};

	type PracticeMode = 'attempting' | 'validating' | 'result';

	let sessionId = $state('');
	let attemptId = $state('');
	let queueSeed = $state('');
	let queue = $state<WordCard[]>([]);
	let currentIndex = $state(0);
	let startedAtClient = $state('');
	let ready = $state(false);
	let lastLogError = $state<string | null>(null);
	let navigationPending = $state(false);
	let practiceMode = $state<PracticeMode>('attempting');
	let resultShownAt = $state('');
	let completedCharacters = $state<UserCharacterAttempt[]>([]);
	let currentCharacter = $state<UserCharacterAttempt>({ id: 'pending', strokes: [] });
	let lastSubmittedAttempt = $state<WordAttempt | null>(null);
	let currentResult = $state<WordValidationResult | null>(null);
	let selectedTrainingCharacterIndex = $state(0);

	const currentCard = $derived(queue[currentIndex] ?? null);
	const remainingCards = $derived(Math.max(0, queue.length - currentIndex - 1));
	const activeCharacterIndex = $derived(completedCharacters.length);
	const currentStrokeCount = $derived(currentCharacter.strokes.length);
	const totalStrokeCount = $derived(
		completedCharacters.reduce((total, character) => total + character.strokes.length, 0) +
			currentCharacter.strokes.length
	);
	const canFinish = $derived(completedCharacters.length > 0 || currentCharacter.strokes.length > 0);

	function createEmptyCharacterAttempt(
		nextAttemptId: string,
		characterIndex: number
	): UserCharacterAttempt {
		return {
			id: `char_${nextAttemptId}_${characterIndex}`,
			strokes: []
		};
	}

	function countDrawnCharacters(): number {
		return completedCharacters.length + (currentCharacter.strokes.length > 0 ? 1 : 0);
	}

	function buildCurrentAttempt(): WordAttempt | null {
		if (!currentCard) {
			return null;
		}

		return {
			cardId: currentCard.id,
			characters: [
				...completedCharacters,
				...(currentCharacter.strokes.length > 0 ? [currentCharacter] : [])
			]
		};
	}

	function getElapsedMs(fromIso: string): number {
		const from = Date.parse(fromIso);
		return Number.isNaN(from) ? 0 : Math.max(0, Date.now() - from);
	}

	function getResultCharacters(): UserCharacterAttempt[] {
		return lastSubmittedAttempt?.characters ?? [];
	}

	function getResultUserCharacter(index: number): UserCharacterAttempt | undefined {
		return getResultCharacters()[index];
	}

	function isTrainableCharacterResult(characterResult: CharacterValidationResult): boolean {
		return Boolean(characterResult.targetChar && getTargetCharacter(characterResult.targetChar));
	}

	function getDefaultTrainingCharacterIndex(result: WordValidationResult): number {
		const preferredCharacter = result.characterResults.find(
			(characterResult) =>
				isTrainableCharacterResult(characterResult) && characterResult.status !== 'ok'
		);

		if (preferredCharacter) {
			return preferredCharacter.userCharacterIndex;
		}

		const fallbackCharacter = result.characterResults.find((characterResult) =>
			isTrainableCharacterResult(characterResult)
		);

		return fallbackCharacter?.userCharacterIndex ?? 0;
	}

	function getSelectedTrainingCharacterResult(): CharacterValidationResult | null {
		return (
			currentResult?.characterResults.find(
				(characterResult) => characterResult.userCharacterIndex === selectedTrainingCharacterIndex
			) ?? null
		);
	}

	async function selectTrainingCharacter(characterIndex: number): Promise<void> {
		const nextCharacterResult = currentResult?.characterResults.find(
			(characterResult) => characterResult.userCharacterIndex === characterIndex
		);

		if (!nextCharacterResult || !isTrainableCharacterResult(nextCharacterResult)) {
			return;
		}

		selectedTrainingCharacterIndex = characterIndex;

		await logEvent('training_character_selected', {
			attemptId,
			cardId: currentCard?.id,
			characterIndex,
			targetChar: nextCharacterResult.targetChar,
			previousStatus: nextCharacterResult.status
		});
	}

	async function logEvent(
		event: string,
		payload: unknown,
		overrides: LogOverrides = {}
	): Promise<void> {
		if (!sessionId) {
			return;
		}

		const resolvedAttemptId =
			overrides.attemptId === undefined ? attemptId : (overrides.attemptId ?? undefined);
		const resolvedCardId =
			overrides.cardId === undefined ? currentCard?.id : (overrides.cardId ?? undefined);

		try {
			await sendDevLog({
				event,
				sessionId,
				attemptId: resolvedAttemptId,
				cardId: resolvedCardId,
				payload
			});
			lastLogError = null;
		} catch (error) {
			lastLogError = error instanceof Error ? error.message : 'Unknown log error';
			console.error(error);
		}
	}

	function generateQueue(): { seed: string; queue: WordCard[] } {
		const seed = createQueueSeed();
		return { seed, queue: createQueue(cards, seed) };
	}

	async function beginAttempt(card: WordCard): Promise<void> {
		const nextAttemptId = createAttemptId();
		const started = new Date().toISOString();

		attemptId = nextAttemptId;
		startedAtClient = started;
		practiceMode = 'attempting';
		resultShownAt = '';
		completedCharacters = [];
		currentCharacter = createEmptyCharacterAttempt(nextAttemptId, 0);
		lastSubmittedAttempt = null;
		currentResult = null;

		await logEvent(
			'card_presented',
			{
				cardId: card.id,
				translation: card.translation,
				targetHanzi: card.hanzi,
				targetCharCount: Array.from(card.hanzi).length,
				targetChars: Array.from(card.hanzi)
			},
			{ attemptId: nextAttemptId, cardId: card.id }
		);

		await logEvent(
			'attempt_started',
			{
				attemptId: nextAttemptId,
				cardId: card.id,
				startedAtClient: started
			},
			{ attemptId: nextAttemptId, cardId: card.id }
		);
	}

	async function initializeSession(): Promise<void> {
		await logEvent(
			'session_started',
			{
				route: window.location.pathname,
				viewport: {
					width: window.innerWidth,
					height: window.innerHeight
				},
				pointerSupport: {
					touch: navigator.maxTouchPoints > 0,
					pen: 'PointerEvent' in window,
					mouse: window.matchMedia('(pointer:fine)').matches
				},
				dataVersion: DATA_VERSION
			},
			{ attemptId: null, cardId: null }
		);

		await logEvent(
			'cards_loaded',
			{
				cardCount: cards.length,
				cardIds,
				uniqueHanziCount,
				missingStrokeDataChars
			},
			{ attemptId: null, cardId: null }
		);

		const generated = generateQueue();
		queueSeed = generated.seed;
		queue = generated.queue;
		currentIndex = 0;

		await logEvent(
			'queue_created',
			{
				queueSeed: generated.seed,
				queueCardIds: generated.queue.map((card) => card.id)
			},
			{ attemptId: null, cardId: null }
		);

		const firstCard = generated.queue[0];
		if (firstCard) {
			await beginAttempt(firstCard);
		}
	}

	async function drawNextCharacter(): Promise<void> {
		if (!attemptId || currentCharacter.strokes.length === 0 || practiceMode !== 'attempting') {
			return;
		}

		const previousCharacter = currentCharacter;
		const fromCharacterIndex = completedCharacters.length;
		const nextCompletedCharacters = [...completedCharacters, previousCharacter];
		const nextActiveCharacterIndex = nextCompletedCharacters.length;

		completedCharacters = nextCompletedCharacters;
		currentCharacter = createEmptyCharacterAttempt(attemptId, nextActiveCharacterIndex);

		await logEvent('draw_next_pressed', {
			attemptId,
			fromCharacterIndex,
			toCharacterIndex: nextActiveCharacterIndex,
			previousCharacterStrokeCount: previousCharacter.strokes.length,
			characterCountAfter: nextCompletedCharacters.length + 1,
			validationTriggered: false
		});
	}

	async function finishAttempt(): Promise<void> {
		if (!currentCard || !attemptId || !canFinish || practiceMode !== 'attempting') {
			return;
		}

		const attempt = buildCurrentAttempt();
		if (!attempt) {
			return;
		}

		lastSubmittedAttempt = attempt;
		practiceMode = 'validating';

		await logEvent('finish_pressed', {
			attemptId,
			cardId: currentCard.id,
			drawnCharacterCount: attempt.characters.length,
			totalStrokeCount: attempt.characters.reduce(
				(total, character) => total + character.strokes.length,
				0
			),
			characterStrokeCounts: attempt.characters.map((character) => character.strokes.length),
			elapsedMs: getElapsedMs(startedAtClient)
		});

		try {
			const result = await validateAttempt({
				sessionId,
				attemptId,
				cardId: currentCard.id,
				attempt
			});

			currentResult = result;
			selectedTrainingCharacterIndex = getDefaultTrainingCharacterIndex(result);
			practiceMode = 'result';
			resultShownAt = new Date().toISOString();

			await logEvent('result_shown', {
				attemptId,
				cardId: currentCard.id,
				status: result.status,
				validationStage: result.validationStage,
				revealedHanzi: result.targetHanzi,
				feedbackItemCount: result.userCharacterCount
			});
		} catch (error) {
			practiceMode = 'attempting';
			lastLogError = error instanceof Error ? error.message : 'Validation failed';
			void logEvent('client_error_reported', {
				message: error instanceof Error ? error.message : 'Validation failed',
				component: 'finishAttempt',
				attemptId,
				cardId: currentCard.id
			});
		}
	}

	async function goToNextCard(): Promise<void> {
		if (!currentCard || navigationPending || practiceMode === 'validating') {
			return;
		}

		navigationPending = true;

		const previousCard = currentCard;
		const previousAttemptId = attemptId;

		if (practiceMode === 'result' && currentResult) {
			await logEvent(
				'next_card_pressed',
				{
					attemptId: previousAttemptId,
					cardId: previousCard.id,
					resultStatus: currentResult.status,
					elapsedOnResultMs: resultShownAt ? getElapsedMs(resultShownAt) : 0
				},
				{ attemptId: previousAttemptId, cardId: previousCard.id }
			);
		} else {
			await logEvent(
				'next_card_pressed',
				{
					fromCardId: previousCard.id,
					fromQueueIndex: currentIndex,
					remainingCards
				},
				{ attemptId: previousAttemptId, cardId: previousCard.id }
			);

			await logEvent(
				'attempt_abandoned',
				{
					attemptId: previousAttemptId,
					cardId: previousCard.id,
					drawnCharacterCount: countDrawnCharacters(),
					totalStrokeCount,
					reason: 'new_card'
				},
				{ attemptId: previousAttemptId, cardId: previousCard.id }
			);
		}

		let nextQueue = queue;
		let nextSeed = queueSeed;
		let nextIndex = currentIndex + 1;

		if (nextIndex >= queue.length) {
			const generated = generateQueue();
			nextQueue = generated.queue;
			nextSeed = generated.seed;
			nextIndex = 0;
			queueSeed = nextSeed;
			queue = nextQueue;

			await logEvent(
				'queue_created',
				{
					queueSeed: nextSeed,
					queueCardIds: nextQueue.map((card) => card.id)
				},
				{ attemptId: null, cardId: null }
			);
		}

		queue = nextQueue;
		queueSeed = nextSeed;
		currentIndex = nextIndex;

		const nextCard = nextQueue[nextIndex];
		if (nextCard) {
			await beginAttempt(nextCard);
		}

		navigationPending = false;
	}

	onMount(() => {
		sessionId = getOrCreateSessionId();
		ready = true;

		const reportClientError = (event: ErrorEvent) => {
			void logEvent('client_error_reported', {
				message: event.message,
				stack: event.error instanceof Error ? event.error.stack : undefined,
				component: '+page.svelte',
				attemptId,
				cardId: currentCard?.id
			});
		};

		const reportUnhandledRejection = (event: PromiseRejectionEvent) => {
			void logEvent('client_error_reported', {
				message: 'Unhandled promise rejection',
				stack: event.reason instanceof Error ? event.reason.stack : undefined,
				component: '+page.svelte',
				attemptId,
				cardId: currentCard?.id,
				reason: event.reason
			});
		};

		window.addEventListener('error', reportClientError);
		window.addEventListener('unhandledrejection', reportUnhandledRejection);
		void initializeSession();

		return () => {
			window.removeEventListener('error', reportClientError);
			window.removeEventListener('unhandledrejection', reportUnhandledRejection);

			if (sessionId && currentCard && attemptId && practiceMode === 'attempting') {
				void sendDevLog({
					event: 'attempt_abandoned',
					sessionId,
					attemptId,
					cardId: currentCard.id,
					payload: {
						attemptId,
						cardId: currentCard.id,
						drawnCharacterCount: countDrawnCharacters(),
						totalStrokeCount,
						reason: 'navigation'
					}
				});
			}
		};
	});
</script>

<svelte:head>
	<title>Hanzi Practice</title>
	<meta
		name="description"
		content="Translation-prompted Hanzi recall practice with server-side development logging."
	/>
</svelte:head>

<div class="min-h-screen bg-zinc-100 text-zinc-950">
	<div class="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-6 py-10">
		<header class="space-y-2">
			<p class="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">Hanzi Practice</p>
			<h1 class="text-3xl font-semibold">Translation-prompted recall</h1>
			<p class="text-sm text-zinc-600">
				Finish is live now. The server validates character counts and returns a first result screen.
			</p>
		</header>

		{#if ready && currentCard}
			<section class="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
				<div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
					<div>
						<p class="text-sm text-zinc-500">Prompt</p>
						<p class="mt-2 text-4xl font-semibold tracking-tight">{currentCard.translation}</p>
						<p class="mt-2 text-sm text-zinc-500">
							Hanzi and character count remain hidden during the attempt.
						</p>
					</div>
					<div class="text-sm text-zinc-500 md:text-right">
						<p>Card {currentIndex + 1} / {queue.length}</p>
						<p>{remainingCards} remaining in queue</p>
						<p class="mt-2">Mode: {practiceMode}</p>
					</div>
				</div>

				{#if practiceMode === 'attempting' || practiceMode === 'validating'}
					<div class="mt-6 space-y-4">
						<AttemptStrip {completedCharacters} activeCharacter={currentCharacter} />

						<div class="grid gap-6 lg:grid-cols-[auto_1fr]">
							<div class="flex justify-center lg:justify-start">
								{#key `${attemptId}:${currentCharacter.id}`}
									<DrawingCanvas
										{attemptId}
										initialCharacter={currentCharacter}
										characterIndex={activeCharacterIndex}
										onCharacterChange={(character) => {
											currentCharacter = character;
										}}
										onLogEvent={logEvent}
									/>
								{/key}
							</div>

							<div class="flex flex-col gap-3">
								<button
									type="button"
									onclick={drawNextCharacter}
									disabled={currentStrokeCount === 0 || practiceMode !== 'attempting'}
									class="rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-300"
								>
									Draw next
								</button>
								<button
									type="button"
									onclick={finishAttempt}
									disabled={!canFinish || practiceMode !== 'attempting'}
									class="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-300"
								>
									{practiceMode === 'validating' ? 'Validating…' : 'Finish'}
								</button>
								<button
									type="button"
									onclick={goToNextCard}
									disabled={navigationPending || practiceMode === 'validating'}
									class="rounded-xl bg-zinc-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
								>
									{navigationPending ? 'Loading…' : 'Skip / next card'}
								</button>
								<div class="rounded-xl bg-zinc-100 px-4 py-3 text-sm text-zinc-600">
									<p class="font-medium text-zinc-800">Current attempt</p>
									<p class="mt-1 break-all">{attemptId}</p>
									<p class="mt-3 text-zinc-500">Started: {startedAtClient || 'pending'}</p>
								</div>
								<div class="rounded-xl bg-zinc-100 px-4 py-3 text-sm text-zinc-600">
									<p class="font-medium text-zinc-800">Attempt summary</p>
									<p class="mt-1 text-zinc-500">
										Completed characters: {completedCharacters.length}
									</p>
									<p class="mt-1 text-zinc-500">Active strokes: {currentStrokeCount}</p>
									<p class="mt-1 text-zinc-500">Total strokes: {totalStrokeCount}</p>
									<p class="mt-1 text-zinc-500">Drawn characters: {countDrawnCharacters()}</p>
								</div>
							</div>
						</div>
					</div>
				{:else if practiceMode === 'result' && currentResult}
					<div class="mt-6 space-y-4">
						<div class="rounded-2xl bg-emerald-50 p-5 ring-1 ring-emerald-200">
							<p class="text-sm font-medium text-emerald-800">Result</p>
							<p class="mt-2 text-3xl font-semibold text-emerald-950">
								{currentResult.targetHanzi}
							</p>
							<p class="mt-2 text-sm text-emerald-900">{currentResult.message}</p>
							<p class="mt-3 text-sm text-emerald-900">
								Status: {currentResult.status} · Validation stage: {currentResult.validationStage}
							</p>
							<p class="mt-1 text-sm text-emerald-900">
								Character count: {currentResult.userCharacterCount} / {currentResult.targetCharacterCount}
							</p>
						</div>

						<div class="flex flex-wrap gap-4">
							{#each currentResult.characterResults as characterResult (characterResult.userCharacterIndex)}
								<button
									type="button"
									onclick={() => void selectTrainingCharacter(characterResult.userCharacterIndex)}
									disabled={!isTrainableCharacterResult(characterResult)}
									aria-pressed={characterResult.userCharacterIndex ===
										selectedTrainingCharacterIndex}
									class={`rounded-3xl transition ${
										characterResult.userCharacterIndex === selectedTrainingCharacterIndex
											? 'ring-2 ring-blue-400 ring-offset-2'
											: 'ring-0'
									} ${
										isTrainableCharacterResult(characterResult)
											? 'cursor-pointer'
											: 'cursor-not-allowed opacity-70'
									}`}
								>
									<CharacterResultBox
										{characterResult}
										userCharacter={getResultUserCharacter(characterResult.userCharacterIndex)}
									/>
								</button>
							{/each}
						</div>

						{#if getSelectedTrainingCharacterResult()}
							{#key `${attemptId}:${selectedTrainingCharacterIndex}`}
								<TrainingBox
									{attemptId}
									characterResult={getSelectedTrainingCharacterResult()!}
									onLogEvent={logEvent}
								/>
							{/key}
						{/if}

						<div class="space-y-3">
							<p class="text-sm font-medium text-zinc-800">Stroke order visualization</p>
							{#each currentResult.characterResults as characterResult (characterResult.userCharacterIndex)}
								<CharacterStrokeOrderRow {characterResult} />
							{/each}
						</div>

						<div class="flex flex-wrap gap-3">
							<button
								type="button"
								onclick={goToNextCard}
								class="rounded-xl bg-zinc-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-zinc-800"
							>
								Next card
							</button>
						</div>
					</div>
				{/if}
			</section>
		{:else}
			<section class="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
				<p class="text-zinc-600">Loading cards…</p>
			</section>
		{/if}

		<section class="grid gap-4 md:grid-cols-2">
			<div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
				<p class="text-sm font-medium text-zinc-800">Logging</p>
				<p class="mt-2 text-sm text-zinc-600">
					POST /api/dev-log appends JSONL to <code>logs/dev-current.jsonl</code>.
				</p>
				<p class="mt-3 text-sm text-zinc-600">
					Finish now logs <code>finish_pressed</code>, and the server logs
					<code>validation_started</code>, <code>word_count_validated</code>, and
					<code>validation_completed</code>.
				</p>
				{#if lastLogError}
					<p class="mt-3 text-sm text-red-600">Last log error: {lastLogError}</p>
				{:else}
					<p class="mt-3 text-sm text-emerald-700">Client and server event logging are active.</p>
				{/if}
			</div>

			<div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
				<p class="text-sm font-medium text-zinc-800">Session</p>
				<p class="mt-2 break-all text-sm text-zinc-600">{sessionId || 'Starting session…'}</p>
				<p class="mt-3 text-sm text-zinc-500">Queue seed: {queueSeed || 'pending'}</p>
				<p class="mt-1 text-sm text-zinc-500">Attempt started: {startedAtClient || 'pending'}</p>
			</div>
		</section>
	</div>
</div>
