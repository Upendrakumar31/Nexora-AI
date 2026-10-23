import { z } from 'zod';

/**
 * Zod schema for validated resume review output.
 * The AI must produce structured JSON matching this shape.
 */
export const resumeReviewSchema = z.object({
    overallImpression: z
        .string()
        .min(10, 'Overall impression must be at least 10 characters')
        .max(2000, 'Overall impression is too long'),
    strengths: z
        .array(z.string().min(5, 'Each strength must be at least 5 characters').max(500))
        .min(1, 'At least one strength is required')
        .max(20),
    weaknesses: z
        .array(z.string().min(5, 'Each weakness must be at least 5 characters').max(500))
        .min(1, 'At least one weakness is required')
        .max(20),
    suggestions: z
        .array(z.string().min(5, 'Each suggestion must be at least 5 characters').max(500))
        .min(1, 'At least one suggestion is required')
        .max(20),
});

/**
 * Attempt to parse the AI response as structured JSON review.
 * The model may return JSON wrapped in markdown code fences.
 */
export function parseReviewResponse(rawContent) {
    // Try to extract JSON from markdown code fences first
    const jsonMatch = rawContent.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : rawContent.trim();

    try {
        return JSON.parse(jsonStr);
    } catch {
        // Fallback: try to parse the entire content
        // Remove leading/trailing non-JSON characters
        const startIdx = jsonStr.indexOf('{');
        const endIdx = jsonStr.lastIndexOf('}');
        if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
            try {
                return JSON.parse(jsonStr.substring(startIdx, endIdx + 1));
            } catch {
                // Cannot parse
            }
        }
        return null;
    }
}

/**
 * Convert a validated structured review to Markdown for frontend compatibility.
 */
export function reviewToMarkdown(review) {
    let md = `**Overall Impression:**\n${review.overallImpression}\n\n`;

    md += `**Strengths:**\n`;
    for (const s of review.strengths) {
        md += `* ${s}\n`;
    }
    md += '\n';

    md += `**Weaknesses:**\n`;
    for (const w of review.weaknesses) {
        md += `* ${w}\n`;
    }
    md += '\n';

    md += `**Specific Suggestions:**\n`;
    for (const sg of review.suggestions) {
        md += `* ${sg}\n`;
    }

    return md;
}
