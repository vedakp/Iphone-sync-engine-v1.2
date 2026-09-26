import { MediaItem, MediaType } from '../types';

const IMAGE_EXTENSIONS = new Set([
  'heic',
  'heif',
  'jpg',
  'jpeg',
  'png',
  'gif',
  'tiff',
  'tif',
  'webp',
  'dng',
  'raw',
  'cr2',
  'nef',
  'arw',
]);

const VIDEO_EXTENSIONS = new Set(['mov', 'mp4', 'm4v', 'avi', 'mkv', '3gp']);

export function isSupportedMedia(filename: string): boolean {
  const ext = getExtension(filename);
  return IMAGE_EXTENSIONS.has(ext) || VIDEO_EXTENSIONS.has(ext);
}

export function getExtension(filename: string): string {
  const parts = filename.toLowerCase().split('.');
  return parts.length > 1 ? parts.pop() || '' : '';
}

export function getMediaType(extension: string): MediaType {
  return VIDEO_EXTENSIONS.has(extension) ? 'video' : 'photo';
}

/**
 * Scans a FileSystemDirectoryHandle recursively for iPhone media
 */
export async function scanDirectoryHandle(
  dirHandle: FileSystemDirectoryHandle,
  deviceId: string,
  onProgress?: (count: number, currentPath: string) => void
): Promise<MediaItem[]> {
  const items: MediaItem[] = [];
  let counter = 0;

  async function walk(handle: FileSystemDirectoryHandle, currentPath: string) {
    for await (const entry of handle.values()) {
      const fullPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
      if (entry.kind === 'directory') {
        await walk(entry as FileSystemDirectoryHandle, fullPath);
      } else if (entry.kind === 'file') {
        if (isSupportedMedia(entry.name)) {
          const fileHandle = entry as FileSystemFileHandle;
          const file = await fileHandle.getFile();
          const ext = getExtension(file.name);
          const mediaType = getMediaType(ext);

          const item: MediaItem = {
            id: `${deviceId}:${fullPath}:${file.size}`,
            deviceId,
            filename: file.name,
            mediaType,
            extension: ext,
            size: file.size,
            createdAt: new Date(file.lastModified).toISOString(),
            modifiedAt: new Date(file.lastModified).toISOString(),
            sourceIdentifier: fullPath,
            isSynced: false,
            syncStatus: 'new',
            fileHandle,
            file,
          };

          items.push(item);
          counter++;
          if (onProgress && counter % 10 === 0) {
            onProgress(counter, fullPath);
          }
        }
      }
    }
  }

  await walk(dirHandle, '');
  if (onProgress) onProgress(items.length, 'Scan complete');
  return pairLivePhotos(items);
}

/**
 * Scans dropped items from DataTransfer (Drag and Drop)
 */
export async function scanDataTransferItems(
  dataTransfer: DataTransfer,
  deviceId: string,
  onProgress?: (count: number, currentPath: string) => void
): Promise<MediaItem[]> {
  const items: MediaItem[] = [];
  const entries: FileSystemEntry[] = [];

  const dtItems = dataTransfer.items;
  if (dtItems) {
    for (let i = 0; i < dtItems.length; i++) {
      const item = dtItems[i];
      if (item.kind === 'file') {
        const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
        if (entry) entries.push(entry);
      }
    }
  }

  let counter = 0;

  async function readEntry(entry: FileSystemEntry, currentPath: string) {
    const fullPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
    if (entry.isFile) {
      const fileEntry = entry as FileSystemFileEntry;
      const file = await new Promise<File>((resolve, reject) => {
        fileEntry.file(resolve, reject);
      });

      if (isSupportedMedia(file.name)) {
        const ext = getExtension(file.name);
        const item: MediaItem = {
          id: `${deviceId}:${fullPath}:${file.size}`,
          deviceId,
          filename: file.name,
          mediaType: getMediaType(ext),
          extension: ext,
          size: file.size,
          createdAt: new Date(file.lastModified).toISOString(),
          modifiedAt: new Date(file.lastModified).toISOString(),
          sourceIdentifier: fullPath,
          isSynced: false,
          syncStatus: 'new',
          file,
        };
        items.push(item);
        counter++;
        if (onProgress && counter % 10 === 0) {
          onProgress(counter, fullPath);
        }
      }
    } else if (entry.isDirectory) {
      const dirEntry = entry as FileSystemDirectoryEntry;
      const dirReader = dirEntry.createReader();
      const readEntries = async (): Promise<FileSystemEntry[]> => {
        return new Promise((resolve, reject) => {
          dirReader.readEntries(resolve, reject);
        });
      };

      let batch: FileSystemEntry[];
      do {
        batch = await readEntries();
        for (const child of batch) {
          await readEntry(child, fullPath);
        }
      } while (batch.length > 0);
    }
  }

  for (const entry of entries) {
    await readEntry(entry, '');
  }

  // If no webkitGetAsEntry entries were found, fallback to direct files
  if (items.length === 0 && dataTransfer.files.length > 0) {
    for (let i = 0; i < dataTransfer.files.length; i++) {
      const file = dataTransfer.files[i];
      if (isSupportedMedia(file.name)) {
        const ext = getExtension(file.name);
        items.push({
          id: `${deviceId}:${file.name}:${file.size}`,
          deviceId,
          filename: file.name,
          mediaType: getMediaType(ext),
          extension: ext,
          size: file.size,
          createdAt: new Date(file.lastModified).toISOString(),
          modifiedAt: new Date(file.lastModified).toISOString(),
          sourceIdentifier: file.name,
          isSynced: false,
          syncStatus: 'new',
          file,
        });
      }
    }
  }

  if (onProgress) onProgress(items.length, 'Scan complete');
  return pairLivePhotos(items);
}

/**
 * Scans FileList from standard directory input (<input webkitdirectory>)
 */
export function scanFileList(
  fileList: FileList,
  deviceId: string,
  onProgress?: (count: number, currentPath: string) => void
): MediaItem[] {
  const items: MediaItem[] = [];

  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    if (isSupportedMedia(file.name)) {
      const ext = getExtension(file.name);
      // webkitRelativePath gives DCIM/100APPLE/IMG_0001.HEIC
      const sourcePath = (file as unknown as { webkitRelativePath?: string }).webkitRelativePath || file.name;

      items.push({
        id: `${deviceId}:${sourcePath}:${file.size}`,
        deviceId,
        filename: file.name,
        mediaType: getMediaType(ext),
        extension: ext,
        size: file.size,
        createdAt: new Date(file.lastModified).toISOString(),
        modifiedAt: new Date(file.lastModified).toISOString(),
        sourceIdentifier: sourcePath,
        isSynced: false,
        syncStatus: 'new',
        file,
      });

      if (onProgress && items.length % 50 === 0) {
        onProgress(items.length, sourcePath);
      }
    }
  }

  if (onProgress) onProgress(items.length, 'Scan complete');
  return pairLivePhotos(items);
}

/**
 * Identify Live Photo pairs (same base filename with .HEIC/.JPG and .MOV)
 */
function pairLivePhotos(items: MediaItem[]): MediaItem[] {
  const map = new Map<string, MediaItem[]>();

  for (const item of items) {
    const baseName = item.filename.substring(0, item.filename.lastIndexOf('.')).toLowerCase();
    const group = map.get(baseName) || [];
    group.push(item);
    map.set(baseName, group);
  }

  for (const [, group] of map) {
    const hasImage = group.some((m) => m.mediaType === 'photo');
    const hasVideo = group.some((m) => m.mediaType === 'video');
    if (hasImage && hasVideo) {
      const pairId = `live_${group[0].filename}`;
      for (const item of group) {
        item.livePhotoPairId = pairId;
      }
    }
  }

  return items;
}
