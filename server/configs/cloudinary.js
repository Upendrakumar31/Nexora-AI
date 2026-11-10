import { v2 as cloudinary } from 'cloudinary';

const connectCloudinary = async () => {
    // If CLOUDINARY_URL is provided, allow the Cloudinary SDK to parse it directly
    // without clobbering it with undefined individual environment properties.
    if (process.env.CLOUDINARY_URL) {
        cloudinary.config(true);
        return;
    }

    const config = {};
    if (process.env.CLOUDINARY_CLOUD_NAME) {
        config.cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
    }
    if (process.env.CLOUDINARY_API_KEY) {
        config.api_key = process.env.CLOUDINARY_API_KEY;
    }
    if (process.env.CLOUDINARY_API_SECRET) {
        config.api_secret = process.env.CLOUDINARY_API_SECRET;
    }

    if (Object.keys(config).length > 0) {
        cloudinary.config(config);
    }
};

export default connectCloudinary;