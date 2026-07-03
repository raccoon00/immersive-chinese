import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { isValidStudyTextId, readStudyText } from '$lib/server/studyTexts';

export const load: PageServerLoad = async ({ params }) => {
	const studyTextId = params.id;

	if (!studyTextId || !isValidStudyTextId(studyTextId)) {
		throw redirect(303, '/study-text');
	}

	const studyText = await readStudyText(studyTextId);
	if (!studyText) {
		throw redirect(303, '/study-text');
	}

	return {
		studyText
	};
};
