import type { ValidateAttemptRequest } from '$lib/logging/types';
import type { WordValidationResult } from '$lib/validation/types';

export async function validateAttempt(
	request: ValidateAttemptRequest
): Promise<WordValidationResult> {
	const response = await fetch('/api/validate-attempt', {
		method: 'POST',
		headers: {
			'content-type': 'application/json'
		},
		body: JSON.stringify({
			...request,
			clientTs: request.clientTs ?? new Date().toISOString(),
			route: request.route ?? window.location.pathname
		})
	});

	if (!response.ok) {
		throw new Error(`Validation failed with status ${response.status}`);
	}

	const payload = (await response.json()) as { result: WordValidationResult };
	return payload.result;
}
