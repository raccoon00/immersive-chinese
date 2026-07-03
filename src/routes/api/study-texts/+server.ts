import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createStudyTextFromRawText, listStudyTexts } from '$lib/server/studyTexts';

export const GET: RequestHandler = async () => {
	const studyTexts = await listStudyTexts();
	return json({ studyTexts });
};

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => null);
	const rawText =
		body && typeof body === 'object' ? (body as Record<string, unknown>).rawText : null;
	const title = body && typeof body === 'object' ? (body as Record<string, unknown>).title : null;
	const createdFrom =
		body && typeof body === 'object' ? (body as Record<string, unknown>).createdFrom : null;

	if (
		typeof rawText !== 'string' ||
		typeof createdFrom !== 'string' ||
		rawText.trim().length === 0
	) {
		return json({ error: 'Invalid study text payload.' }, { status: 400 });
	}

	const studyText = await createStudyTextFromRawText({
		rawText,
		title: typeof title === 'string' ? title : undefined,
		createdFrom: createdFrom === 'clipboard' ? 'clipboard' : 'manual'
	});

	return json({ studyText }, { status: 201 });
};
