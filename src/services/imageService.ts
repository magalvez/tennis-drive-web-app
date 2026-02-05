import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "../config/firebase";

/**
 * Uploads an image to Firebase Storage and returns the download URL.
 * @param file File object from the browser input.
 * @param path Storage path (e.g., 'tournaments/imageId').
 * @returns Promise<string> Download URL.
 */
export const uploadImage = async (file: File, path: string): Promise<string> => {
    try {
        // 1. Create a reference
        const storageRef = ref(storage, path);

        // 2. Upload
        const snapshot = await uploadBytes(storageRef, file);

        // 3. Get URL
        const downloadURL = await getDownloadURL(snapshot.ref);

        return downloadURL;
    } catch (error) {
        console.error("Error uploading image:", error);
        throw error;
    }
};

/**
 * Deletes an image from Firebase Storage using its URL.
 * @param imageUrl The full download URL of the image.
 */
export const deleteImage = async (imageUrl: string) => {
    try {
        const storageRef = ref(storage, imageUrl);
        await deleteObject(storageRef);
    } catch (error) {
        console.error("Error deleting image:", error);
        throw error;
    }
};
