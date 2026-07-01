import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { cards } from '../src/lib/data/cards';
import { preprocessHanziData, RESAMPLED_POINTS } from '../src/lib/hanzi/preprocessHanziData';
import type { RawHanziWriterData, TargetCharacter } from '../src/lib/hanzi/types';

const outputPath = resolve('src/lib/data/generated/hanziStrokeData.ts');

function collectUniqueChars(): string[] {
	return [...new Set(cards.flatMap((card) => Array.from(card.hanzi)))].sort();
}

async function loadRawHanziData(char: string): Promise<RawHanziWriterData> {
	const path = join(process.cwd(), 'node_modules', 'hanzi-writer-data', `${char}.json`);
	const contents = await readFile(path, 'utf8');
	return JSON.parse(contents) as RawHanziWriterData;
}

function serializeGeneratedData(data: Record<string, TargetCharacter>): string {
	return `import type { TargetCharacter } from '$lib/hanzi/types';

export const hanziStrokeData: Record<string, TargetCharacter> = ${JSON.stringify(data, null, 2)};
`;
}

async function main(): Promise<void> {
	const uniqueChars = collectUniqueChars();
	const generatedData: Record<string, TargetCharacter> = {};

	for (const char of uniqueChars) {
		const raw = await loadRawHanziData(char);
		generatedData[char] = preprocessHanziData(char, raw, RESAMPLED_POINTS);
	}

	await mkdir(dirname(outputPath), { recursive: true });
	await writeFile(outputPath, serializeGeneratedData(generatedData), 'utf8');

	console.log(`Generated stroke data for ${uniqueChars.length} characters -> ${outputPath}`);
}

void main();
