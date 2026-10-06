import { storage } from "./firebase";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";

/**
 * Uploads a file to Firebase Storage and returns the download URL.
 * @param file The file to upload (Blob or File)
 * @param path The path in storage (e.g., 'profile_images/userId.jpg')
 */
export async function uploadFileToFirebase(file: Blob | File, path: string): Promise<string> {
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  const downloadURL = await getDownloadURL(storageRef);
  return downloadURL;
}

/**
 * Deletes a file from Firebase Storage.
 * @param path The path in storage (e.g., 'profile_images/userId.jpg')
 */
export async function deleteFileFromFirebase(path: string): Promise<void> {
  const storageRef = ref(storage, path);
  await deleteObject(storageRef);
}

export function getStoragePathFromFirebaseUrl(url?: string | null): string | null {
  if (!url) return null;

  try {
    const parsedUrl = new URL(url);
    const marker = "/o/";
    const encodedPath = parsedUrl.pathname.includes(marker)
      ? parsedUrl.pathname.split(marker)[1]
      : null;

    return encodedPath ? decodeURIComponent(encodedPath) : null;
  } catch {
    return null;
  }
}
