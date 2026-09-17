/**
 * THE PROFILE PHOTO, KEPT WHERE THE PHONE WILL NOT THROW IT AWAY.
 *
 * WHAT WAS WRONG
 * ──────────────
 * The picker hands back a file in the app's CACHE folder, and that address was
 * saved straight into the store. iOS and Android are both allowed to empty a
 * cache folder whenever they like, and updating or clearing Expo Go does it too.
 * When that happened the store still said "there is a photo", so the avatar drew
 * a picture of a file that no longer existed: an empty circle, with no letter in
 * it and no way for anybody to tell what had gone wrong.
 *
 * On web it was worse. The picker returns a blob: address, which stops meaning
 * anything the moment the page reloads, and that was saved too.
 *
 * WHAT THIS DOES
 * ──────────────
 * On a phone the picked photo is COPIED into the documents folder, which the
 * system does not clear, and the copy is what gets saved. On web the photo is
 * saved as the picture itself (a data: address) rather than a pointer to it.
 *
 * WHY THE FILE NAME IS RE-ATTACHED EVERY TIME IT IS READ. On iOS the documents
 * folder's full path changes when the app is updated or restored, because the
 * app's container gets a new identifier. A saved absolute path is therefore
 * wrong after an update even though the file is still there. Only the file name
 * is stable, so photoSource() puts today's documents folder back in front of it.
 */
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

/** Every kept photo's name starts with this, so an old one can be recognised. */
const PREFIX = 'profile-photo-';

/** The last path segment of a URI, without any query string. */
function fileName(uri: string): string {
  return uri.split('?')[0].split('/').pop() ?? '';
}

/**
 * Keep a freshly picked photo somewhere permanent, and return what to save.
 *
 * `base64` is only used on web, where there is no file to copy. If the copy
 * fails for any reason the original address is returned, which is exactly what
 * the app saved before, so a failure here can never be worse than it was.
 */
export async function keepProfilePhoto(
  pickedUri: string,
  base64?: string | null,
  mimeType?: string | null,
  previous?: string | null
): Promise<string> {
  if (Platform.OS === 'web') {
    return base64 ? `data:${mimeType ?? 'image/jpeg'};base64,${base64}` : pickedUri;
  }
  const dir = FileSystem.documentDirectory;
  if (!dir) return pickedUri;
  try {
    // A new name each time, so the Image does not keep showing the old photo
    // from its own memory under the same address.
    const ext = (fileName(pickedUri).split('.').pop() || 'jpg').toLowerCase();
    const target = `${dir}${PREFIX}${Date.now()}.${ext}`;
    await FileSystem.copyAsync({ from: pickedUri, to: target });
    // Tidy the photo this one replaces. Never fatal: a leftover file costs a
    // few hundred kilobytes, and a thrown error here would lose the new photo.
    if (previous && fileName(previous).startsWith(PREFIX)) {
      FileSystem.deleteAsync(`${dir}${fileName(previous)}`, { idempotent: true }).catch(() => {});
    }
    return target;
  } catch {
    return pickedUri;
  }
}

/**
 * What to hand to <Image source={{ uri }}> for a saved photo.
 *
 * A kept photo gets today's documents folder put back in front of its name (see
 * the docblock). Anything else - an old cache address saved before this fix, a
 * data: address on web - is returned untouched.
 */
export function photoSource(saved: string): string {
  if (Platform.OS === 'web') return saved;
  const name = fileName(saved);
  const dir = FileSystem.documentDirectory;
  if (dir && name.startsWith(PREFIX)) return `${dir}${name}`;
  return saved;
}
