export type MediaType = 'photo' | 'video';

export type SyncStatus = 'new' | 'synced' | 'duplicate' | 'failed' | 'skipped';

export interface MediaItem {
  id: string;
  deviceId: string;
  filename: string;
  mediaType: MediaType;
  extension: string;
  size: number;
  createdAt: string;
  modifiedAt: string;
  sourceIdentifier: string; // Unique path or stable source ID
  hash?: string;
  isSynced: boolean;
  syncStatus: SyncStatus;
  destinationPath?: string;
  syncedAt?: string;
  error?: string;
  // Live Photo pairing identifier
  livePhotoPairId?: string;
  // Actual File reference for real streaming
  fileHandle?: FileSystemFileHandle;
  file?: File;
  previewUrl?: string;
}

export interface DeviceInfo {
  id: string;
  name: string;
  model: string;
  serialIdentifier?: string;
  firstSeenAt: string;
  lastSeenAt: string;
  connected: boolean;
  sourcePath?: string;
}

export interface SyncSession {
  id: string;
  deviceId: string;
  destinationName: string;
  startedAt: string;
  completedAt?: string;
  totalItems: number;
  syncedItems: number;
  skippedItems: number;
  failedItems: number;
  totalBytes: number;
  syncedBytes: number;
  status: 'running' | 'completed' | 'paused' | 'cancelled' | 'failed';
  errors?: string[];
}

export interface SyncSettings {
  concurrency: number;
  verificationMode: 'checksum' | 'size_only';
  duplicateBehavior: 'skip_identical' | 'rename_conflict';
  autoScanOnConnect: boolean;
}

export interface SyncProgressState {
  isActive: boolean;
  isPaused: boolean;
  totalItems: number;
  completedItems: number;
  failedItems: number;
  skippedItems: number;
  totalBytes: number;
  completedBytes: number;
  currentFilename: string;
  currentFileIndex: number;
  bytesPerSecond: number;
  estimatedSecondsRemaining: number;
  errors: { filename: string; reason: string }[];
}
