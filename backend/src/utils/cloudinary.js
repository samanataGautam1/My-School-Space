const cloudinary = require('cloudinary').v2;

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

function isCloudinaryConfigured() {
    return !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
}

async function uploadToCloudinary(filePath, options = {}) {
    const defaults = {
        resource_type: 'auto',
        folder: 'school-space/materials',
        ...options
    };
    return cloudinary.uploader.upload(filePath, defaults);
}

async function deleteFromCloudinary(publicId, resourceType = 'video') {
    return cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
}

/**
 * Extract public_id from a Cloudinary URL.
 * E.g. https://res.cloudinary.com/xxx/video/upload/v123/school-space/materials/file.mp4
 * Returns "school-space/materials/file" (without extension)
 */
function extractPublicId(cloudinaryUrl) {
    try {
        const url = new URL(cloudinaryUrl);
        // Path: /cloud/resource_type/upload/vXXX/folder/file.ext
        const parts = url.pathname.split('/upload/');
        if (parts.length < 2) return null;
        const afterUpload = parts[1];
        // Remove version prefix (v123456789/)
        const withoutVersion = afterUpload.replace(/^v\d+\//, '');
        // Remove file extension
        return withoutVersion.replace(/\.[^/.]+$/, '');
    } catch {
        return null;
    }
}

function isCloudinaryUrl(url) {
    return url && url.includes('res.cloudinary.com');
}

module.exports = { cloudinary, uploadToCloudinary, deleteFromCloudinary, isCloudinaryConfigured, extractPublicId, isCloudinaryUrl };
