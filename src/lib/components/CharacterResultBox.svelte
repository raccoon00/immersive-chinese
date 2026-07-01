<script lang="ts">
	import { getTargetCharacter } from '$lib/hanzi/loadHanziData';
	import type { UserCharacterAttempt } from '$lib/practice/types';
	import type {
		CharacterValidationResult,
		StrokeMatchStatus,
		StrokeValidationResult
	} from '$lib/validation/types';

	type Props = {
		characterResult: CharacterValidationResult;
		userCharacter?: UserCharacterAttempt;
		maxVisibleUserStrokes?: number;
		showSummary?: boolean;
		size?: 'sm' | 'md';
		label?: string;
	};

	let {
		characterResult,
		userCharacter,
		maxVisibleUserStrokes,
		showSummary = true,
		size = 'md',
		label
	}: Props = $props();

	const targetCharacter = $derived(
		characterResult.targetChar ? getTargetCharacter(characterResult.targetChar) : undefined
	);
	const visibleUserStrokes = $derived(
		userCharacter
			? userCharacter.strokes.slice(0, maxVisibleUserStrokes ?? userCharacter.strokes.length)
			: []
	);
	const sizeClasses = $derived(
		size === 'sm'
			? {
					wrapper: 'w-24',
					frame: 'rounded-2xl p-2',
					canvas: 'h-20 w-20 rounded-xl',
					strokeWidth: 20,
					text: 'text-xs'
				}
			: {
					wrapper: 'w-40',
					frame: 'rounded-3xl p-3',
					canvas: 'h-36 w-36 rounded-2xl',
					strokeWidth: 28,
					text: 'text-sm'
				}
	);

	function userStrokeColor(status: StrokeMatchStatus | undefined): string {
		switch (status) {
			case 'matched':
				return '#22c55e';
			case 'bad_shape':
				return '#eab308';
			case 'wrong_direction':
				return '#a855f7';
			case 'extra':
				return '#ef4444';
			default:
				return '#18181b';
		}
	}

	function targetStrokeColor(targetStrokeIndex: number): string {
		const strokeResult = characterResult.strokeResults.find(
			(result) => result.targetStrokeIndex === targetStrokeIndex
		);

		return strokeResult?.status === 'missing' ? '#ef4444' : '#d4d4d8';
	}

	function userStrokeResult(userStrokeIndex: number): StrokeValidationResult | undefined {
		return characterResult.strokeResults.find(
			(result) => result.userStrokeIndex === userStrokeIndex
		);
	}

	function toPolylinePoints(points: Array<{ x: number; y: number }>): string {
		return points.map((point) => `${point.x * 1024},${point.y * 1024}`).join(' ');
	}
</script>

<div class={`${sizeClasses.wrapper} shrink-0 space-y-2`}>
	<div class={`${sizeClasses.frame} bg-white shadow-sm ring-1 ring-zinc-200`}>
		<svg viewBox="0 0 1024 1024" class={`${sizeClasses.canvas} bg-zinc-50`}>
			{#if targetCharacter}
				<g transform="translate(0 900) scale(1 -1)">
					{#each targetCharacter.strokes as stroke (stroke.index)}
						<path d={stroke.svgPath} fill={targetStrokeColor(stroke.index)} fill-opacity="0.5" />
					{/each}
				</g>
			{/if}

			{#each visibleUserStrokes as stroke, index (index)}
				<polyline
					points={toPolylinePoints(stroke.processed ?? stroke.points)}
					fill="none"
					stroke={userStrokeColor(userStrokeResult(index)?.status)}
					stroke-width={sizeClasses.strokeWidth}
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			{/each}
		</svg>
	</div>

	{#if label}
		<p class={`px-1 text-center ${sizeClasses.text} text-zinc-500`}>{label}</p>
	{/if}

	{#if showSummary}
		<div class={`space-y-1 px-1 ${sizeClasses.text} text-zinc-600`}>
			<p class="font-medium text-zinc-900">
				{characterResult.targetChar || '(extra)'} — {characterResult.status}
			</p>
			<p>matched {characterResult.matchedStrokeCount}/{characterResult.targetStrokeCount}</p>
			<p>bad {characterResult.badShapeCount} · wrong dir {characterResult.wrongDirectionCount}</p>
			<p>missing {characterResult.missingStrokeCount} · extra {characterResult.extraStrokeCount}</p>
		</div>
	{/if}
</div>
