const DESCRIPTORS = [
    "Quantum", "Stellar", "Obsidian", "Kinetic", "Neon", "Infinite", "Primal", "Digital", "Lunar", "Vivid",
    "Rogue", "Golden", "Atomic", "Swift", "Silent", "Turbo", "Hidden", "Apex", "Solar", "Iron"
];

const SUBJECTS = [
    "Phoenix", "Raptor", "Logic", "Titan", "Cipher", "Ghost", "Falcon", "Kraken", "Nomad", "Spark",
    "Vector", "Orbit", "Pulse", "Zenith", "Echo", "Storm", "Matrix", "Wolf", "Cobra", "Catalyst"
];

const COLLECTIVES = [
    "Syndicate", "Collective", "Alliance", "Guild", "Squad", "Nexus", "Union", "Frontier", "Agency", "Society",
    "Battalion", "Brigade", "Lab", "Crew", "Legion", "Division", "Consortium", "Circle", "Venture", "Network"
];

export const generateTeamName = (): string => {
    const d = DESCRIPTORS[Math.floor(Math.random() * DESCRIPTORS.length)];
    const s = SUBJECTS[Math.floor(Math.random() * SUBJECTS.length)];
    const c = COLLECTIVES[Math.floor(Math.random() * COLLECTIVES.length)];
    return `${d} ${s} ${c}`;
};
