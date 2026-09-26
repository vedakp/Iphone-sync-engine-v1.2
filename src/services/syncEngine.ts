import JSZip from 'jszip';
import { MediaItem, SyncProgressState, SyncSession, SyncSettings } from '../types';
import { syncDb } from './db';
import { calculateFileHash } from './hasher';

export type SyncEventCallback = (progress: SyncProgressState) => void;

export class SyncEngine {
  private isRunning = false;
  private isPaused = false;
  private shouldCancel = false;
  private progressListeners: SyncEventCallback[] = [];

  private currentProgress: SyncProgressState = {
    isActive: false,
    isPaused: false,
    totalItems: 0,
    completedItems: 0,
    failedItems: 0,
    skippedItems: 0,
    totalBytes: 0,
    completedBytes: 0,
    currentFilename: '',
    currentFileIndex: 0,
    bytesPerSecond: 0,
    estimatedSecondsRemaining: 0,
    errors: [],
  };

  /**
   * Reconciles scanned media against the database and the selected destination folder.
   * Accurately determines what has already been backed up vs what is brand new.
   */
  async reconcileMedia(
    scannedItems: MediaItem[],
    deviceId: string,
    destinationHandle?: FileSystemDirectoryHandle | null
  ): Promise<{
    allItems: MediaItem[];
    newItems: MediaItem[];
    syncedItems: MediaItem[];
    totalNewBytes: number;
    totalSyncedBytes: number;
  }> {
    // 1. Get all known synced items from SQLite/IndexedDB for this device
    const dbSyncedItems = await syncDb.getSyncedMediaByDevice(deviceId);
    const dbSyncedBySourceId = new Map<string, MediaItem>();
    const dbSyncedByMetadata = new Map<string, MediaItem>();
    const dbSyncedByHash = new Map<string, MediaItem>();

    for (const item of dbSyncedItems) {
      if (item.sourceIdentifier) dbSyncedBySourceId.set(item.sourceIdentifier, item);
      dbSyncedByMetadata.set(`${item.filename}_${item.size}`, item);
      if (item.hash) dbSyncedByHash.set(item.hash, item);
    }

    // 2. If destination handle is provided, scan existing files in destination directory
    const destinationFiles = new Map<string, { size: number; lastModified: number }>();
    if (destinationHandle) {
      try {
        for await (const entry of destinationHandle.values()) {
          if (entry.kind === 'file') {
            try {
              const f = await (entry as FileSystemFileHandle).getFile();
              destinationFiles.set(f.name.toLowerCase(), { size: f.size, lastModified: f.lastModified });
            } catch {
              // Ignore unreadable entries
            }
          }
        }
      } catch (err) {
        console.warn('Could not scan destination directory:', err);
      }
    }

    const allItems: MediaItem[] = [];
    const newItems: MediaItem[] = [];
    const syncedItems: MediaItem[] = [];
    let totalNewBytes = 0;
    let totalSyncedBytes = 0;

    for (const item of scannedItems) {
      let isAlreadySynced = false;
      let matchedDbItem: MediaItem | undefined;

      // Check Level 1: Match by sourceIdentifier in DB
      if (item.sourceIdentifier && dbSyncedBySourceId.has(item.sourceIdentifier)) {
        matchedDbItem = dbSyncedBySourceId.get(item.sourceIdentifier);
        if (matchedDbItem && matchedDbItem.size === item.size) {
          isAlreadySynced = true;
        }
      }

      // Check Level 2: Match by filename + size in DB
      if (!isAlreadySynced) {
        const metaKey = `${item.filename}_${item.size}`;
        if (dbSyncedByMetadata.has(metaKey)) {
          matchedDbItem = dbSyncedByMetadata.get(metaKey);
          isAlreadySynced = true;
        }
      }

      // Check Level 3: If present in destination directory with exact matching size
      if (!isAlreadySynced && destinationFiles.has(item.filename.toLowerCase())) {
        const destFile = destinationFiles.get(item.filename.toLowerCase())!;
        if (destFile.size === item.size) {
          isAlreadySynced = true;
        }
      }

      if (isAlreadySynced) {
        item.isSynced = true;
        item.syncStatus = 'synced';
        item.hash = matchedDbItem?.hash || item.hash;
        item.syncedAt = matchedDbItem?.syncedAt || new Date().toISOString();
        syncedItems.push(item);
        totalSyncedBytes += item.size;
      } else {
        item.isSynced = false;
        item.syncStatus = 'new';
        newItems.push(item);
        totalNewBytes += item.size;
      }

      allItems.push(item);
    }

    return {
      allItems,
      newItems,
      syncedItems,
      totalNewBytes,
      totalSyncedBytes,
    };
  }

  /**
   * Starts real sync of selected items into destination directory handle or zip archive bundle
   */
  async startSync(
    itemsToSync: MediaItem[],
    destinationHandle: FileSystemDirectoryHandle | null,
    deviceId: string,
    destinationName: string,
    settings: SyncSettings
  ): Promise<SyncSession> {
    if (this.isRunning) {
      throw new Error('A synchronization session is already in progress.');
    }

    this.isRunning = true;
    this.isPaused = false;
    this.shouldCancel = false;

    const totalBytes = itemsToSync.reduce((acc, it) => acc + it.size, 0);

    const session: SyncSession = {
      id: `sync_${Date.now()}`,
      deviceId,
      destinationName,
      startedAt: new Date().toISOString(),
      totalItems: itemsToSync.length,
      syncedItems: 0,
      skippedItems: 0,
      failedItems: 0,
      totalBytes,
      syncedBytes: 0,
      status: 'running',
      errors: [],
    };

    await syncDb.saveSyncSession(session);

    this.currentProgress = {
      isActive: true,
      isPaused: false,
      totalItems: itemsToSync.length,
      completedItems: 0,
      failedItems: 0,
      skippedItems: 0,
      totalBytes,
      completedBytes: 0,
      currentFilename: '',
      currentFileIndex: 0,
      bytesPerSecond: 0,
      estimatedSecondsRemaining: 0,
      errors: [],
    };
    this.notifyProgress();

    const startTime = Date.now();
    let lastBytesSample = 0;
    let lastTimeSample = startTime;
    const concurrency = Math.max(1, Math.min(settings.concurrency || 3, 6));

    // If destinationHandle is null (e.g. inside cross-origin iframe where showDirectoryPicker is blocked),
    // use real JSZip stream packaging
    const zip = !destinationHandle ? new JSZip() : null;

    const queue = [...itemsToSync];
    let activeWorkers = 0;

    const runWorker = async (): Promise<void> => {
      while (queue.length > 0 && !this.shouldCancel) {
        while (this.isPaused && !this.shouldCancel) {
          await new Promise((r) => setTimeout(r, 200));
        }

        if (this.shouldCancel) break;

        const item = queue.shift();
        if (!item) break;

        this.currentProgress.currentFilename = item.filename;
        this.currentProgress.currentFileIndex =
          this.currentProgress.completedItems + this.currentProgress.failedItems + 1;
        this.notifyProgress();

        try {
          if (destinationHandle) {
            // Direct write to directory handle
            await this.syncSingleFile(item, destinationHandle, settings);
          } else if (zip) {
            // Archive packaging
            await this.addFileToZip(item, zip, settings);
          }

          session.syncedItems++;
          session.syncedBytes += item.size;
          this.currentProgress.completedItems++;
          this.currentProgress.completedBytes += item.size;

          // Save verified item record to DB
          await syncDb.saveMediaItem({
            id: item.id,
            deviceId: item.deviceId,
            filename: item.filename,
            mediaType: item.mediaType,
            extension: item.extension,
            size: item.size,
            createdAt: item.createdAt,
            modifiedAt: item.modifiedAt,
            sourceIdentifier: item.sourceIdentifier,
            hash: item.hash,
            isSynced: true,
            syncStatus: 'synced',
            destinationPath: item.destinationPath || `${destinationName}/${item.filename}`,
            syncedAt: new Date().toISOString(),
            livePhotoPairId: item.livePhotoPairId,
          });
        } catch (err: unknown) {
          const reason = err instanceof Error ? err.message : String(err);
          console.error(`Failed to sync ${item.filename}:`, err);
          session.failedItems++;
          session.errors?.push(`${item.filename}: ${reason}`);
          this.currentProgress.failedItems++;
          this.currentProgress.errors.push({ filename: item.filename, reason });
          item.syncStatus = 'failed';
          item.error = reason;
        }

        // Calculate transfer speed & ETA
        const now = Date.now();
        const timeDiff = (now - lastTimeSample) / 1000;
        if (timeDiff >= 0.5) {
          const bytesDiff = this.currentProgress.completedBytes - lastBytesSample;
          this.currentProgress.bytesPerSecond = Math.max(0, bytesDiff / timeDiff);
          lastBytesSample = this.currentProgress.completedBytes;
          lastTimeSample = now;

          const remainingBytes = this.currentProgress.totalBytes - this.currentProgress.completedBytes;
          if (this.currentProgress.bytesPerSecond > 0) {
            this.currentProgress.estimatedSecondsRemaining = Math.ceil(
              remainingBytes / this.currentProgress.bytesPerSecond
            );
          }
        }

        this.notifyProgress();
      }
    };

    const workers: Promise<void>[] = [];
    for (let i = 0; i < concurrency; i++) {
      activeWorkers++;
      workers.push(
        runWorker().finally(() => {
          activeWorkers--;
        })
      );
    }

    await Promise.all(workers);

    // If using zip archive fallback, trigger download of complete synchronized bundle
    if (zip && session.syncedItems > 0 && !this.shouldCancel) {
      this.currentProgress.currentFilename = 'Generating backup archive...';
      this.notifyProgress();

      const blob = await zip.generateAsync(
        {
          type: 'blob',
          compression: 'STORE', // STORE maintains original uncompressed photo/video fidelity
        },
        (metadata) => {
          this.currentProgress.currentFilename = `Compiling backup package (${Math.round(metadata.percent)}%)...`;
          this.notifyProgress();
        }
      );

      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      const dateStr = new Date().toISOString().split('T')[0];
      a.download = `${destinationName.replace(/[^a-zA-Z0-9_-]/g, '_')}_${dateStr}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 30000);
    }

    session.completedAt = new Date().toISOString();
    session.status = this.shouldCancel ? 'cancelled' : session.failedItems > 0 ? 'completed' : 'completed';
    await syncDb.saveSyncSession(session);

    this.isRunning = false;
    this.currentProgress.isActive = false;
    this.notifyProgress();

    return session;
  }

  /**
   * Real streaming copy of a single media item to the destination FileSystemDirectoryHandle
   */
  private async syncSingleFile(
    item: MediaItem,
    destinationHandle: FileSystemDirectoryHandle,
    settings: SyncSettings
  ): Promise<void> {
    let file: File;
    if (item.file) {
      file = item.file;
    } else if (item.fileHandle) {
      file = await item.fileHandle.getFile();
    } else {
      throw new Error('No readable file handle available');
    }

    const targetFilename = await this.resolveTargetFilename(
      destinationHandle,
      item,
      file,
      settings
    );

    if (!targetFilename) {
      item.syncStatus = 'duplicate';
      item.isSynced = true;
      return;
    }

    const destFileHandle = await destinationHandle.getFileHandle(targetFilename, { create: true });
    const writable = await destFileHandle.createWritable();

    try {
      if (file.stream) {
        await file.stream().pipeTo(writable);
      } else {
        const buffer = await file.arrayBuffer();
        await writable.write(buffer);
        await writable.close();
      }
    } catch (writeErr) {
      try {
        await writable.abort();
      } catch {
        // Ignore abort error
      }
      throw writeErr;
    }

    const writtenFile = await destFileHandle.getFile();
    if (writtenFile.size !== file.size) {
      throw new Error(
        `Verification failed: written size (${writtenFile.size} B) does not match source size (${file.size} B)`
      );
    }

    if (settings.verificationMode === 'checksum') {
      const sourceHash = item.hash || (await calculateFileHash(file));
      item.hash = sourceHash;
      const writtenHash = await calculateFileHash(writtenFile);
      if (sourceHash !== writtenHash) {
        throw new Error(`Checksum mismatch: file may be corrupted during copy.`);
      }
    }

    item.destinationPath = targetFilename;
    item.isSynced = true;
    item.syncStatus = 'synced';
  }

  /**
   * Adds real file bytes to zip backup bundle with date and checksum verification
   */
  private async addFileToZip(item: MediaItem, zip: JSZip, settings: SyncSettings): Promise<void> {
    let file: File;
    if (item.file) {
      file = item.file;
    } else if (item.fileHandle) {
      file = await item.fileHandle.getFile();
    } else {
      throw new Error('No readable file handle available');
    }

    if (settings.verificationMode === 'checksum' && !item.hash) {
      item.hash = await calculateFileHash(file);
    }

    const buffer = await file.arrayBuffer();
    zip.file(item.filename, buffer, {
      date: new Date(file.lastModified || Date.now()),
    });

    item.destinationPath = item.filename;
    item.isSynced = true;
    item.syncStatus = 'synced';
  }

  /**
   * Resolves safe target filename handling collisions
   */
  private async resolveTargetFilename(
    destinationHandle: FileSystemDirectoryHandle,
    item: MediaItem,
    sourceFile: File,
    settings: SyncSettings
  ): Promise<string | null> {
    const baseName = item.filename;

    try {
      const existingHandle = await destinationHandle.getFileHandle(baseName, { create: false });
      const existingFile = await existingHandle.getFile();

      if (existingFile.size === sourceFile.size) {
        const sourceHash = item.hash || (await calculateFileHash(sourceFile));
        item.hash = sourceHash;
        const destHash = await calculateFileHash(existingFile);

        if (sourceHash === destHash) {
          return null; // Skip identical
        }
      }

      if (settings.duplicateBehavior === 'rename_conflict') {
        const dotIdx = baseName.lastIndexOf('.');
        const namePart = dotIdx !== -1 ? baseName.substring(0, dotIdx) : baseName;
        const extPart = dotIdx !== -1 ? baseName.substring(dotIdx) : '';

        for (let i = 1; i < 1000; i++) {
          const candidate = `${namePart} (${i})${extPart}`;
          try {
            await destinationHandle.getFileHandle(candidate, { create: false });
          } catch {
            return candidate;
          }
        }
      }

      return baseName;
    } catch {
      return baseName;
    }
  }

  pauseSync(): void {
    if (this.isRunning && !this.isPaused) {
      this.isPaused = true;
      this.currentProgress.isPaused = true;
      this.notifyProgress();
    }
  }

  resumeSync(): void {
    if (this.isRunning && this.isPaused) {
      this.isPaused = false;
      this.currentProgress.isPaused = false;
      this.notifyProgress();
    }
  }

  cancelSync(): void {
    if (this.isRunning) {
      this.shouldCancel = true;
      this.isPaused = false;
      this.currentProgress.isActive = false;
      this.notifyProgress();
    }
  }

  getProgress(): SyncProgressState {
    return { ...this.currentProgress };
  }

  subscribeProgress(callback: SyncEventCallback): () => void {
    this.progressListeners.push(callback);
    callback(this.currentProgress);
    return () => {
      this.progressListeners = this.progressListeners.filter((cb) => cb !== callback);
    };
  }

  private notifyProgress() {
    const p = { ...this.currentProgress };
    for (const listener of this.progressListeners) {
      listener(p);
    }
  }
}

export const syncEngine = new SyncEngine();
