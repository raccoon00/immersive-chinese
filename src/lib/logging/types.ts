export type BaseLogEvent = {
	ts: string;
	clientTs?: string;
	event: string;
	sessionId: string;
	attemptId?: string;
	cardId?: string;
	appVersion?: string;
	dataVersion?: string;
	hanziDataVersion?: string;
	userAgent?: string;
	route?: string;
	payload: unknown;
};

import type { WordAttempt } from '$lib/practice/types';

export type ClientLogRequest = {
	event: string;
	sessionId: string;
	attemptId?: string;
	cardId?: string;
	clientTs?: string;
	route?: string;
	payload: unknown;
};

export type ValidateAttemptRequest = {
	sessionId: string;
	attemptId: string;
	cardId: string;
	attempt: WordAttempt;
	clientTs?: string;
	route?: string;
};
