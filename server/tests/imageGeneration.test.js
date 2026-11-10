import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
    CLIPDROP_API_URL,
    CLIPDROP_REMOVE_BG_URL,
    getClipdropApiKey,
    hasValidClipdropKey,
    generateImageBuffer,
    removeBackgroundBuffer,
} from '../services/imageService.js';

describe('Image Generation Service: Clipdrop Text-to-Image API Integration', () => {
    const originalClipdropKey = process.env.CLIPDROP_API_KEY;

    afterEach(() => {
        if (originalClipdropKey !== undefined) {
            process.env.CLIPDROP_API_KEY = originalClipdropKey;
        } else {
            delete process.env.CLIPDROP_API_KEY;
        }
    });

    it('identifies placeholder, empty, and missing Clipdrop keys correctly', () => {
        delete process.env.CLIPDROP_API_KEY;
        assert.strictEqual(hasValidClipdropKey(), false);
        assert.strictEqual(getClipdropApiKey(), '');

        process.env.CLIPDROP_API_KEY = '';
        assert.strictEqual(hasValidClipdropKey(), false);
        assert.strictEqual(getClipdropApiKey(), '');

        process.env.CLIPDROP_API_KEY = 'your_clipdrop_key_here';
        assert.strictEqual(hasValidClipdropKey(), false);
        assert.strictEqual(getClipdropApiKey(), '');

        process.env.CLIPDROP_API_KEY = 'real_clipdrop_secret_key_123';
        assert.strictEqual(hasValidClipdropKey(), true);
        assert.strictEqual(getClipdropApiKey(), 'real_clipdrop_secret_key_123');
    });

    it('throws when calling generateImageBuffer without valid CLIPDROP_API_KEY', async () => {
        delete process.env.CLIPDROP_API_KEY;

        await assert.rejects(
            async () => generateImageBuffer('A cute cat'),
            /CLIPDROP_API_KEY is not configured or is invalid/
        );
    });

    it('rejects empty or non-string prompts before dispatching requests', async () => {
        process.env.CLIPDROP_API_KEY = 'mock_clipdrop_key';

        await assert.rejects(
            async () => generateImageBuffer(''),
            /valid text prompt is required/
        );
        await assert.rejects(
            async () => generateImageBuffer('   '),
            /valid text prompt is required/
        );
        await assert.rejects(
            async () => generateImageBuffer(null),
            /valid text prompt is required/
        );
        await assert.rejects(
            async () => generateImageBuffer(12345),
            /valid text prompt is required/
        );
    });

    it('dispatches POST to Clipdrop endpoint with multipart FormData and x-api-key header (Mocked)', async () => {
        process.env.CLIPDROP_API_KEY = 'mock_clipdrop_key_12345';
        const mockBinaryData = Buffer.from('mock_png_image_binary_data');

        let calledUrl = '';
        let calledHeaders = {};
        let calledFormData = null;
        let calledResponseType = '';

        const mockHttpClient = {
            post: async (url, formData, config) => {
                calledUrl = url;
                calledHeaders = config.headers;
                calledFormData = formData;
                calledResponseType = config.responseType;
                return {
                    status: 200,
                    data: mockBinaryData,
                    headers: { 'content-type': 'image/png' },
                };
            },
        };

        const result = await generateImageBuffer('A futuristic floating garden', {
            httpClient: mockHttpClient,
        });

        assert.strictEqual(result.provider, 'clipdrop');
        assert.strictEqual(result.mimeType, 'image/png');
        assert.ok(Buffer.isBuffer(result.buffer));
        assert.strictEqual(result.buffer.toString(), 'mock_png_image_binary_data');
        assert.strictEqual(calledUrl, CLIPDROP_API_URL);
        assert.strictEqual(calledUrl, 'https://clipdrop-api.co/text-to-image/v1');
        assert.strictEqual(calledHeaders['x-api-key'], 'mock_clipdrop_key_12345');
        assert.strictEqual(calledResponseType, 'arraybuffer');
        assert.ok(calledFormData instanceof FormData);
        assert.strictEqual(calledFormData.get('prompt'), 'A futuristic floating garden');
    });

    it('handles image/jpeg Content-Type properly', async () => {
        process.env.CLIPDROP_API_KEY = 'mock_clipdrop_key_12345';
        const mockJpegData = Buffer.from('mock_jpeg_image_binary_data');

        const mockHttpClient = {
            post: async () => ({
                status: 200,
                data: mockJpegData,
                headers: { 'content-type': 'image/jpeg; charset=binary' },
            }),
        };

        const result = await generateImageBuffer('Desert sunset', {
            httpClient: mockHttpClient,
        });

        assert.strictEqual(result.provider, 'clipdrop');
        assert.strictEqual(result.mimeType, 'image/jpeg');
        assert.strictEqual(result.buffer.toString(), 'mock_jpeg_image_binary_data');
    });

    it('rejects empty image buffer responses', async () => {
        process.env.CLIPDROP_API_KEY = 'mock_clipdrop_key';
        const mockHttpClient = {
            post: async () => ({
                status: 200,
                data: Buffer.alloc(0),
                headers: { 'content-type': 'image/png' },
            }),
        };

        await assert.rejects(
            async () => generateImageBuffer('A sunset', { httpClient: mockHttpClient }),
            /Empty image buffer received from Clipdrop/
        );
    });

    it('rejects non-image responses (e.g. text/html or application/json in 200 OK)', async () => {
        process.env.CLIPDROP_API_KEY = 'mock_clipdrop_key';
        const mockHttpClient = {
            post: async () => ({
                status: 200,
                data: Buffer.from('<html>error</html>'),
                headers: { 'content-type': 'text/html' },
            }),
        };

        await assert.rejects(
            async () => generateImageBuffer('A sunset', { httpClient: mockHttpClient }),
            /Expected image response from Clipdrop, but received Content-Type "text\/html"/
        );
    });

    it('handles HTTP 401 Unauthorized / Invalid API key with clear message', async () => {
        process.env.CLIPDROP_API_KEY = 'invalid_clipdrop_key';
        const mockHttpClient = {
            post: async () => {
                const error = new Error('Request failed with status code 401');
                error.response = {
                    status: 401,
                    data: Buffer.from(JSON.stringify({ error: 'Invalid API key' })),
                };
                throw error;
            },
        };

        await assert.rejects(
            async () => generateImageBuffer('A cybernetic owl', { httpClient: mockHttpClient }),
            (err) => {
                assert.strictEqual(err.status, 401);
                assert.ok(err.message.includes('Invalid or unauthorized Clipdrop API key'));
                assert.ok(!err.message.includes('invalid_clipdrop_key'), 'Must never expose API key');
                return true;
            }
        );
    });

    it('handles HTTP 429 Rate limit error with clear message', async () => {
        process.env.CLIPDROP_API_KEY = 'mock_clipdrop_key';
        const mockHttpClient = {
            post: async () => {
                const error = new Error('Request failed with status code 429');
                error.response = {
                    status: 429,
                    data: Buffer.from(JSON.stringify({ error: 'rate_limited' })),
                };
                throw error;
            },
        };

        await assert.rejects(
            async () => generateImageBuffer('A cybernetic owl', { httpClient: mockHttpClient }),
            (err) => {
                assert.strictEqual(err.status, 429);
                assert.ok(err.message.includes('Rate limit reached'));
                return true;
            }
        );
    });

    it('handles insufficient credits error with clear message', async () => {
        process.env.CLIPDROP_API_KEY = 'mock_clipdrop_key';
        const mockHttpClient = {
            post: async () => {
                const error = new Error('Request failed with status code 402');
                error.response = {
                    status: 402,
                    data: Buffer.from(JSON.stringify({ error: 'insufficient_credits' })),
                };
                throw error;
            },
        };

        await assert.rejects(
            async () => generateImageBuffer('A cybernetic owl', { httpClient: mockHttpClient }),
            (err) => {
                assert.strictEqual(err.status, 402);
                assert.ok(err.message.includes('Insufficient Clipdrop credits'));
                return true;
            }
        );
    });
});

describe('Clipdrop Remove Background API Integration', () => {
    const originalClipdropKey = process.env.CLIPDROP_API_KEY;

    afterEach(() => {
        if (originalClipdropKey !== undefined) {
            process.env.CLIPDROP_API_KEY = originalClipdropKey;
        } else {
            delete process.env.CLIPDROP_API_KEY;
        }
    });

    it('identifies CLIPDROP_REMOVE_BG_URL correctly', () => {
        assert.strictEqual(CLIPDROP_REMOVE_BG_URL, 'https://clipdrop-api.co/remove-background/v1');
    });

    it('throws when calling removeBackgroundBuffer without valid CLIPDROP_API_KEY', async () => {
        delete process.env.CLIPDROP_API_KEY;

        await assert.rejects(
            async () => removeBackgroundBuffer(Buffer.from('fake_image')),
            /CLIPDROP_API_KEY is not configured or is invalid/
        );
    });

    it('rejects missing or empty image inputs', async () => {
        process.env.CLIPDROP_API_KEY = 'mock_clipdrop_key';

        await assert.rejects(
            async () => removeBackgroundBuffer(null),
            /An image input \(path or buffer\) is required/
        );
        await assert.rejects(
            async () => removeBackgroundBuffer(Buffer.alloc(0)),
            /Empty image input provided for background removal/
        );
    });

    it('dispatches POST to remove-background endpoint with image_file in FormData (Mocked)', async () => {
        process.env.CLIPDROP_API_KEY = 'mock_clipdrop_key_bg';
        const inputPng = Buffer.from('mock_input_png_binary');
        const outputPng = Buffer.from('mock_output_nobg_png_binary');

        let calledUrl = '';
        let calledHeaders = {};
        let calledResponseType = '';

        const mockHttpClient = {
            post: async (url, formData, config) => {
                calledUrl = url;
                calledHeaders = config.headers;
                calledResponseType = config.responseType;
                return {
                    status: 200,
                    data: outputPng,
                    headers: { 'content-type': 'image/png' },
                };
            },
        };

        const result = await removeBackgroundBuffer(inputPng, {
            httpClient: mockHttpClient,
        });

        assert.strictEqual(calledUrl, CLIPDROP_REMOVE_BG_URL);
        assert.strictEqual(calledHeaders['x-api-key'], 'mock_clipdrop_key_bg');
        assert.strictEqual(calledResponseType, 'arraybuffer');
        assert.strictEqual(result.provider, 'clipdrop');
        assert.strictEqual(result.mimeType, 'image/png');
        assert.strictEqual(result.buffer.toString(), 'mock_output_nobg_png_binary');
    });

    it('maps Clipdrop error responses cleanly without exposing API keys', async () => {
        process.env.CLIPDROP_API_KEY = 'secret_clipdrop_bg_key';

        const mockHttpClient = {
            post: async () => {
                const error = new Error('Request failed with status code 403');
                error.response = {
                    status: 403,
                    data: Buffer.from(JSON.stringify({ error: 'unauthorized' })),
                };
                throw error;
            },
        };

        await assert.rejects(
            async () => removeBackgroundBuffer(Buffer.from('fake'), { httpClient: mockHttpClient }),
            (err) => {
                assert.strictEqual(err.status, 403);
                assert.ok(err.message.includes('Invalid or unauthorized Clipdrop API key'));
                assert.ok(!err.message.includes('secret_clipdrop_bg_key'));
                return true;
            }
        );
    });
});
