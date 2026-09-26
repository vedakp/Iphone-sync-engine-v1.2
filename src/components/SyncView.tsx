import React from 'react';
import { DeviceInfo, MediaItem } from '../types';
import { formatBytes, formatNumber } from '../utils/formatters';
import {
  Folder,
  FolderSync,
  CheckCircle2,
  HardDrive,
  UploadCloud,
  ChevronRight,
  ArrowRight,
  RefreshCw,
  FolderCheck,
  AlertCircle,
  FileImage,
} from 'lucide-react';

interface SyncViewProps {
  device: DeviceInfo | null;
  scannedItems: MediaItem[];
  newItems: MediaItem[];
  syncedItems: MediaItem[];
  totalNewBytes: number;
  totalSyncedBytes: number;
  isScanning: boolean;
  scanProgressText: string;
  destinationName: string | null;
  destinationHandle: FileSystemDirectoryHandle | null;
  onSelectSourceFolder: () => void;
  onSelectDestinationFolder: () => void;
  onStartSync: () => void;
  onRescan: () => void;
  onInspect: () => void;
  onFilesDropped: (e: React.DragEvent) => void;
  onFallbackFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSelectFiles: () => void;
}

export const SyncView: React.FC<SyncViewProps> = ({
  device,
  scannedItems,
  newItems,
  syncedItems,
  totalNewBytes,
  totalSyncedBytes,
  isScanning,
  scanProgressText,
  destinationName,
  onSelectSourceFolder,
  onSelectDestinationFolder,
  onStartSync,
  onRescan,
  onInspect,
  onFilesDropped,
  onSelectFiles,
}) => {
  const [isDragOver, setIsDragOver] = React.useState(false);

  const totalPhotos = scannedItems.filter((i) => i.mediaType === 'photo').length;
  const totalVideos = scannedItems.filter((i) => i.mediaType === 'video').length;
  const newPhotos = newItems.filter((i) => i.mediaType === 'photo').length;
  const newVideos = newItems.filter((i) => i.mediaType === 'video').length;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    onFilesDropped(e);
  };

  return (
    <div className="max-w-2xl mx-auto py-10 px-6 space-y-8">
      {/* STATE 1: No Device / No folder scanned yet */}
      {scannedItems.length === 0 && !isScanning && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all ${
            isDragOver
              ? 'border-blue-500 bg-blue-500/5 ring-4 ring-blue-500/10'
              : 'border-neutral-800 bg-neutral-900/40 hover:border-neutral-700'
          }`}
        >
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-neutral-800/80 border border-neutral-700 flex items-center justify-center text-neutral-300 shadow-sm">
            <UploadCloud className="w-8 h-8" />
          </div>

          <h2 className="text-xl font-semibold tracking-tight text-neutral-100 mb-2">
            Connect iPhone or Select DCIM Folder
          </h2>
          <p className="text-sm text-neutral-400 max-w-md mx-auto mb-6 leading-relaxed">
            Select your iPhone{' '}
            <code className="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 font-mono text-xs">
              DCIM
            </code>{' '}
            folder or media files to automatically detect what has not yet been backed up.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={onSelectSourceFolder}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-neutral-100 text-neutral-950 font-semibold text-sm hover:bg-white active:scale-[0.98] transition-all flex items-center justify-center space-x-2 shadow-sm cursor-pointer"
            >
              <Folder className="w-4 h-4 text-neutral-800" />
              <span>Select iPhone Folder</span>
            </button>

            <button
              onClick={onSelectFiles}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-neutral-800/80 text-neutral-300 font-medium text-sm border border-neutral-700/60 hover:bg-neutral-800 hover:text-white transition-all flex items-center justify-center space-x-2 cursor-pointer"
            >
              <FileImage className="w-4 h-4 text-neutral-400" />
              <span>Select Media Files</span>
            </button>
          </div>

          <div className="mt-8 pt-6 border-t border-neutral-800/80 flex items-center justify-center space-x-2 text-xs text-neutral-500">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Or drag and drop your iPhone media folder directly into this window</span>
          </div>
        </div>
      )}

      {/* STATE 2: Scanning In Progress */}
      {isScanning && (
        <div className="border border-neutral-800 bg-neutral-900/60 rounded-2xl p-10 text-center animate-pulse">
          <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <RefreshCw className="w-6 h-6 animate-spin" />
          </div>
          <h3 className="text-lg font-semibold text-neutral-100 mb-1">Scanning Media...</h3>
          <p className="text-sm font-mono text-neutral-400 truncate max-w-md mx-auto">
            {scanProgressText || 'Reading files from device...'}
          </p>
        </div>
      )}

      {/* STATE 3: Media Found & Reconciled */}
      {scannedItems.length > 0 && !isScanning && (
        <div className="space-y-6">
          {/* Main Card */}
          <div className="bg-neutral-900/80 border border-neutral-800/90 rounded-2xl p-6 sm:p-8 shadow-xl">
            {/* Header: Device details & Re-scan */}
            <div className="flex items-center justify-between pb-6 border-b border-neutral-800">
              <div>
                <span className="text-xs font-mono uppercase tracking-wider text-neutral-500">
                  Source Device
                </span>
                <h2 className="text-lg font-semibold text-neutral-100">
                  {device?.name || 'Apple iPhone'}
                </h2>
              </div>
              <button
                onClick={onRescan}
                title="Rescan device for new files"
                className="p-2 rounded-lg bg-neutral-800/80 text-neutral-400 hover:text-neutral-200 border border-neutral-700/50 hover:bg-neutral-800 transition-all flex items-center space-x-1 text-xs cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Rescan</span>
              </button>
            </div>

            {/* Differential State Blocks */}
            <div className="py-6 grid grid-cols-2 gap-4">
              {/* New Items Block */}
              <div
                onClick={onInspect}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  newItems.length > 0
                    ? 'bg-blue-950/20 border-blue-500/30 hover:border-blue-500/60'
                    : 'bg-neutral-950/40 border-neutral-800/60'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono font-medium text-neutral-400 uppercase tracking-wider">
                    New Media
                  </span>
                  {newItems.length > 0 && <ChevronRight className="w-3.5 h-3.5 text-blue-400" />}
                </div>
                <div className="flex items-baseline space-x-2">
                  <span
                    className={`text-3xl font-bold tracking-tight font-mono ${
                      newItems.length > 0 ? 'text-blue-400' : 'text-neutral-500'
                    }`}
                  >
                    {formatNumber(newItems.length)}
                  </span>
                  <span className="text-xs text-neutral-400">items</span>
                </div>
                <div className="mt-2 text-xs text-neutral-400 font-mono">
                  {formatBytes(totalNewBytes)}
                  {newItems.length > 0 && (
                    <span className="text-neutral-500 ml-1">
                      ({newPhotos} photos, {newVideos} videos)
                    </span>
                  )}
                </div>
              </div>

              {/* Already Synced Block */}
              <div
                onClick={onInspect}
                className="p-4 rounded-xl bg-neutral-950/40 border border-neutral-800/60 hover:border-neutral-700 transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono font-medium text-neutral-400 uppercase tracking-wider">
                    Already Safe
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-neutral-500" />
                </div>
                <div className="flex items-baseline space-x-2">
                  <span className="text-3xl font-bold tracking-tight font-mono text-emerald-400">
                    {formatNumber(syncedItems.length)}
                  </span>
                  <span className="text-xs text-neutral-400">items</span>
                </div>
                <div className="mt-2 text-xs text-neutral-400 font-mono">
                  {formatBytes(totalSyncedBytes)}
                  <span className="text-neutral-500 ml-1">
                    ({formatNumber(scannedItems.length)} total found)
                  </span>
                </div>
              </div>
            </div>

            {/* Destination Directory Selector */}
            <div className="pt-2 pb-6 border-t border-neutral-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono uppercase tracking-wider text-neutral-400 flex items-center space-x-1.5">
                  <HardDrive className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Backup Destination</span>
                </span>
                <button
                  onClick={onSelectDestinationFolder}
                  className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
                >
                  {destinationName ? 'Change location' : 'Select location'}
                </button>
              </div>

              <div
                onClick={onSelectDestinationFolder}
                className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                  destinationName
                    ? 'bg-neutral-950/70 border-neutral-800 hover:border-neutral-700'
                    : 'bg-amber-500/5 border-amber-500/20 hover:border-amber-500/40'
                }`}
              >
                <div className="flex items-center space-x-3 truncate">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      destinationName
                        ? 'bg-neutral-800 text-neutral-200'
                        : 'bg-amber-500/10 text-amber-400'
                    }`}
                  >
                    {destinationName ? (
                      <FolderCheck className="w-4 h-4" />
                    ) : (
                      <Folder className="w-4 h-4" />
                    )}
                  </div>
                  <div className="truncate">
                    <div className="text-sm font-mono text-neutral-200 truncate">
                      {destinationName || 'No backup folder selected'}
                    </div>
                    <div className="text-[11px] text-neutral-400">
                      {destinationName
                        ? 'All media files will be placed directly here'
                        : 'Select a destination folder (e.g. D:\\iPhone Backup)'}
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-neutral-500 shrink-0 ml-2" />
              </div>
            </div>

            {/* ACTION CTA BUTTON */}
            <div className="pt-4 border-t border-neutral-800">
              {newItems.length > 0 ? (
                <button
                  onClick={onStartSync}
                  disabled={!destinationName}
                  className={`w-full py-4 rounded-xl font-semibold text-base tracking-tight transition-all flex items-center justify-center space-x-2.5 shadow-lg active:scale-[0.99] ${
                    destinationName
                      ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-blue-600/20 cursor-pointer'
                      : 'bg-neutral-800 text-neutral-400 border border-neutral-700/50 cursor-not-allowed'
                  }`}
                >
                  <FolderSync className="w-5 h-5" />
                  <span>
                    {destinationName
                      ? `Sync ${formatNumber(newItems.length)} New Items`
                      : 'Select Destination Folder First'}
                  </span>
                </button>
              ) : (
                <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-center">
                  <div className="flex items-center justify-center space-x-2 text-emerald-400 font-semibold mb-1">
                    <CheckCircle2 className="w-5 h-5" />
                    <span>You're all caught up</span>
                  </div>
                  <p className="text-xs text-neutral-400">
                    All {formatNumber(scannedItems.length)} photos & videos are safely backed up.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Stats Summary Footer */}
          <div className="flex items-center justify-between px-2 text-xs text-neutral-400 font-mono">
            <span>
              Total: {formatNumber(scannedItems.length)} items ({totalPhotos} photos, {totalVideos} videos)
            </span>
            <button
              onClick={onInspect}
              className="text-neutral-400 hover:text-neutral-200 underline transition-colors cursor-pointer"
            >
              Review all items →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
