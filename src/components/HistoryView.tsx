import React from 'react';
import { SyncSession } from '../types';
import { formatBytes, formatDate, formatNumber } from '../utils/formatters';
import { History, CheckCircle, AlertTriangle, HardDrive, Trash2 } from 'lucide-react';

interface HistoryViewProps {
  sessions: SyncSession[];
  onClearHistory: () => void;
  onBackToSync: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  sessions,
  onClearHistory,
  onBackToSync,
}) => {
  return (
    <div className="max-w-3xl mx-auto py-8 px-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
        <div>
          <button
            onClick={onBackToSync}
            className="text-xs text-neutral-400 hover:text-white mb-1 transition-colors flex items-center space-x-1"
          >
            <span>← Back to Sync</span>
          </button>
          <h2 className="text-xl font-bold tracking-tight text-neutral-100">Backup History</h2>
          <p className="text-xs text-neutral-400">
            Real synchronization logs stored securely in your browser's persistent database.
          </p>
        </div>

        {sessions.length > 0 && (
          <button
            onClick={onClearHistory}
            className="text-xs text-red-400 hover:text-red-300 p-2 rounded-lg bg-red-950/20 border border-red-500/20 hover:border-red-500/40 transition-all flex items-center space-x-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Log</span>
          </button>
        )}
      </div>

      {/* History List */}
      {sessions.length === 0 ? (
        <div className="text-center py-16 border border-neutral-800/80 rounded-2xl bg-neutral-900/30">
          <History className="w-8 h-8 mx-auto mb-3 text-neutral-600" />
          <h3 className="text-sm font-semibold text-neutral-300 mb-1">No past backups yet</h3>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto">
            Once you run your first iPhone synchronization, session metrics and transferred files will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="bg-neutral-900/70 border border-neutral-800 rounded-xl p-4.5 transition-all hover:border-neutral-700 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  {session.status === 'completed' ? (
                    <div className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                      <CheckCircle className="w-3.5 h-3.5" />
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                      <AlertTriangle className="w-3.5 h-3.5" />
                    </div>
                  )}
                  <div>
                    <span className="text-sm font-semibold text-neutral-100">
                      {formatNumber(session.syncedItems)} items backed up
                    </span>
                    <span className="text-xs font-mono text-neutral-500 ml-2">
                      ({formatBytes(session.syncedBytes)})
                    </span>
                  </div>
                </div>

                <span className="text-xs font-mono text-neutral-400">
                  {formatDate(session.startedAt)}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs font-mono text-neutral-400 pt-2 border-t border-neutral-800/60">
                <div className="flex items-center space-x-1.5 truncate max-w-xs text-neutral-400">
                  <HardDrive className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                  <span className="truncate">{session.destinationName}</span>
                </div>
                <div>
                  {session.failedItems > 0 ? (
                    <span className="text-red-400 font-bold">{session.failedItems} failed</span>
                  ) : (
                    <span className="text-emerald-400">0 errors</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
