/**
 * Text chunking service for resume text.
 *
 * Splits text into manageable, overlapping chunks suitable for embedding.
 * Target: ~500-800 tokens per chunk (roughly 2000-3200 characters).
 * Preserves paragraph boundaries where practical.
 */

const DEFAULT_CHUNK_SIZE = 2500;     // ~625 tokens (chars / 4 ≈ tokens)
const DEFAULT_CHUNK_OVERLAP = 200;   // Overlap in characters
const MIN_CHUNK_SIZE = 100;          // Don't create tiny chunks

/**
 * Split text into overlapping chunks, respecting paragraph boundaries.
 * @param {string} text - The full text to chunk.
 * @param {object} options - Optional configuration.
 * @param {number} options.chunkSize - Target chunk size in characters.
 * @param {number} options.overlap - Overlap between chunks in characters.
 * @returns {{ chunkIndex: number, chunkText: string }[]}
 */
export function chunkText(text, options = {}) {
    const chunkSize = options.chunkSize || DEFAULT_CHUNK_SIZE;
    const overlap = options.overlap || DEFAULT_CHUNK_OVERLAP;

    if (!text || text.trim().length === 0) {
        return [];
    }

    const cleanedText = text.replace(/\r\n/g, '\n').trim();

    // If text is small enough for one chunk, return it directly
    if (cleanedText.length <= chunkSize) {
        return [{ chunkIndex: 0, chunkText: cleanedText }];
    }

    const paragraphs = cleanedText.split(/\n\s*\n/);
    const chunks = [];
    let currentChunk = '';
    let chunkIndex = 0;

    for (const paragraph of paragraphs) {
        const trimmedPara = paragraph.trim();
        if (!trimmedPara) continue;

        // If adding this paragraph exceeds chunk size, finalize current chunk
        if (currentChunk.length + trimmedPara.length + 2 > chunkSize && currentChunk.length >= MIN_CHUNK_SIZE) {
            chunks.push({
                chunkIndex,
                chunkText: currentChunk.trim(),
            });
            chunkIndex++;

            // Start new chunk with overlap from end of previous chunk
            if (overlap > 0 && currentChunk.length > overlap) {
                // Find a word boundary near the overlap point
                const overlapStart = currentChunk.length - overlap;
                const wordBoundary = currentChunk.indexOf(' ', overlapStart);
                const overlapText = wordBoundary !== -1
                    ? currentChunk.substring(wordBoundary + 1)
                    : currentChunk.substring(overlapStart);
                currentChunk = overlapText + '\n\n' + trimmedPara;
            } else {
                currentChunk = trimmedPara;
            }
        } else {
            currentChunk = currentChunk ? currentChunk + '\n\n' + trimmedPara : trimmedPara;
        }

        // Handle very long paragraphs that exceed chunk size on their own
        while (currentChunk.length > chunkSize) {
            // Find a word boundary near chunk size
            let splitPoint = currentChunk.lastIndexOf(' ', chunkSize);
            if (splitPoint === -1 || splitPoint < MIN_CHUNK_SIZE) {
                splitPoint = chunkSize;
            }

            chunks.push({
                chunkIndex,
                chunkText: currentChunk.substring(0, splitPoint).trim(),
            });
            chunkIndex++;

            // Overlap for next chunk
            const overlapStart = Math.max(0, splitPoint - overlap);
            currentChunk = currentChunk.substring(overlapStart).trim();
        }
    }

    // Add the remaining text as the last chunk
    if (currentChunk.trim().length >= MIN_CHUNK_SIZE) {
        chunks.push({
            chunkIndex,
            chunkText: currentChunk.trim(),
        });
    } else if (currentChunk.trim().length > 0 && chunks.length > 0) {
        // Append very small remaining text to the last chunk
        chunks[chunks.length - 1].chunkText += '\n\n' + currentChunk.trim();
    } else if (currentChunk.trim().length > 0) {
        // Edge case: only a tiny amount of text total
        chunks.push({
            chunkIndex: 0,
            chunkText: currentChunk.trim(),
        });
    }

    return chunks;
}
