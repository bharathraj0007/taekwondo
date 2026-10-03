import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export { cloudinary };

/**
 * Uploads a file buffer to Cloudinary and returns the secure URL.
 * @param fileBuffer The binary file buffer
 * @param folder Cloudinary target folder (e.g. 'players/regId' or 'slips/regId')
 * @param publicId Optional public_id to enforce deterministic naming
 * @param resourceType Cloudinary resource type: 'image' | 'raw' | 'auto'
 */
export const uploadToCloudinary = (
  fileBuffer: Buffer,
  folder: string,
  publicId?: string,
  resourceType: 'image' | 'raw' | 'auto' = 'auto'
): Promise<{ secure_url: string; public_id: string }> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        resource_type: resourceType,
        overwrite: true,
      },
      (error, result) => {
        if (error) {
          console.error('Cloudinary upload error:', error);
          reject(error);
        } else {
          resolve({
            secure_url: result!.secure_url,
            public_id: result!.public_id,
          });
        }
      }
    );
    uploadStream.end(fileBuffer);
  });
};
