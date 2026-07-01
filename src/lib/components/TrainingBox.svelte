<script lang="ts">
	import { onMount } from 'svelte';
	import DrawingCanvas from '$lib/components/DrawingCanvas.svelte';
	import { getHanziStrokeDataContext } from '$lib/hanzi/context';
	import type { UserCharacterAttempt } from '$lib/practice/types';
	import { compareCharacter } from '$lib/scoring/compareCharacter';
	import type { CharacterValidationResult, StrokeMatchStatus } from '$lib/validation/types';

	type LogEvent = (event: string, payload: unknown) => Promise<void> | void;

	type Props = {
		attemptId: string;
		characterResult: CharacterValidationResult;
		onLogEvent: LogEvent;
	};

	let { attemptId, characterResult, onLogEvent }: Props = $props();

	const hanziStrokeData = getHanziStrokeDataContext();
	const targetCharacter = $derived(
		characterResult.targetChar ? hanziStrokeData[characterResult.targetChar] : undefined
	);

	function createTrainingCharacter(): UserCharacterAttempt {
		return {
			id: `training_${attemptId}_${characterResult.userCharacterIndex}`,
			strokes: []
		};
	}

	function evaluateCharacter(character: UserCharacterAttempt): CharacterValidationResult | null {
		return targetCharacter
			? compareCharacter(targetCharacter, character, characterResult.userCharacterIndex)
			: null;
	}

	let trainingCharacter = $state<UserCharacterAttempt>(createTrainingCharacter());
	let showHint = $state(true);
	const liveResult = $derived(evaluateCharacter(trainingCharacter));

	function strokeStatuses(
		result: CharacterValidationResult | null
	): Array<StrokeMatchStatus | undefined> {
		if (!result) {
			return [];
		}

		return Array.from(
			{ length: trainingCharacter.strokes.length },
			(_, index) =>
				result.strokeResults.find((strokeResult) => strokeResult.userStrokeIndex === index)?.status
		);
	}

	function handleTrainingCharacterChange(nextCharacter: UserCharacterAttempt): void {
		const nextResult = evaluateCharacter(nextCharacter);
		const previousStatus = liveResult?.status;

		trainingCharacter = nextCharacter;

		if (!nextResult) {
			return;
		}

		void onLogEvent('training_stroke_evaluated', {
			attemptId,
			characterIndex: characterResult.userCharacterIndex,
			targetChar: characterResult.targetChar,
			userStrokeCount: nextCharacter.strokes.length,
			status: nextResult.status,
			matchedStrokeCount: nextResult.matchedStrokeCount,
			missingStrokeCount: nextResult.missingStrokeCount,
			extraStrokeCount: nextResult.extraStrokeCount,
			wrongDirectionCount: nextResult.wrongDirectionCount,
			wrongOrderCount: nextResult.wrongOrderCount,
			badShapeCount: nextResult.badShapeCount
		});

		if (nextResult.status === 'ok' && previousStatus !== 'ok') {
			void onLogEvent('training_completed', {
				attemptId,
				characterIndex: characterResult.userCharacterIndex,
				targetChar: characterResult.targetChar,
				userStrokeCount: nextCharacter.strokes.length
			});
		}
	}

	onMount(() => {
		void onLogEvent('training_opened', {
			attemptId,
			characterIndex: characterResult.userCharacterIndex,
			targetChar: characterResult.targetChar,
			targetStrokeCount: characterResult.targetStrokeCount
		});
	});
</script>

<div class="rounded-2xl bg-white p-4 ring-1 ring-zinc-200 sm:p-5">
	<div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
		<div>
			<p class="text-sm font-medium text-zinc-800">Training</p>
			<p class="mt-1 text-xl font-semibold text-zinc-950 sm:text-2xl">
				Character #{characterResult.userCharacterIndex + 1} · {characterResult.targetChar ||
					'(extra)'}
			</p>
			<p class="mt-1 text-sm text-zinc-500">
				{showHint
					? 'Target stays visible in gray. Your strokes are evaluated after each stroke.'
					: 'Hint is hidden. Your strokes are still evaluated after each stroke.'}
			</p>
		</div>

		{#if liveResult}
			<div class="rounded-xl bg-zinc-100 px-3 py-3 text-xs text-zinc-700 sm:px-4 sm:text-sm">
				<p class="font-medium text-zinc-900">Live feedback</p>
				<p class="mt-1">Status: {liveResult.status}</p>
				<p class="mt-1">Matched: {liveResult.matchedStrokeCount}/{liveResult.targetStrokeCount}</p>
				<p class="mt-1">Bad shape: {liveResult.badShapeCount}</p>
				<p class="mt-1">Wrong direction: {liveResult.wrongDirectionCount}</p>
				<p class="mt-1">Wrong order: {liveResult.wrongOrderCount}</p>
				<p class="mt-1">Missing: {liveResult.missingStrokeCount}</p>
				<p class="mt-1">Extra: {liveResult.extraStrokeCount}</p>
			</div>
		{/if}
	</div>

	{#if targetCharacter && liveResult}
		<div class="mt-3 flex flex-wrap gap-2 sm:mt-4 sm:gap-3">
			<button
				type="button"
				onclick={() => {
					showHint = !showHint;
				}}
				class="rounded-xl bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-800 ring-1 ring-zinc-200 transition hover:bg-zinc-200 sm:px-4"
			>
				{showHint ? 'Hide background hint' : 'Show background hint'}
			</button>
		</div>

		<div class="mt-3 grid gap-3 lg:grid-cols-[auto_1fr] lg:gap-6">
			<div class="flex justify-center lg:justify-start">
				{#key trainingCharacter.id}
					<DrawingCanvas
						{attemptId}
						initialCharacter={trainingCharacter}
						characterIndex={characterResult.userCharacterIndex}
						targetChar={characterResult.targetChar}
						showTargetBackground={showHint}
						targetBackgroundColor="#d4d4d8"
						committedStrokeStatuses={strokeStatuses(liveResult)}
						onCharacterChange={handleTrainingCharacterChange}
						onLogEvent={(event, payload) => onLogEvent(`training_${event}`, payload)}
					/>
				{/key}
			</div>

			<div class="space-y-2 sm:space-y-3">
				<div
					class="rounded-xl bg-zinc-50 px-3 py-3 text-sm text-zinc-600 ring-1 ring-zinc-200 sm:px-4"
				>
					<p class="font-medium text-zinc-900">Stroke colors</p>
					<p class="mt-2"><span class="font-medium text-emerald-600">Green</span> = matched</p>
					<p class="mt-1"><span class="font-medium text-yellow-500">Yellow</span> = bad shape</p>
					<p class="mt-1">
						<span class="font-medium text-purple-500">Purple</span> = wrong direction
					</p>
					<p class="mt-1">
						<span class="font-medium text-red-500">Red</span> = wrong order or extra
					</p>
				</div>

				<div
					class="rounded-xl bg-zinc-50 px-3 py-3 text-sm text-zinc-600 ring-1 ring-zinc-200 sm:px-4"
				>
					<p class="font-medium text-zinc-900">Tip</p>
					<p class="mt-2">
						Undo or clear to retry. You can practice with the gray target visible or hide it for a
						blank canvas.
					</p>
				</div>
			</div>
		</div>
	{:else}
		<p class="mt-4 text-sm text-zinc-500">Training is unavailable for this character.</p>
	{/if}
</div>
