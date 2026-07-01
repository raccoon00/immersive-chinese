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

<div class="w-20 shrink-0 space-y-1.5 sm:w-24 sm:space-y-2">
	<div class="rounded-2xl bg-white p-1.5 shadow-sm ring-1 ring-zinc-200 sm:p-2">
		<svg viewBox="0 0 1024 1024" class="h-16 w-16 rounded-xl bg-zinc-50 sm:h-20 sm:w-20">
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
		<p class="px-1 text-center text-[10px] text-zinc-500 sm:text-xs">{label}</p>
	{/if}
</div>
