/**
 * Safely parses raw AI blog titles output into an array of distinct, clean titles.
 * Handles numbered lists (1., 1)), bullet points (-, *, •),
 * markdown bold formatting (**title**, __title__), quotes, and conversational preambles/outros.
 *
 * @param {string} rawContent
 * @returns {string[]} Array of clean, distinct title strings.
 */
export function parseBlogTitles(rawContent) {
    if (!rawContent || typeof rawContent !== 'string') return [];

    const lines = rawContent.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const titles = [];

    for (const line of lines) {
        // Skip common conversational intro lines ending with colon or starting with conversational preambles
        const isIntro = /^(here (are|is)|certainly|sure|below are|check out|these are|top \d+|5 catchy|seo-friendly)/i.test(line);
        if (isIntro && (line.endsWith(':') || !/^(\d+[\.\)]|\*|-|•|\[\d+\])/.test(line))) {
            continue;
        }

        // Skip conversational outro lines
        const isOutro = /^(hope (this|these)|let me know|feel free|enjoy|good luck|best of luck)/i.test(line);
        if (isOutro) {
            continue;
        }

        // Strip leading numbering, bullets, dashes, e.g. "1.", "1)", "-", "*", "•", "[1]"
        let cleaned = line.replace(/^(\d+[\.\)]|\*|-|•|\[\d+\])\s*/, '').trim();

        // Strip markdown bold / italic formatting from edges
        cleaned = cleaned.replace(/^\*\*|\*\*$/g, '').replace(/^\*|\*$/g, '').replace(/^__|\__$/g, '').trim();

        // Strip any remaining internal unclosed bold markers
        cleaned = cleaned.replace(/\*\*/g, '').trim();

        // Strip wrapping quotes (ASCII and Unicode smart quotes)
        cleaned = cleaned.replace(/^["“'‘]|["”'’]$/g, '').trim();

        // Valid title must have content and not end with a header colon
        if (cleaned.length >= 5 && !cleaned.endsWith(':')) {
            titles.push(cleaned);
        }
    }

    // Fallback: If line splitting did not find multiple items, attempt regex extraction on inline numbered items
    if (titles.length < 2) {
        const inlineNumberedRegex = /(?:^|\s)(\d+)[\.\)]\s*(.*?)(?=(?:\s+\d+[\.\)])|$)/g;
        const inlineMatches = [];
        let inlineMatch;
        while ((inlineMatch = inlineNumberedRegex.exec(rawContent)) !== null) {
            let t = inlineMatch[2]
                .replace(/^\*\*|\*\*$/g, '')
                .replace(/\*\*/g, '')
                .replace(/^["“'‘]|["”'’]$/g, '')
                .trim();
            if (t.length >= 5 && !t.endsWith(':')) {
                inlineMatches.push(t);
            }
        }
        if (inlineMatches.length > titles.length) {
            return inlineMatches;
        }
    }

    return titles;
}

export default parseBlogTitles;
