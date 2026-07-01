import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { appendDevLog, createBaseLogEvent, isClientLogRequest } from '$lib/server/devLog';

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => null);

	if (!isClientLogRequest(body)) {
		return json({ error: 'Invalid log request body' }, { status: 400 });
	}

	const entry = createBaseLogEvent(request, body);
	await appendDevLog(entry);

	return json({ ok: true });
};
