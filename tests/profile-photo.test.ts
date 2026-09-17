/**
 * THE PROFILE PHOTO IS KEPT, AND STILL FOUND AFTER AN UPDATE.
 *
 * Runs lib/profile-photo.ts against a fake file system whose documents folder
 * can be moved, which is what iOS does to an app's container on update.
 */
const mockFiles = new Map<string, string>();
const mockFs = {
  documentDirectory: 'file:///container-A/Documents/' as string | null,
  copyAsync: jest.fn(async ({ from, to }: { from: string; to: string }) => {
    if (!mockFiles.has(from)) throw new Error('no such file');
    mockFiles.set(to, mockFiles.get(from)!);
  }),
  deleteAsync: jest.fn(async (uri: string, _opts?: unknown) => {
    mockFiles.delete(uri);
  }),
};
// Read lazily: the factory runs when the module under test is imported, which is
// hoisted above these declarations.
jest.mock('expo-file-system/legacy', () => ({
  get documentDirectory() {
    return mockFs.documentDirectory;
  },
  copyAsync: (o: { from: string; to: string }) => mockFs.copyAsync(o),
  deleteAsync: (uri: string, opts?: unknown) => mockFs.deleteAsync(uri, opts),
}));

import { Platform } from 'react-native';
import { keepProfilePhoto, photoSource } from '@/lib/profile-photo';

const CACHE = 'file:///container-A/Library/Caches/ImagePicker/abc.jpg';

beforeEach(() => {
  mockFiles.clear();
  mockFs.documentDirectory = 'file:///container-A/Documents/';
  mockFs.copyAsync.mockClear();
  mockFs.deleteAsync.mockClear();
  (Platform as { OS: string }).OS = 'ios';
});

test('a picked photo is copied out of the cache, and the copy is what is saved', async () => {
  mockFiles.set(CACHE, 'jpeg-bytes');
  const saved = await keepProfilePhoto(CACHE);
  expect(saved.startsWith('file:///container-A/Documents/profile-photo-')).toBe(true);
  expect(mockFiles.get(saved)).toBe('jpeg-bytes');
  // The cache can now be emptied without losing the photo.
  mockFiles.delete(CACHE);
  expect(mockFiles.has(saved)).toBe(true);
});

test('after an update moves the documents folder, the saved photo is still found', async () => {
  mockFiles.set(CACHE, 'jpeg-bytes');
  const saved = await keepProfilePhoto(CACHE);
  const name = saved.split('/').pop()!;
  // The app is updated: same file, new container path.
  mockFs.documentDirectory = 'file:///container-B/Documents/';
  mockFiles.set(`file:///container-B/Documents/${name}`, mockFiles.get(saved)!);
  expect(photoSource(saved)).toBe(`file:///container-B/Documents/${name}`);
});

test('picking a new photo tidies the one it replaces', async () => {
  mockFiles.set(CACHE, 'first');
  const first = await keepProfilePhoto(CACHE);
  mockFiles.set(CACHE, 'second');
  // A distinct name each time, so the Image never shows the old one from memory.
  await new Promise((r) => setTimeout(r, 2));
  const second = await keepProfilePhoto(CACHE, null, null, first);
  expect(second).not.toBe(first);
  expect(mockFs.deleteAsync).toHaveBeenCalledWith(first, { idempotent: true });
});

test('if the copy fails, the original address is saved, which is no worse than before', async () => {
  const saved = await keepProfilePhoto('file:///gone.jpg');
  expect(saved).toBe('file:///gone.jpg');
});

test('an address saved before this fix is left exactly as it was', () => {
  expect(photoSource(CACHE)).toBe(CACHE);
});

test('on web the picture itself is saved, because a blob address dies on reload', async () => {
  (Platform as { OS: string }).OS = 'web';
  const saved = await keepProfilePhoto('blob:http://x/123', 'QUJD', 'image/png');
  expect(saved).toBe('data:image/png;base64,QUJD');
  expect(photoSource(saved)).toBe(saved);
  expect(mockFs.copyAsync).not.toHaveBeenCalled();
});
