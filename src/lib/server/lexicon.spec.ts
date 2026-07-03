import { describe, expect, it } from 'vitest';
import { lookupDictionaryMatches } from '$lib/server/lexicon';

describe('lookupDictionaryMatches', () => {
	it('returns matches from the local lexicon sources', async () => {
		const matches = await lookupDictionaryMatches('阿姨');

		expect(matches.length).toBeGreaterThan(0);
		expect(matches.some((match) => match.source === 'complete')).toBe(true);
		expect(
			matches.some((match) => match.definitions.some((definition) => /aunt/i.test(definition)))
		).toBe(true);
	});
});
