import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
	createEmptyDrill,
	createEmptyDrillWithGeneratedId,
	isValidDrillId
} from '$lib/server/drills';

export const load: PageServerLoad = async ({ url }) => {
	const drillId = url.searchParams.get('id');

	if (!drillId || !isValidDrillId(drillId)) {
		const drill = await createEmptyDrillWithGeneratedId();
		throw redirect(303, `/drill-constructor?id=${drill.id}`);
	}

	const drill = await createEmptyDrill(drillId);

	return {
		drill
	};
};
