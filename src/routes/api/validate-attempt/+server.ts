import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { ValidateAttemptRequest } from '$lib/logging/types';
import { appendDevLog, createBaseLogEvent } from '$lib/server/devLog';
import { loadTargetCharacters } from '$lib/server/hanziData';
import { thresholds } from '$lib/scoring/thresholds';
import { validateWordAttempt } from '$lib/validation/validateWordAttempt';
import type { CharacterValidationResult, StrokeValidationResult } from '$lib/validation/types';

function isValidateAttemptRequest(value: unknown): value is ValidateAttemptRequest {
	if (!value || typeof value !== 'object') {
		return false;
	}

	const candidate = value as Record<string, unknown>;

	return (
		typeof candidate.sessionId === 'string' &&
		typeof candidate.attemptId === 'string' &&
		typeof candidate.cardId === 'string' &&
		candidate.card !== null &&
		typeof candidate.card === 'object' &&
		candidate.attempt !== null &&
		typeof candidate.attempt === 'object'
	);
}

async function logValidationDetails(
	request: Request,
	body: ValidateAttemptRequest,
	result: ReturnType<typeof validateWordAttempt>,
	pathname: string
): Promise<void> {
	for (const characterResult of result.characterResults) {
		await appendDevLog(
			createBaseLogEvent(request, {
				event: 'character_validation_started',
				sessionId: body.sessionId,
				attemptId: body.attemptId,
				cardId: body.cardId,
				clientTs: body.clientTs,
				route: body.route ?? pathname,
				payload: {
					attemptId: body.attemptId,
					characterIndex: characterResult.userCharacterIndex,
					targetChar: characterResult.targetChar,
					targetStrokeCount: characterResult.targetStrokeCount,
					userStrokeCount: characterResult.userStrokeCount
				}
			})
		);

		await appendDevLog(
			createBaseLogEvent(request, {
				event: 'stroke_alignment_computed',
				sessionId: body.sessionId,
				attemptId: body.attemptId,
				cardId: body.cardId,
				clientTs: body.clientTs,
				route: body.route ?? pathname,
				payload: {
					attemptId: body.attemptId,
					characterIndex: characterResult.userCharacterIndex,
					targetChar: characterResult.targetChar,
					targetStrokeCount: characterResult.targetStrokeCount,
					userStrokeCount: characterResult.userStrokeCount,
					alignment: characterResult.alignment,
					totalAlignmentCost: characterResult.totalScore
				}
			})
		);

		for (const strokeResult of characterResult.strokeResults) {
			await logStrokeResult(request, body, characterResult, strokeResult, pathname);
		}

		await appendDevLog(
			createBaseLogEvent(request, {
				event: 'character_validation_completed',
				sessionId: body.sessionId,
				attemptId: body.attemptId,
				cardId: body.cardId,
				clientTs: body.clientTs,
				route: body.route ?? pathname,
				payload: {
					attemptId: body.attemptId,
					characterIndex: characterResult.userCharacterIndex,
					targetChar: characterResult.targetChar,
					status: characterResult.status,
					targetStrokeCount: characterResult.targetStrokeCount,
					userStrokeCount: characterResult.userStrokeCount,
					totalScore: characterResult.totalScore,
					matchedStrokeCount: characterResult.matchedStrokeCount,
					missingStrokeCount: characterResult.missingStrokeCount,
					extraStrokeCount: characterResult.extraStrokeCount,
					wrongDirectionCount: characterResult.wrongDirectionCount,
					wrongOrderCount: characterResult.wrongOrderCount,
					badShapeCount: characterResult.badShapeCount
				}
			})
		);
	}
}

async function logStrokeResult(
	request: Request,
	body: ValidateAttemptRequest,
	characterResult: CharacterValidationResult,
	strokeResult: StrokeValidationResult,
	pathname: string
): Promise<void> {
	if (strokeResult.status === 'missing') {
		await appendDevLog(
			createBaseLogEvent(request, {
				event: 'missing_stroke_detected',
				sessionId: body.sessionId,
				attemptId: body.attemptId,
				cardId: body.cardId,
				clientTs: body.clientTs,
				route: body.route ?? pathname,
				payload: {
					attemptId: body.attemptId,
					characterIndex: characterResult.userCharacterIndex,
					targetChar: characterResult.targetChar,
					targetStrokeIndex: strokeResult.targetStrokeIndex,
					penalty: strokeResult.score
				}
			})
		);
		return;
	}

	if (strokeResult.status === 'extra') {
		await appendDevLog(
			createBaseLogEvent(request, {
				event: 'extra_stroke_detected',
				sessionId: body.sessionId,
				attemptId: body.attemptId,
				cardId: body.cardId,
				clientTs: body.clientTs,
				route: body.route ?? pathname,
				payload: {
					attemptId: body.attemptId,
					characterIndex: characterResult.userCharacterIndex,
					userStrokeIndex: strokeResult.userStrokeIndex,
					penalty: strokeResult.score
				}
			})
		);
		return;
	}

	await appendDevLog(
		createBaseLogEvent(request, {
			event: 'stroke_compared',
			sessionId: body.sessionId,
			attemptId: body.attemptId,
			cardId: body.cardId,
			clientTs: body.clientTs,
			route: body.route ?? pathname,
			payload: {
				attemptId: body.attemptId,
				characterIndex: characterResult.userCharacterIndex,
				targetChar: characterResult.targetChar,
				targetStrokeIndex: strokeResult.targetStrokeIndex,
				userStrokeIndex: strokeResult.userStrokeIndex,
				shapeDistance: strokeResult.shapeDistance,
				endpointDistance: strokeResult.endpointDistance,
				directionPenalty: strokeResult.directionPenalty,
				lengthPenalty: strokeResult.lengthPenalty,
				totalScore: strokeResult.score,
				status: strokeResult.status,
				wrongOrderTargetStrokeIndex: strokeResult.wrongOrderTargetStrokeIndex,
				missedSegmentCount: strokeResult.missedSegments?.length ?? 0,
				missedSegments: strokeResult.missedSegments ?? []
			}
		})
	);
}

export const POST: RequestHandler = async ({ request, url }) => {
	const body = await request.json().catch(() => null);

	if (!isValidateAttemptRequest(body)) {
		return json({ error: 'Invalid validate-attempt request body' }, { status: 400 });
	}

	const card = body.card;
	const targetChars = Array.from(card.hanzi);
	const hanziStrokeData = await loadTargetCharacters(targetChars);

	await appendDevLog(
		createBaseLogEvent(request, {
			event: 'validation_started',
			sessionId: body.sessionId,
			attemptId: body.attemptId,
			cardId: body.cardId,
			clientTs: body.clientTs,
			route: body.route ?? url.pathname,
			payload: {
				attemptId: body.attemptId,
				drillId: body.drillId,
				cardId: body.cardId,
				targetHanzi: card.hanzi,
				targetChars,
				targetCharacterCount: targetChars.length,
				userCharacterCount: body.attempt.characters.length,
				thresholds
			}
		})
	);

	const result = validateWordAttempt(card, body.attempt, thresholds, hanziStrokeData);

	await appendDevLog(
		createBaseLogEvent(request, {
			event: 'word_count_validated',
			sessionId: body.sessionId,
			attemptId: body.attemptId,
			cardId: body.cardId,
			clientTs: body.clientTs,
			route: body.route ?? url.pathname,
			payload: {
				attemptId: body.attemptId,
				targetCharacterCount: result.targetCharacterCount,
				userCharacterCount: result.userCharacterCount,
				status: result.countStatus,
				missingCount: Math.max(0, result.targetCharacterCount - result.userCharacterCount),
				extraCount: Math.max(0, result.userCharacterCount - result.targetCharacterCount)
			}
		})
	);

	await logValidationDetails(request, body, result, url.pathname);

	await appendDevLog(
		createBaseLogEvent(request, {
			event: 'validation_completed',
			sessionId: body.sessionId,
			attemptId: body.attemptId,
			cardId: body.cardId,
			clientTs: body.clientTs,
			route: body.route ?? url.pathname,
			payload: {
				attemptId: body.attemptId,
				cardId: body.cardId,
				targetHanzi: result.targetHanzi,
				status: result.status,
				validationStage: result.validationStage,
				userCharacterCount: result.userCharacterCount,
				targetCharacterCount: result.targetCharacterCount,
				characterStrokeCounts: result.characterStrokeCounts,
				characterStatuses: result.characterResults.map((characterResult) => ({
					index: characterResult.userCharacterIndex,
					targetChar: characterResult.targetChar,
					status: characterResult.status,
					score: characterResult.totalScore,
					wrongOrderCount: characterResult.wrongOrderCount
				})),
				message: result.message
			}
		})
	);

	return json({ result });
};
