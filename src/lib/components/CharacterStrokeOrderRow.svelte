<script lang="ts">
	import CharacterStrokeOrderPreview from '$lib/components/CharacterStrokeOrderPreview.svelte';
	import { getTargetCharacter } from '$lib/hanzi/loadHanziData';
	import type { CharacterValidationResult } from '$lib/validation/types';

	type Props = {
		characterResult: CharacterValidationResult;
	};

	let { characterResult }: Props = $props();

	const targetCharacter = $derived(
		characterResult.targetChar ? getTargetCharacter(characterResult.targetChar) : undefined
	);
	const visibleStrokeCount = $derived(targetCharacter?.strokes.length ?? 0);
</script>

<div class="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
	<div>
		<p class="text-sm font-medium text-zinc-900">
			Character #{characterResult.userCharacterIndex + 1} · {characterResult.targetChar ||
				'(extra)'}
		</p>
		<p class="text-sm text-zinc-500">Target stroke order</p>
	</div>

	<div class="flex flex-wrap gap-3">
		{#each Array.from({ length: visibleStrokeCount }, (_, index) => index + 1) as strokeCount (strokeCount)}
			<CharacterStrokeOrderPreview
				targetChar={characterResult.targetChar}
				visibleStrokeCount={strokeCount}
				label={strokeCount === 1 ? '1' : `1-${strokeCount}`}
			/>
		{/each}
	</div>
</div>
