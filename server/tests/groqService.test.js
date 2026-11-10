import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createGroqChatCompletion, extractCompletionText, FALLBACK_MODELS } from '../services/groqService.js';

describe('Groq Service Fallback & Extraction', () => {
    it('successfully extracts completion text from choices.message.content', () => {
        const mockResponse = {
            choices: [{
                message: {
                    content: 'Generated article content here',
                    reasoning: 'Thoughts here'
                }
            }]
        };
        const text = extractCompletionText(mockResponse);
        assert.strictEqual(text, 'Generated article content here');
    });

    it('falls back to reasoning when choices.message.content is empty', () => {
        const mockResponse = {
            choices: [{
                message: {
                    content: '',
                    reasoning: 'Fallback reasoning content'
                }
            }]
        };
        const text = extractCompletionText(mockResponse);
        assert.strictEqual(text, 'Fallback reasoning content');
    });

    it('handles empty choices or invalid response gracefully', () => {
        assert.strictEqual(extractCompletionText(null), '');
        assert.strictEqual(extractCompletionText({}), '');
        assert.strictEqual(extractCompletionText({ choices: [] }), '');
    });

    it('falls back to a working model when the primary model returns 404 / model_not_found', async () => {
        const callLog = [];
        const mockClient = {
            chat: {
                completions: {
                    create: async ({ model, messages }) => {
                        callLog.push(model);
                        if (model === 'llama-3.3-70b-versatile') {
                            const err = new Error('The model `llama-3.3-70b-versatile` does not exist or you do not have access to it.');
                            err.status = 404;
                            err.code = 'model_not_found';
                            throw err;
                        }
                        return {
                            choices: [{
                                message: { content: `Success from ${model}` }
                            }]
                        };
                    }
                }
            }
        };

        const res = await createGroqChatCompletion({
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: 'user', content: 'test' }]
        }, mockClient);

        assert.ok(callLog.includes('llama-3.3-70b-versatile'), 'Should attempt primary model first');
        assert.strictEqual(callLog[1], 'openai/gpt-oss-120b', 'Should fallback to supported model');
        assert.strictEqual(res.choices[0].message.content, 'Success from openai/gpt-oss-120b');
    });

    it('rethrows genuine client/server errors other than model_not_found', async () => {
        const mockClient = {
            chat: {
                completions: {
                    create: async () => {
                        const err = new Error('Invalid API key');
                        err.status = 401;
                        throw err;
                    }
                }
            }
        };

        await assert.rejects(
            async () => {
                await createGroqChatCompletion({
                    model: 'openai/gpt-oss-120b',
                    messages: [{ role: 'user', content: 'test' }]
                }, mockClient);
            },
            {
                status: 401,
                message: 'Invalid API key'
            }
        );
    });
});
