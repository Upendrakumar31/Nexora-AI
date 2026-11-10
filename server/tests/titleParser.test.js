import { describe, it } from 'node:test';
import assert from 'node:assert';
import { parseBlogTitles } from '../services/titleParser.js';

describe('Blog Title Parsing & Formatting Regression Tests', () => {
    it('parses exactly 5 titles from numbered bold markdown list with smart quotes', () => {
        const raw = `1. **“Coorg Trip 2024: The Ultimate Guide to Karnataka’s Green Paradise”**
2. **“10 Must‑See Spots on Your Coorg Adventure – From Coffee Plantations to Waterfalls”**
3. **“How to Plan a Perfect Coorg Getaway: Budget Tips, Itinerary & Travel Hacks”**
4. **“Coorg Travel Diary: Insider Secrets for an Unforgettable Weekend Escape”**
5. **“Why Coorg Is the Ideal Family Vacation Destination – Things to Do, Eat & Explore”**`;

        const titles = parseBlogTitles(raw);
        assert.strictEqual(titles.length, 5);
        assert.strictEqual(titles[0], 'Coorg Trip 2024: The Ultimate Guide to Karnataka’s Green Paradise');
        assert.strictEqual(titles[1], '10 Must‑See Spots on Your Coorg Adventure – From Coffee Plantations to Waterfalls');
        assert.strictEqual(titles[2], 'How to Plan a Perfect Coorg Getaway: Budget Tips, Itinerary & Travel Hacks');
        assert.strictEqual(titles[3], 'Coorg Travel Diary: Insider Secrets for an Unforgettable Weekend Escape');
        assert.strictEqual(titles[4], 'Why Coorg Is the Ideal Family Vacation Destination – Things to Do, Eat & Explore');
    });

    it('filters out conversational preamble and closing remarks', () => {
        const raw = `Here are 5 catchy, engaging, and SEO-friendly blog titles about "artificial intelligence":

1. AI Revolution: What You Need to Know in 2026
2. The Future of AI in Daily Life
3. Top 10 Artificial Intelligence Trends
4. How AI Is Transforming Modern Workplaces
5. The Beginner's Guide to Machine Learning and AI

Hope these help your blog!`;

        const titles = parseBlogTitles(raw);
        assert.strictEqual(titles.length, 5);
        assert.strictEqual(titles[0], 'AI Revolution: What You Need to Know in 2026');
        assert.strictEqual(titles[4], "The Beginner's Guide to Machine Learning and AI");
    });

    it('handles bulleted lists (- and * and •) without numbering', () => {
        const raw = `- Mastering Remote Work: 7 Productivity Habits
* 5 Tools Every Freelancer Should Use
• Budget Travel Hacks for Nomads
- How to Beat Procrastination
* Work-Life Balance in the Digital Age`;

        const titles = parseBlogTitles(raw);
        assert.strictEqual(titles.length, 5);
        assert.strictEqual(titles[0], 'Mastering Remote Work: 7 Productivity Habits');
        assert.strictEqual(titles[2], 'Budget Travel Hacks for Nomads');
    });

    it('removes raw unclosed markdown asterisks from truncated or malformed responses', () => {
        const raw = `1. **"Coorg Trip Essentials: The Complete Guide"**
2. **"10 Budget Travel Hacks for Coorg`;

        const titles = parseBlogTitles(raw);
        assert.strictEqual(titles.length, 2);
        assert.strictEqual(titles[0], 'Coorg Trip Essentials: The Complete Guide');
        assert.strictEqual(titles[1], '10 Budget Travel Hacks for Coorg');
        assert.ok(!titles[1].includes('**'), 'Raw markdown asterisks should be completely stripped');
    });

    it('returns empty array safely for null, undefined, or empty string', () => {
        assert.deepStrictEqual(parseBlogTitles(null), []);
        assert.deepStrictEqual(parseBlogTitles(undefined), []);
        assert.deepStrictEqual(parseBlogTitles(''), []);
        assert.deepStrictEqual(parseBlogTitles('   \n  \n  '), []);
    });

    it('extracts numbered items when output is inline without standard line breaks', () => {
        const raw = `1. Title Alpha 2. Title Beta 3. Title Gamma 4. Title Delta 5. Title Epsilon`;
        const titles = parseBlogTitles(raw);
        assert.strictEqual(titles.length, 5);
        assert.strictEqual(titles[0], 'Title Alpha');
        assert.strictEqual(titles[4], 'Title Epsilon');
    });
});
