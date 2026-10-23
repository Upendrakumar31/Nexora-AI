import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { uploadImage, uploadResume } from '../configs/multer.js';

describe('Upload Security & File Validation', () => {
    it('configures uploadImage with 10MB limit and image MIME filter', () => {
        assert.strictEqual(uploadImage.limits?.fileSize, 10 * 1024 * 1024);

        let accepted = false;
        let rejectedError = null;

        uploadImage.fileFilter(
            {},
            { mimetype: 'image/png', originalname: 'photo.png' },
            (err, pass) => {
                rejectedError = err;
                accepted = pass;
            }
        );

        assert.strictEqual(rejectedError, null);
        assert.strictEqual(accepted, true);

        // Reject executable or text files
        uploadImage.fileFilter(
            {},
            { mimetype: 'application/x-executable', originalname: 'malicious.exe' },
            (err, pass) => {
                rejectedError = err;
                accepted = pass;
            }
        );

        assert.ok(rejectedError instanceof Error);
        assert.ok(rejectedError.message.includes('Only JPEG, PNG, and WebP are allowed'));
    });

    it('configures uploadResume with 5MB limit and PDF MIME filter', () => {
        assert.strictEqual(uploadResume.limits?.fileSize, 5 * 1024 * 1024);

        let accepted = false;
        let rejectedError = null;

        uploadResume.fileFilter(
            {},
            { mimetype: 'application/pdf', originalname: 'resume.pdf' },
            (err, pass) => {
                rejectedError = err;
                accepted = pass;
            }
        );

        assert.strictEqual(rejectedError, null);
        assert.strictEqual(accepted, true);

        // Reject non-PDF documents
        uploadResume.fileFilter(
            {},
            { mimetype: 'image/jpeg', originalname: 'photo.jpg' },
            (err, pass) => {
                rejectedError = err;
                accepted = pass;
            }
        );

        assert.ok(rejectedError instanceof Error);
        assert.ok(rejectedError.message.includes('Only PDF files are accepted'));
    });
});
