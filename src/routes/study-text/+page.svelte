<!-- eslint-disable svelte/no-navigation-without-resolve -->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { StudyTextSummary } from '$lib/study-text/types';

	type PageData = {
		studyTexts: StudyTextSummary[];
	};

	let { data }: { data: PageData } = $props();

	let studyTexts = $state<StudyTextSummary[]>([]);
	let manualText = $state('');
	let initializedStudyList = $state(false);
	let manualTitle = $state('');
	let creating = $state(false);
	let clipboardPending = $state(false);
	let errorMessage = $state<string | null>(null);
	let deletePendingId = $state('');

	const canUseClipboard =
		typeof window !== 'undefined' &&
		Boolean(window.isSecureContext && navigator.clipboard?.readText);

	$effect(() => {
		if (initializedStudyList) {
			return;
		}

		studyTexts = [...data.studyTexts];
		initializedStudyList = true;
	});

	async function createStudy(rawText: string, createdFrom: 'clipboard' | 'manual'): Promise<void> {
		creating = true;
		errorMessage = null;

		try {
			const response = await fetch('/api/study-texts', {
				method: 'POST',
				headers: {
					'content-type': 'application/json'
				},
				body: JSON.stringify({
					rawText,
					title: manualTitle,
					createdFrom
				})
			});

			const payload = (await response.json()) as {
				studyText?: { id: string };
				error?: string;
			};

			if (!response.ok || !payload.studyText) {
				throw new Error(payload.error ?? `Create failed with status ${response.status}`);
			}

			manualText = '';
			manualTitle = '';
			await goto(`${resolve('/study-text')}/${payload.studyText.id}`);
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Failed to create study text.';
		} finally {
			creating = false;
		}
	}

	async function createFromClipboard(): Promise<void> {
		if (!canUseClipboard) {
			errorMessage = 'Clipboard read is unavailable in this browser or context.';
			return;
		}

		clipboardPending = true;
		errorMessage = null;

		try {
			const clipboardText = await navigator.clipboard.readText();
			if (clipboardText.trim().length === 0) {
				throw new Error('Clipboard is empty.');
			}

			await createStudy(clipboardText, 'clipboard');
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Failed to read clipboard.';
		} finally {
			clipboardPending = false;
		}
	}

	async function createFromManualPaste(): Promise<void> {
		if (manualText.trim().length === 0) {
			errorMessage = 'Paste some text first.';
			return;
		}

		await createStudy(manualText, 'manual');
	}

	async function deleteStudy(studyTextId: string): Promise<void> {
		deletePendingId = studyTextId;
		errorMessage = null;

		try {
			const response = await fetch(`/api/study-texts/${studyTextId}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				const payload = (await response.json().catch(() => null)) as { error?: string } | null;
				throw new Error(payload?.error ?? `Delete failed with status ${response.status}`);
			}

			studyTexts = studyTexts.filter((studyText) => studyText.id !== studyTextId);
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Failed to delete study text.';
		} finally {
			deletePendingId = '';
		}
	}
</script>

<svelte:head>
	<title>Study Text</title>
	<meta
		name="description"
		content="Import Chinese text, select sentences, and prepare vocabulary drills."
	/>
</svelte:head>

<div class="min-h-screen bg-zinc-100 text-zinc-950">
	<div
		class="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-4 py-5 sm:px-6 sm:py-8 lg:py-10"
	>
		<header class="space-y-2">
			<p class="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">Hanzi Practice</p>
			<h1 class="text-3xl font-semibold">Study Text</h1>
			<p class="text-sm text-zinc-600">
				Import Chinese text from the clipboard or paste it manually, then prepare it for drilling.
			</p>
		</header>

		<section class="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-zinc-200 sm:p-6">
			<div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
				<div>
					<p class="text-lg font-semibold text-zinc-950">Create a study</p>
					<p class="text-sm text-zinc-500">Clipboard is fastest, manual paste is the fallback.</p>
				</div>
				<div class="flex flex-wrap gap-3">
					<button
						type="button"
						onclick={() => void createFromClipboard()}
						disabled={clipboardPending || creating || !canUseClipboard}
						class="rounded-xl bg-zinc-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
					>
						{clipboardPending ? 'Reading clipboard…' : 'Create new from clipboard'}
					</button>
				</div>
			</div>

			<div class="mt-5 grid gap-4">
				<label class="space-y-2">
					<span class="text-sm font-medium text-zinc-800">Optional title</span>
					<input
						type="text"
						bind:value={manualTitle}
						placeholder="Text title"
						class="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-400 focus:bg-white"
					/>
				</label>

				<label class="space-y-2">
					<span class="text-sm font-medium text-zinc-800">Manual paste</span>
					<textarea
						bind:value={manualText}
						rows="8"
						placeholder="Paste Chinese text here"
						class="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-400 focus:bg-white"
					></textarea>
				</label>
			</div>

			<div class="mt-4 flex flex-wrap gap-3">
				<button
					type="button"
					onclick={() => void createFromManualPaste()}
					disabled={creating || manualText.trim().length === 0}
					class="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-300"
				>
					{creating ? 'Creating…' : 'Create from pasted text'}
				</button>
			</div>

			{#if errorMessage}
				<p class="mt-4 text-sm text-red-600">{errorMessage}</p>
			{/if}
		</section>

		<section class="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-zinc-200 sm:p-6">
			<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<p class="text-lg font-semibold text-zinc-950">Existing studies</p>
					<p class="text-sm text-zinc-500">Stored on your server as editable progress files.</p>
				</div>
				<p class="text-sm text-zinc-500">{studyTexts.length} total</p>
			</div>

			{#if studyTexts.length === 0}
				<p class="mt-5 text-sm text-zinc-500">No study texts yet.</p>
			{:else}
				<div class="mt-5 space-y-3">
					{#each studyTexts as studyText (studyText.id)}
						<div class="rounded-2xl bg-zinc-50 p-4 ring-1 ring-zinc-200">
							<div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
								<div>
									<p class="text-base font-semibold text-zinc-950">{studyText.title}</p>
									<p class="mt-1 break-all text-sm text-zinc-500">{studyText.id}</p>
									<p class="mt-2 text-sm text-zinc-600">
										Status: {studyText.status} · Sentences: {studyText.sentenceCount} · Selected:
										{studyText.selectedSentenceCount}
									</p>
									<p class="mt-1 text-sm text-zinc-500">Updated: {studyText.updatedAt}</p>
								</div>

								<div class="flex flex-wrap gap-3">
									<a
										href={`${resolve('/study-text')}/${studyText.id}`}
										class="rounded-xl bg-white px-4 py-2 text-sm font-medium text-zinc-800 ring-1 ring-zinc-200 transition hover:bg-zinc-100"
									>
										Open
									</a>
									{#if studyText.relatedDrillId}
										<a
											href={`${resolve('/drill')}?id=${studyText.relatedDrillId}`}
											class="rounded-xl bg-white px-4 py-2 text-sm font-medium text-zinc-800 ring-1 ring-zinc-200 transition hover:bg-zinc-100"
										>
											Open related drill
										</a>
									{/if}
									<button
										type="button"
										onclick={() => void deleteStudy(studyText.id)}
										disabled={deletePendingId === studyText.id}
										class="rounded-xl bg-red-50 px-4 py-2 text-sm font-medium text-red-700 ring-1 ring-red-200 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
									>
										{deletePendingId === studyText.id ? 'Deleting…' : 'Delete'}
									</button>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</section>
	</div>
</div>
