"use server";

// Lightweight duplicate detection using word overlap / Jaccard similarity
// Avoids embedding API costs while still catching obvious duplicates

function tokenize(text: string): Set<string> {
    return new Set(
        text
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, "")
            .split(/\s+/)
            .filter((w) => w.length > 2)
    );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
    const intersection = new Set([...a].filter((x) => b.has(x)));
    const union = new Set([...a, ...b]);
    return union.size > 0 ? intersection.size / union.size : 0;
}

export interface DuplicateCheckResult {
    isDuplicate: boolean;
    similarityScore: number;
    matchedTaskId?: string;
    matchedTaskTitle?: string;
}

export async function checkForDuplicates(
    newTitle: string,
    newDescription: string,
    existingTasks: { id: string; title: string; description?: string }[]
): Promise<DuplicateCheckResult> {
    const newTokens = tokenize(`${newTitle} ${newDescription || ""}`);
    const THRESHOLD = 0.55; // Tune this threshold as needed

    let bestMatch: DuplicateCheckResult = {
        isDuplicate: false,
        similarityScore: 0,
    };

    for (const task of existingTasks) {
        const existingTokens = tokenize(`${task.title} ${task.description || ""}`);
        const score = jaccardSimilarity(newTokens, existingTokens);

        if (score > bestMatch.similarityScore) {
            bestMatch = {
                isDuplicate: score >= THRESHOLD,
                similarityScore: Math.round(score * 100) / 100,
                matchedTaskId: task.id,
                matchedTaskTitle: task.title,
            };
        }
    }

    return bestMatch;
}
