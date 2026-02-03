import { WordItem } from '../shared/types';
import wordBankData from './wordBank.json';

/**
 * Get random words from the word bank based on difficulty settings
 * @param count Number of words to retrieve
 * @param difficulties Array of difficulty levels to include
 * @returns Array of random word strings
 */
export function getRandomWords(
    count: number,
    difficulties: ('easy' | 'medium' | 'hard')[]
): string[] {
    // Filter word bank by selected difficulties
    const filteredWords = (wordBankData as WordItem[]).filter(item =>
        difficulties.includes(item.difficulty)
    );

    if (filteredWords.length < count) {
        console.warn(`Not enough words for requested difficulties. Requested: ${count}, Available: ${filteredWords.length}`);
    }

    // Shuffle and select
    const shuffled = [...filteredWords].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count).map(item => item.word);
}

/**
 * Get all available words for a given difficulty set
 */
export function getAvailableWordCount(difficulties: ('easy' | 'medium' | 'hard')[]): number {
    return (wordBankData as WordItem[]).filter(item =>
        difficulties.includes(item.difficulty)
    ).length;
}
