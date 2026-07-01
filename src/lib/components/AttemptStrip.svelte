<script lang="ts">
	import MiniCharacterPreview from '$lib/components/MiniCharacterPreview.svelte';
	import type { UserCharacterAttempt } from '$lib/practice/types';

	type Props = {
		completedCharacters: UserCharacterAttempt[];
		activeCharacter: UserCharacterAttempt;
	};

	let { completedCharacters, activeCharacter }: Props = $props();
</script>

<div class="flex flex-wrap gap-2 sm:gap-3">
	{#each completedCharacters as character, index (character.id)}
		<MiniCharacterPreview {character} label={`#${index + 1}`} />
	{/each}

	<MiniCharacterPreview
		character={activeCharacter}
		label={`Active #${completedCharacters.length + 1}`}
		active={true}
	/>
</div>
