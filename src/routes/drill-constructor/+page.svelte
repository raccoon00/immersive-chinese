<!-- eslint-disable svelte/no-navigation-without-resolve -->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { StoredDrill } from '$lib/drills/types';

	type PageData = {
		drill: StoredDrill;
	};

	type EditableRow = {
		hanzi: string;
		translation: string;
	};

	let { data }: { data: PageData } = $props();

	const drill = $derived(data.drill);

	function createEmptyRow(): EditableRow {
		return {
			hanzi: '',
			translation: ''
		};
	}

	let rows = $state<EditableRow[]>([]);
	let savePending = $state(false);
	let lastSavedAt = $state('');
	let errorMessage = $state<string | null>(null);
	let initializedDrillId = $state('');

	$effect(() => {
		if (drill.id === initializedDrillId) {
			return;
		}

		rows =
			drill.cards.length > 0
				? drill.cards.map((card) => ({ hanzi: card.hanzi, translation: card.translation }))
				: [createEmptyRow()];
		lastSavedAt = drill.updatedAt;
		initializedDrillId = drill.id;
	});

	const nonEmptyRowCount = $derived(
		rows.filter((row) => row.hanzi.trim().length > 0 || row.translation.trim().length > 0).length
	);

	function addRow(): void {
		rows = [...rows, createEmptyRow()];
	}

	function removeRow(index: number): void {
		if (rows.length === 1) {
			rows = [createEmptyRow()];
			return;
		}

		rows = [...rows.slice(0, index), ...rows.slice(index + 1)];
	}

	async function saveDrill(openAfterSave: boolean): Promise<void> {
		savePending = true;
		errorMessage = null;

		try {
			const response = await fetch(`/api/drills/${drill.id}`, {
				method: 'PUT',
				headers: {
					'content-type': 'application/json'
				},
				body: JSON.stringify({ rows })
			});

			const payload = (await response.json()) as {
				drill?: StoredDrill;
				error?: string;
			};

			if (!response.ok || !payload.drill) {
				throw new Error(payload.error ?? `Save failed with status ${response.status}`);
			}

			lastSavedAt = payload.drill.updatedAt;

			if (openAfterSave) {
				await goto(`${resolve('/drill')}?id=${payload.drill.id}`);
			}
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Failed to save drill.';
		} finally {
			savePending = false;
		}
	}
</script>

<svelte:head>
	<title>Drill constructor · {drill.id}</title>
	<meta
		name="description"
		content="Create and edit shareable Hanzi drills with word–translation pairs."
	/>
</svelte:head>

<div class="min-h-screen bg-zinc-100 text-zinc-950">
	<div class="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-6 py-10">
		<header class="space-y-3">
			<p class="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">Hanzi Practice</p>
			<h1 class="text-3xl font-semibold">Drill constructor</h1>
			<p class="text-sm text-zinc-600">Build or edit a drill, then open it in practice mode.</p>
		</header>

		<section class="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
			<div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
				<div>
					<p class="text-sm text-zinc-500">Editable drill ID</p>
					<p class="mt-2 break-all text-lg font-semibold text-zinc-950">{drill.id}</p>
					<p class="mt-2 text-sm text-zinc-500">Status: {drill.status}</p>
					<p class="mt-1 text-sm text-zinc-500">Last saved: {lastSavedAt}</p>
				</div>
				<div class="flex flex-wrap gap-3 text-sm">
					<a
						href={`${resolve('/drill')}?id=${drill.id}`}
						class="rounded-xl bg-zinc-100 px-4 py-2 font-medium text-zinc-800 ring-1 ring-zinc-200 transition hover:bg-zinc-200"
					>
						Open current drill
					</a>
				</div>
			</div>
		</section>

		<section class="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
			<div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
				<div>
					<p class="text-lg font-semibold text-zinc-950">Cards</p>
					<p class="text-sm text-zinc-500">Rows expand as you add word–translation pairs.</p>
				</div>
				<button
					type="button"
					onclick={addRow}
					class="rounded-xl bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800"
				>
					Add row
				</button>
			</div>

			<div class="mt-5 overflow-x-auto">
				<table class="min-w-full border-separate border-spacing-y-3">
					<thead>
						<tr class="text-left text-sm text-zinc-500">
							<th class="px-3">#</th>
							<th class="px-3">Hanzi</th>
							<th class="px-3">Translation</th>
							<th class="px-3"></th>
						</tr>
					</thead>
					<tbody>
						{#each rows as row, index (index)}
							<tr>
								<td class="px-3 align-top text-sm text-zinc-500">{index + 1}</td>
								<td class="px-3">
									<input
										type="text"
										bind:value={row.hanzi}
										placeholder="学生"
										class="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-400 focus:bg-white"
									/>
								</td>
								<td class="px-3">
									<input
										type="text"
										bind:value={row.translation}
										placeholder="student"
										class="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-400 focus:bg-white"
									/>
								</td>
								<td class="px-3 align-top">
									<button
										type="button"
										onclick={() => removeRow(index)}
										class="rounded-xl bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-700 ring-1 ring-zinc-200 transition hover:bg-zinc-200"
									>
										Remove
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<div class="mt-6 flex flex-wrap gap-3">
				<button
					type="button"
					onclick={() => void saveDrill(false)}
					disabled={savePending}
					class="rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-300"
				>
					{savePending ? 'Saving…' : 'Save drill'}
				</button>
				<button
					type="button"
					onclick={() => void saveDrill(true)}
					disabled={savePending || nonEmptyRowCount === 0}
					class="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-300"
				>
					{savePending ? 'Saving…' : 'Save and start drill'}
				</button>
			</div>

			{#if errorMessage}
				<p class="mt-4 text-sm text-red-600">{errorMessage}</p>
			{:else}
				<p class="mt-4 text-sm text-zinc-500">Non-empty rows: {nonEmptyRowCount}</p>
			{/if}
		</section>

		<section class="grid gap-4 md:grid-cols-2">
			<div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
				<p class="text-sm font-medium text-zinc-800">Editing model</p>
				<p class="mt-2 text-sm text-zinc-600">
					This URL is stable. Opening a new constructor without an id creates a new draft and
					redirects here.
				</p>
				<p class="mt-3 text-sm text-zinc-600">
					Opening <code>/drill-constructor?id=...</code> for a missing id creates an empty drill file
					automatically.
				</p>
			</div>

			<div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
				<p class="text-sm font-medium text-zinc-800">Shareable links</p>
				<p class="mt-2 break-all text-sm text-zinc-600">
					Edit: {`${resolve('/drill-constructor')}?id=${drill.id}`}
				</p>
				<p class="mt-2 break-all text-sm text-zinc-600">
					Practice: {`${resolve('/drill')}?id=${drill.id}`}
				</p>
			</div>
		</section>
	</div>
</div>
