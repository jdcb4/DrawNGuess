const ADJECTIVES = ['Happy', 'Lucky', 'Sunny', 'Clever', 'Brave', 'Calm', 'Witty', 'Swift', 'Eager', 'Bold', 'Bright', 'Cool', 'Fancy', 'Jolly', 'Kind', 'Lively', 'Nice', 'Proud', 'Silly', 'Wild'];
const COLORS = ['Red', 'Blue', 'Green', 'Pink', 'Purple', 'Orange', 'Yellow', 'Cyan', 'Teal', 'Lime', 'Violet', 'Indigo', 'Gold', 'Silver', 'Bronze', 'Ruby', 'Azure', 'Coral', 'White', 'Black'];
const ANIMALS = ['Cat', 'Dog', 'Fox', 'Bear', 'Lion', 'Tiger', 'Wolf', 'Hawk', 'Eagle', 'Owl', 'Panda', 'Koala', 'Otter', 'Seal', 'Whale', 'Shark', 'Crab', 'Frog', 'Toad', 'Duck'];

export const generateName = (): string => {
    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const col = COLORS[Math.floor(Math.random() * COLORS.length)];
    const ani = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
    return `${adj}${col}${ani}`;
};
