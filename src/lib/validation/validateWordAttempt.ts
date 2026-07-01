import { getTargetCharacter } from '$lib/hanzi/loadHanziData';
import type { WordAttempt, WordCard } from '$lib/practice/types';
import {
	compareCharacter,
	markExtraCharacter,
	markMissingCharacter
} from '$lib/scoring/compareCharacter';
import { thresholds, type Thresholds } from '$lib/scoring/thresholds';
import type {
	CharacterValidationResult,
	WordCountStatus,
	WordValidationResult
} from '$lib/validation/types';

function getWordCountStatus(
	targetCharacterCount: number,
	userCharacterCount: number
): WordCountStatus {
	if (userCharacterCount < targetCharacterCount) {
		return 'missing_characters';
	}

	if (userCharacterCount > targetCharacterCount) {
		return 'extra_characters';
	}

	return 'same_count';
}

function summarizeWordStatus(
	countStatus: WordCountStatus,
	characterResults: CharacterValidationResult[]
): WordValidationResult['status'] {
	if (countStatus === 'missing_characters') {
		return 'missing_characters';
	}

	if (countStatus === 'extra_characters') {
		return 'extra_characters';
	}

	return characterResults.every((result) => result.status === 'ok') ? 'ok' : 'bad_characters';
}

export function validateWordAttempt(
	card: WordCard,
	attempt: WordAttempt,
	customThresholds: Thresholds = thresholds
): WordValidationResult {
	const targetChars = Array.from(card.hanzi);
	const targetCharacterCount = targetChars.length;
	const userCharacterCount = attempt.characters.length;
	const countStatus = getWordCountStatus(targetCharacterCount, userCharacterCount);
	const characterResults: CharacterValidationResult[] = [];

	for (let index = 0; index < Math.max(targetCharacterCount, userCharacterCount); index += 1) {
		const targetChar = targetChars[index];
		const userCharacter = attempt.characters[index];

		if (!targetChar && userCharacter) {
			characterResults.push(markExtraCharacter(index, userCharacter, customThresholds));
			continue;
		}

		if (targetChar && !userCharacter) {
			const targetCharacter = getTargetCharacter(targetChar);
			if (targetCharacter) {
				characterResults.push(markMissingCharacter(index, targetCharacter, customThresholds));
			}
			continue;
		}

		if (targetChar && userCharacter) {
			const targetCharacter = getTargetCharacter(targetChar);

			if (!targetCharacter) {
				return {
					validationStage: 'count_only',
					status: summarizeWordStatus(countStatus, characterResults),
					countStatus,
					targetHanzi: card.hanzi,
					userCharacterCount,
					targetCharacterCount,
					characterStrokeCounts: attempt.characters.map((character) => character.strokes.length),
					characterResults,
					message: `Missing stroke data for ${targetChar}.`
				};
			}

			characterResults.push(
				compareCharacter(targetCharacter, userCharacter, index, customThresholds)
			);
		}
	}

	const status = summarizeWordStatus(countStatus, characterResults);
	const message =
		status === 'ok'
			? 'Character count and stroke matching passed.'
			: 'Character count and stroke matching completed.';

	return {
		validationStage: 'full',
		status,
		countStatus,
		targetHanzi: card.hanzi,
		userCharacterCount,
		targetCharacterCount,
		characterStrokeCounts: attempt.characters.map((character) => character.strokes.length),
		characterResults,
		message
	};
}
