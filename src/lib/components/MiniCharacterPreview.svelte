<script lang="ts">
	import type { UserCharacterAttempt } from '$lib/practice/types';

	type Props = {
		character: UserCharacterAttempt;
		label?: string;
		active?: boolean;
	};

	let { character, label = '', active = false }: Props = $props();

	function toPolylinePoints(points: Array<{ x: number; y: number }>): string {
		return points.map((point) => `${point.x * 100},${point.y * 100}`).join(' ');
	}
</script>

<div
	class={`flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-2xl border bg-white p-2 ${
		active ? 'border-blue-500 ring-2 ring-blue-200' : 'border-zinc-200'
	}`}
>
	<svg viewBox="0 0 100 100" class="h-full w-full rounded-lg bg-zinc-50">
		{#each character.strokes as stroke, index (index)}
			<polyline
				points={toPolylinePoints(stroke.processed ?? stroke.points)}
				fill="none"
				stroke="#18181b"
				stroke-width="4"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
		{/each}
	</svg>

	{#if label}
		<p class="mt-1 text-[11px] text-zinc-500">{label}</p>
	{/if}
</div>
