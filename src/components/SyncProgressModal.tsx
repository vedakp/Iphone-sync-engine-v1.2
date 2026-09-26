import React from 'react';
import { SyncProgressState } from '../types';
import { formatBytes, formatDuration, formatNumber } from '../utils/formatters';
import { Play, Pause, X, AlertTriangle } from 'lucide-react';

interface SyncProgressModalProps {
  progress: SyncProgressState;
  destinationName: string;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onClose: () => void;
}

export const SyncProgressModal: React.FC<SyncProgressModalProps> = ({
  progress,
  destinationName,
  onPause,
  onResume,
  onCancel,
  onClose,
}) => {
  const percent =
    progress.totalBytes > 0
      ? Math.min(100, Math.round((progress.completedBytes / progress.totalBytes) * 100))
      : progress.totalItems > 0
      ? Math.min(100, Math.round((progress.completedItems / progress.totalItems) * 100))
      : 0;

  const isCompleted = !progress.isActive && (progress.completedItems > 0 || progress.failedItems > 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-lg p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-neutral-100">
              {isCompleted
                ? 'Backup Completed'
                : progress.isPaused
                ? 'Sync Paused'
                : 'Syncing your iPhone'}
            </h3>
            <p className="text-xs font-mono text-neutral-400 truncate max-w-xs mt-0.5">
              Destination: {destinationName}
            </p>
          </div>

          <div className="text-right">
            <span className="text-2xl font-bold font-mono text-neutral-100">{percent}%</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="w-full bg-neutral-800 h-2.5 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                isCompleted
                  ? progress.failedItems > 0
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                  : progress.isPaused
                  ? 'bg-amber-500'
                  : 'bg-blue-500'
              }`}
              style={{ width: `${percent}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs font-mono text-neutral-400">
            <span>
              {formatNumber(progress.completedItems)} / {formatNumber(progress.totalItems)} items
            </span>
            <span>
              {formatBytes(progress.completedBytes)} / {formatBytes(progress.totalBytes)}
            </span>
          </div>
        </div>

        {/* Live File Details & Speed */}
        {!isCompleted && (
          <div className="bg-neutral-950/60 rounded-xl p-4 border border-neutral-800 space-y-2 text-xs font-mono">
            <div className="flex items-center justify-between">
              <span className="text-neutral-500">Current File:</span>
              <span className="text-neutral-200 truncate max-w-xs font-medium">
                {progress.currentFilename || 'Preparing transfer...'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-neutral-500">Transfer Speed:</span>
              <span className="text-neutral-300">
                {formatBytes(progress.bytesPerSecond)}/s
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-neutral-500">Time Remaining:</span>
              <span className="text-neutral-300">
                {progress.estimatedSecondsRemaining > 0
                  ? formatDuration(progress.estimatedSecondsRemaining)
                  : 'Calculating...'}
              </span>
            </div>
          </div>
        )}

        {/* Completion Summary Card */}
        {isCompleted && (
          <div className="p-4 rounded-xl bg-neutral-950/60 border border-neutral-800 space-y-2 text-xs">
            <div className="flex items-center justify-between text-neutral-300">
              <span>Successfully Synced:</span>
              <span className="font-mono font-bold text-emerald-400">
                {formatNumber(progress.completedItems)} items ({formatBytes(progress.completedBytes)})
              </span>
            </div>
            {progress.failedItems > 0 && (
              <div className="flex items-center justify-between text-neutral-300">
                <span>Failed:</span>
                <span className="font-mono font-bold text-red-400">
                  {formatNumber(progress.failedItems)} items
                </span>
              </div>
            )}
            {progress.skippedItems > 0 && (
              <div className="flex items-center justify-between text-neutral-300">
                <span>Duplicates Skipped:</span>
                <span className="font-mono font-bold text-neutral-400">
                  {formatNumber(progress.skippedItems)} items
                </span>
              </div>
            )}
          </div>
        )}

        {/* Errors list if any */}
        {progress.errors && progress.errors.length > 0 && (
          <div className="bg-red-950/20 border border-red-500/30 rounded-xl p-3 max-h-32 overflow-y-auto space-y-1">
            <div className="flex items-center space-x-1.5 text-xs font-medium text-red-400 mb-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Transfer Warnings ({progress.errors.length})</span>
            </div>
            {progress.errors.map((err, idx) => (
              <div key={idx} className="text-[11px] font-mono text-red-300/80 truncate">
                {err.filename}: {err.reason}
              </div>
            ))}
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center justify-end space-x-3 pt-2">
          {!isCompleted ? (
            <>
              <button
                onClick={onCancel}
                className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-400 hover:text-white hover:bg-neutral-800 transition-all flex items-center space-x-1.5"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </button>

              {progress.isPaused ? (
                <button
                  onClick={onResume}
                  className="px-4 py-2 rounded-xl text-xs font-medium bg-neutral-100 text-neutral-950 hover:bg-white transition-all flex items-center space-x-1.5 font-mono shadow-sm"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Resume</span>
                </button>
              ) : (
                <button
                  onClick={onPause}
                  className="px-4 py-2 rounded-xl text-xs font-medium bg-neutral-800 text-neutral-200 hover:bg-neutral-700 transition-all flex items-center space-x-1.5 font-mono"
                >
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pause</span>
                </button>
              )}
            </>
          ) : (
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl text-sm font-semibold bg-neutral-100 text-neutral-950 hover:bg-white transition-all shadow-sm"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
