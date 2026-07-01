import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { DrillRowInput, StoredDrill } from '$lib/drills/types';
import type { WordCard } from '$lib/practice/types';

const drillsDir = resolve('data/drills');
const drillIdPattern = /^[a-z0-9_-]{6,120}$/i;

function getDrillPath(drillId: string): string {
	return resolve(drillsDir, `${drillId}.json`);
}

function nowIso(): string {
	return new Date().toISOString();
}

export function isValidDrillId(drillId: string): boolean {
	return drillIdPattern.test(drillId);
}

export function createDrillId(): string {
	if (globalThis.crypto?.randomUUID) {
		return `drill_${globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
	}

	return `drill_${Math.random().toString(36).slice(2, 18)}`;
}

function createStoredDrill(drillId: string, cards: WordCard[] = []): StoredDrill {
	const timestamp = nowIso();
	return {
		id: drillId,
		createdAt: timestamp,
		updatedAt: timestamp,
		status: cards.length > 0 ? 'ready' : 'draft',
		cards
	};
}

async function ensureDrillsDir(): Promise<void> {
	await mkdir(dirname(getDrillPath('placeholder')), { recursive: true });
}

export async function readDrill(drillId: string): Promise<StoredDrill | null> {
	if (!isValidDrillId(drillId)) {
		return null;
	}

	const path = getDrillPath(drillId);

	try {
		const contents = await readFile(path, 'utf8');
		return JSON.parse(contents) as StoredDrill;
	} catch {
		return null;
	}
}

export async function createEmptyDrill(drillId: string): Promise<StoredDrill> {
	const existing = await readDrill(drillId);
	if (existing) {
		return existing;
	}

	const drill = createStoredDrill(drillId);
	await ensureDrillsDir();
	await writeFile(getDrillPath(drillId), JSON.stringify(drill, null, 2), 'utf8');
	return drill;
}

export async function createEmptyDrillWithGeneratedId(): Promise<StoredDrill> {
	while (true) {
		const drillId = createDrillId();
		const existing = await readDrill(drillId);
		if (!existing) {
			return createEmptyDrill(drillId);
		}
	}
}

function normalizeRows(rows: DrillRowInput[]): WordCard[] {
	const normalizedRows = rows
		.map((row) => ({
			hanzi: row.hanzi.trim(),
			translation: row.translation.trim()
		}))
		.filter((row) => row.hanzi.length > 0 || row.translation.length > 0);

	for (const row of normalizedRows) {
		if (row.hanzi.length === 0 || row.translation.length === 0) {
			throw new Error('Each non-empty row must include both hanzi and translation.');
		}
	}

	return normalizedRows.map((row, index) => ({
		id: `card_${index}`,
		hanzi: row.hanzi,
		translation: row.translation
	}));
}

export async function saveDrill(drillId: string, rows: DrillRowInput[]): Promise<StoredDrill> {
	if (!isValidDrillId(drillId)) {
		throw new Error('Invalid drill id.');
	}

	const existing = await readDrill(drillId);
	const cards = normalizeRows(rows);
	const nextDrill: StoredDrill = {
		id: drillId,
		createdAt: existing?.createdAt ?? nowIso(),
		updatedAt: nowIso(),
		status: cards.length > 0 ? 'ready' : 'draft',
		cards
	};

	await ensureDrillsDir();
	await writeFile(getDrillPath(drillId), JSON.stringify(nextDrill, null, 2), 'utf8');
	return nextDrill;
}
