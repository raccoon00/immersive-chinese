import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { loadTargetCharacters } from '$lib/server/hanziData';
import { isValidDrillId, readDrill } from '$lib/server/drills';

export const load: PageServerLoad = async ({ url }) => {
	const drillId = url.searchParams.get('id');

	if (!drillId || !isValidDrillId(drillId)) {
		throw redirect(303, '/drill-constructor');
	}

	const drill = await readDrill(drillId);
	if (!drill) {
		throw redirect(303, `/drill-constructor?id=${drillId}`);
	}

	const uniqueChars = [...new Set(drill.cards.flatMap((card) => Array.from(card.hanzi)))];
	const hanziStrokeData = await loadTargetCharacters(uniqueChars);

	return {
		drill,
		hanziStrokeData
	};
};
