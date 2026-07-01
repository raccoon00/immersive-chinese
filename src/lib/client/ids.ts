const SESSION_STORAGE_KEY = 'hanzi-practice/session-id';

function createId(prefix: string): string {
	const randomPart = globalThis.crypto?.randomUUID?.().replaceAll('-', '').slice(0, 12);
	return `${prefix}_${randomPart ?? Math.random().toString(36).slice(2, 14)}`;
}

export function getOrCreateSessionId(): string {
	const existing = sessionStorage.getItem(SESSION_STORAGE_KEY);

	if (existing) {
		return existing;
	}

	const sessionId = createId('sess');
	sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId);
	return sessionId;
}

export function createAttemptId(): string {
	return createId('attempt');
}
