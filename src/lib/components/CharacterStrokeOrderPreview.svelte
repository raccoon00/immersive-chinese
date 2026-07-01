<script lang="ts">
	import { getHanziStrokeDataContext } from '$lib/hanzi/context';

	type Props = {
		targetChar: string;
		visibleStrokeCount: number;
		label?: string;
	};

	let { targetChar, visibleStrokeCount, label }: Props = $props();

	const hanziStrokeData = getHanziStrokeDataContext();
	const targetCharacter = $derived(targetChar ? hanziStrokeData[targetChar] : undefined);
	const visibleStrokes = $derived(targetCharacter?.strokes.slice(0, visibleStrokeCount) ?? []);
</script>

<div class="w-24 shrink-0 space-y-2">
	<div class="rounded-2xl bg-white p-2 shadow-sm ring-1 ring-zinc-200">
		<svg viewBox="0 0 1024 1024" class="h-20 w-20 rounded-xl bg-zinc-50">
			{#if targetCharacter}
				<g transform="translate(0 900) scale(1 -1)">
					{#each visibleStrokes as stroke (stroke.index)}
						<path d={stroke.svgPath} fill="#18181b" />
					{/each}
				</g>
			{/if}
		</svg>
	</div>

	{#if label}
		<p class="px-1 text-center text-xs text-zinc-500">{label}</p>
	{/if}
</div>
