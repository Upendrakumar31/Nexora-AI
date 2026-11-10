import axios from 'axios';
import fs from 'fs';

export const CLIPDROP_API_URL = 'https://clipdrop-api.co/text-to-image/v1';
export const CLIPDROP_REMOVE_BG_URL = 'https://clipdrop-api.co/remove-background/v1';

/**
 * Retrieves the configured Clipdrop API key from the environment.
 */
export function getClipdropApiKey() {
    const key = process.env.CLIPDROP_API_KEY;
    if (key && !key.includes('your_') && key.trim() !== '') {
        return key.trim();
    }
    return '';
}

/**
 * Checks whether a valid Clipdrop API key is configured.
 */
export function hasValidClipdropKey() {
    return Boolean(getClipdropApiKey());
}

/**
 * Formats error responses received from Clipdrop API with clear, friendly messages.
 * Never logs or exposes API keys.
 *
 * @param {object} error - Axios error object.
 * @returns {Error} - Formatted error with status and friendly message.
 */
function parseClipdropError(error) {
    if (!error.response) {
        return error;
    }

    const status = error.response.status;
    let errorDetail = '';

    if (error.response.data) {
        try {
            const text = Buffer.isBuffer(error.response.data)
                ? error.response.data.toString('utf-8')
                : (error.response.data instanceof ArrayBuffer
                    ? Buffer.from(error.response.data).toString('utf-8')
                    : String(error.response.data));
            const parsed = JSON.parse(text);
            errorDetail = parsed.error || parsed.message || text;
        } catch {
            try {
                errorDetail = Buffer.from(error.response.data).toString('utf-8');
            } catch {}
        }
    }

    const lowerDetail = (errorDetail || '').toLowerCase();

    let friendlyMessage = '';
    if (status === 401 || status === 403 || lowerDetail.includes('invalid api key') || lowerDetail.includes('unauthorized')) {
        friendlyMessage = 'Invalid or unauthorized Clipdrop API key. Please check your CLIPDROP_API_KEY.';
    } else if (status === 429 || lowerDetail.includes('rate limit') || lowerDetail.includes('rate_limited')) {
        friendlyMessage = 'Rate limit reached. Please wait 30 seconds.';
    } else if (status === 402 || lowerDetail.includes('credit') || lowerDetail.includes('insufficient_credits')) {
        friendlyMessage = 'Insufficient Clipdrop credits. Please top up your Clipdrop account.';
    } else {
        friendlyMessage = errorDetail || `Clipdrop API error (HTTP ${status}).`;
    }

    const customError = new Error(friendlyMessage);
    customError.status = status;
    customError.statusCode = status;
    customError.response = { status, data: errorDetail };
    return customError;
}

/**
 * Generates an image buffer from a text prompt using Clipdrop Text-to-Image API.
 *
 * @param {string} prompt - Text description of the image to generate.
 * @param {object} [options] - Optional custom overrides or HTTP client for dependency injection in tests.
 * @returns {Promise<{ buffer: Buffer, mimeType: string, provider: string }>}
 */
export async function generateImageBuffer(prompt, options = {}) {
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        throw new Error('A valid text prompt is required for image generation.');
    }

    const apiKey = options.apiKey || getClipdropApiKey();
    if (!apiKey) {
        throw new Error('CLIPDROP_API_KEY is not configured or is invalid. Please set CLIPDROP_API_KEY in your environment.');
    }

    const httpClient = options.httpClient || axios;
    const timeout = options.timeout || 30000;

    const formData = new FormData();
    formData.append('prompt', prompt.trim());

    try {
        const response = await httpClient.post(
            CLIPDROP_API_URL,
            formData,
            {
                headers: {
                    'x-api-key': apiKey,
                },
                responseType: 'arraybuffer',
                timeout,
            }
        );

        if (!response || response.data === undefined || response.data === null) {
            throw new Error('Invalid response received from Clipdrop: missing data.');
        }

        const buffer = Buffer.isBuffer(response.data)
            ? response.data
            : Buffer.from(response.data);

        if (buffer.length === 0) {
            throw new Error('Empty image buffer received from Clipdrop.');
        }

        const rawContentType = response.headers?.['content-type'] || '';
        const mimeType = rawContentType.split(';')[0].trim().toLowerCase() || 'image/png';

        if (!mimeType.startsWith('image/')) {
            throw new Error(`Expected image response from Clipdrop, but received Content-Type "${mimeType}".`);
        }

        return {
            buffer,
            mimeType,
            provider: 'clipdrop',
        };
    } catch (error) {
        throw parseClipdropError(error);
    }
}

/**
 * Removes background from an image file or buffer using Clipdrop Remove Background API.
 *
 * @param {string|Buffer} imageInput - Path to image file or Buffer of the image.
 * @param {object} [options] - Optional custom overrides or HTTP client for testing.
 * @returns {Promise<{ buffer: Buffer, mimeType: string, provider: string }>}
 */
export async function removeBackgroundBuffer(imageInput, options = {}) {
    if (!imageInput) {
        throw new Error('An image input (path or buffer) is required for background removal.');
    }

    const apiKey = options.apiKey || getClipdropApiKey();
    if (!apiKey) {
        throw new Error('CLIPDROP_API_KEY is not configured or is invalid. Please set CLIPDROP_API_KEY in your environment.');
    }

    const httpClient = options.httpClient || axios;
    const timeout = options.timeout || 30000;

    let imageBuffer;
    if (Buffer.isBuffer(imageInput)) {
        imageBuffer = imageInput;
    } else if (typeof imageInput === 'string') {
        imageBuffer = fs.readFileSync(imageInput);
    } else {
        throw new Error('Invalid image input type. Expected Buffer or file path string.');
    }

    if (imageBuffer.length === 0) {
        throw new Error('Empty image input provided for background removal.');
    }

    const formData = new FormData();
    formData.append('image_file', new Blob([imageBuffer], { type: 'image/png' }), 'image.png');

    try {
        const response = await httpClient.post(
            CLIPDROP_REMOVE_BG_URL,
            formData,
            {
                headers: {
                    'x-api-key': apiKey,
                },
                responseType: 'arraybuffer',
                timeout,
            }
        );

        if (!response || response.data === undefined || response.data === null) {
            throw new Error('Invalid response received from Clipdrop: missing data.');
        }

        const buffer = Buffer.isBuffer(response.data)
            ? response.data
            : Buffer.from(response.data);

        if (buffer.length === 0) {
            throw new Error('Empty image buffer received from Clipdrop background removal.');
        }

        const rawContentType = response.headers?.['content-type'] || '';
        const mimeType = rawContentType.split(';')[0].trim().toLowerCase() || 'image/png';

        return {
            buffer,
            mimeType,
            provider: 'clipdrop',
        };
    } catch (error) {
        throw parseClipdropError(error);
    }
}

export default {
    CLIPDROP_API_URL,
    CLIPDROP_REMOVE_BG_URL,
    getClipdropApiKey,
    hasValidClipdropKey,
    generateImageBuffer,
    removeBackgroundBuffer,
};
