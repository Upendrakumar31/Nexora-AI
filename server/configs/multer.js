import multer from "multer";

const storage = multer.diskStorage({});

// Image upload filter: JPEG, PNG, WebP, max 10MB
export const uploadImage = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (_req, file, cb) => {
        const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid image file type. Only JPEG, PNG, and WebP are allowed.'));
        }
    },
});

// Resume upload filter: PDF only, max 5MB
export const uploadResume = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (_req, file, cb) => {
        const isPdfMime = file.mimetype === 'application/pdf';
        const isPdfExt = file.originalname?.toLowerCase().endsWith('.pdf');
        if (isPdfMime || isPdfExt) {
            cb(null, true);
        } else {
            cb(new Error('Invalid document file type. Only PDF files are accepted for resume review.'));
        }
    },
});

// Safe bounded upload for backward compatibility
export const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
});

