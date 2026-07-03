import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	deleteStudyText,
	isValidStudyTextId,
	readStudyText,
	saveStudyText
} from '$lib/server/studyTexts';

export const GET: RequestHandler = async ({ params }) => {
	const studyTextId = params.id;
	if (!studyTextId || !isValidStudyTextId(studyTextId)) {
		return json({ error: 'Invalid study text id.' }, { status: 400 });
	}

	const studyText = await readStudyText(studyTextId);
	if (!studyText) {
		return json({ error: 'Study text not found.' }, { status: 404 });
	}

	return json({ studyText });
};

export const PUT: RequestHandler = async ({ params, request }) => {
	const studyTextId = params.id;
	if (!studyTextId || !isValidStudyTextId(studyTextId)) {
		return json({ error: 'Invalid study text id.' }, { status: 400 });
	}

	const body = await request.json().catch(() => null);
	if (!body || typeof body !== 'object') {
		return json({ error: 'Invalid study text update payload.' }, { status: 400 });
	}

	const updates = body as Record<string, unknown>;

	try {
		const sentenceTranslations =
			updates.sentenceTranslations && typeof updates.sentenceTranslations === 'object'
				? Object.fromEntries(
						Object.entries(updates.sentenceTranslations as Record<string, unknown>).filter(
							([, value]) => typeof value === 'string'
						)
				  ) as Record<string, string>
				: undefined;

		const studyText = await saveStudyText(studyTextId, {
			title: typeof updates.title === 'string' ? updates.title : undefined,
			rawText: typeof updates.rawText === 'string' ? updates.rawText : undefined,
			wholeTranslation:
				typeof updates.wholeTranslation === 'string' ? updates.wholeTranslation : undefined,
			relatedDrillId:
				typeof updates.relatedDrillId === 'string' ? updates.relatedDrillId : undefined,
			status:
				typeof updates.status === 'string' &&
				['draft', 'in_progress', 'ready'].includes(updates.status)
					? (updates.status as 'draft' | 'in_progress' | 'ready')
					: undefined,
			selectedSentenceIds: Array.isArray(updates.selectedSentenceIds)
				? updates.selectedSentenceIds.filter((value): value is string => typeof value === 'string')
				: undefined,
			sentenceTranslations
		});

		return json({ studyText });
	} catch (error) {
		return json(
			{ error: error instanceof Error ? error.message : 'Failed to save study text.' },
			{ status: 400 }
		);
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	const studyTextId = params.id;
	if (!studyTextId || !isValidStudyTextId(studyTextId)) {
		return json({ error: 'Invalid study text id.' }, { status: 400 });
	}

	await deleteStudyText(studyTextId);
	return json({ ok: true });
};
