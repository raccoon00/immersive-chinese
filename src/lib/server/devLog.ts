import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { APP_VERSION, DATA_VERSION, DEV_LOG_FILE, HANZI_DATA_VERSION } from '$lib/config/app';
import type { BaseLogEvent, ClientLogRequest } from '$lib/logging/types';

const logPath = resolve(DEV_LOG_FILE);

export function isClientLogRequest(value: unknown): value is ClientLogRequest {
	if (!value || typeof value !== 'object') {
		return false;
	}

	const candidate = value as Record<string, unknown>;

	return (
		typeof candidate.event === 'string' &&
		typeof candidate.sessionId === 'string' &&
		'payload' in candidate
	);
}

type LogEventInput = {
	event: string;
	sessionId: string;
	attemptId?: string;
	cardId?: string;
	clientTs?: string;
	route?: string;
	payload: unknown;
};

export function createBaseLogEvent(request: Request, input: LogEventInput): BaseLogEvent {
	return {
		ts: new Date().toISOString(),
		clientTs: input.clientTs,
		event: input.event,
		sessionId: input.sessionId,
		attemptId: input.attemptId,
		cardId: input.cardId,
		appVersion: APP_VERSION,
		dataVersion: DATA_VERSION,
		hanziDataVersion: HANZI_DATA_VERSION,
		userAgent: request.headers.get('user-agent') ?? undefined,
		route: input.route,
		payload: input.payload
	};
}

export async function appendDevLog(entry: BaseLogEvent): Promise<void> {
	await mkdir(dirname(logPath), { recursive: true });
	await appendFile(logPath, `${JSON.stringify(entry)}\n`, 'utf8');
}
