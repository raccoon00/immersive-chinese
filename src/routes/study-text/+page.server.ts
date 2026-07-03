import type { PageServerLoad } from './$types';
import { listStudyTexts } from '$lib/server/studyTexts';

export const load: PageServerLoad = async () => {
	return {
		studyTexts: await listStudyTexts()
	};
};
