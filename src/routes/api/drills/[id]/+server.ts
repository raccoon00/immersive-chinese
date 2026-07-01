import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { DrillRowInput } from '$lib/drills/types';
import { isValidDrillId, saveDrill } from '$lib/server/drills';

function isDrillRowInput(value: unknown): value is DrillRowInput {
	if (!value || typeof value !== 'object') {
		return false;
	}

	const candidate = value as Record<string, unknown>;
	return typeof candidate.hanzi === 'string' && typeof candidate.translation === 'string';
}

export const PUT: RequestHandler = async ({ params, request }) => {
	const drillId = params.id;
	if (!drillId || !isValidDrillId(drillId)) {
		return json({ error: 'Invalid drill id.' }, { status: 400 });
	}

	const body = await request.json().catch(() => null);
	const rows = body && typeof body === 'object' ? (body as Record<string, unknown>).rows : null;

	if (!Array.isArray(rows) || !rows.every(isDrillRowInput)) {
		return json({ error: 'Invalid drill rows.' }, { status: 400 });
	}

	try {
		const drill = await saveDrill(drillId, rows);
		return json({ drill });
	} catch (error) {
		return json(
			{ error: error instanceof Error ? error.message : 'Failed to save drill.' },
			{ status: 400 }
		);
	}
};
