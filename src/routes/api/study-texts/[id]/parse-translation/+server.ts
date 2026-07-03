import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isValidStudyTextId, mapWholeTranslationForStudyText } from '$lib/server/studyTexts';

export const POST: RequestHandler = async ({ params, request }) => {
	const studyTextId = params.id;
	if (!studyTextId || !isValidStudyTextId(studyTextId)) {
		return json({ error: 'Invalid study text id.' }, { status: 400 });
	}

	const body = await request.json().catch(() => null);
	if (!body || typeof body !== 'object') {
		return json({ error: 'Invalid translation mapping payload.' }, { status: 400 });
	}

	const candidate = body as Record<string, unknown>;
	const wholeTranslation = candidate.wholeTranslation;
	const sourceSentenceIds = candidate.sourceSentenceIds;

	if (typeof wholeTranslation !== 'string') {
		return json({ error: 'wholeTranslation must be a string.' }, { status: 400 });
	}

	try {
		const result = await mapWholeTranslationForStudyText(
			studyTextId,
			wholeTranslation,
			Array.isArray(sourceSentenceIds)
				? sourceSentenceIds.filter((value): value is string => typeof value === 'string')
				: undefined
		);
		return json(result);
	} catch (error) {
		return json(
			{ error: error instanceof Error ? error.message : 'Failed to map translation.' },
			{ status: 400 }
		);
	}
};
