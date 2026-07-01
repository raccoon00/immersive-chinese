function getPreferredChineseVoice(): SpeechSynthesisVoice | null {
	const voices = window.speechSynthesis.getVoices();

	return (
		voices.find((voice) => voice.lang.toLowerCase().startsWith('zh-cn')) ??
		voices.find((voice) => voice.lang.toLowerCase().startsWith('zh')) ??
		voices.find((voice) => /chinese|mandarin/i.test(voice.name)) ??
		null
	);
}

export function isSpeechSynthesisSupported(): boolean {
	return (
		typeof window !== 'undefined' &&
		'speechSynthesis' in window &&
		typeof SpeechSynthesisUtterance !== 'undefined'
	);
}

export function speakChinese(text: string): Promise<void> {
	if (!isSpeechSynthesisSupported()) {
		return Promise.reject(new Error('Speech synthesis is not supported in this browser.'));
	}

	return new Promise((resolve, reject) => {
		const utterance = new SpeechSynthesisUtterance(text);
		utterance.lang = 'zh-CN';
		utterance.rate = 0.9;
		utterance.voice = getPreferredChineseVoice();
		utterance.onend = () => resolve();
		utterance.onerror = () => reject(new Error('Speech synthesis failed.'));

		window.speechSynthesis.cancel();
		window.speechSynthesis.speak(utterance);
	});
}
