import type { ClientLogRequest } from '$lib/logging/types';

export async function sendDevLog(event: ClientLogRequest): Promise<void> {
	const response = await fetch('/api/dev-log', {
		method: 'POST',
		headers: {
			'content-type': 'application/json'
		},
		keepalive: true,
		body: JSON.stringify({
			...event,
			clientTs: event.clientTs ?? new Date().toISOString(),
			route: event.route ?? window.location.pathname
		})
	});

	if (!response.ok) {
		throw new Error(`Dev log failed with status ${response.status}`);
	}
}
