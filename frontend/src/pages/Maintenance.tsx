import React, { useState } from 'react';
import { RefreshCw, Trash2, AlertTriangle, CheckCircle } from 'lucide-react';
import api from '../utils/api';
import '../styles/maintenance.css';

interface ReconcileResult {
  usersUpdated: number;
  details: { user_id: string; email: string; used_bytes: string }[];
}

interface OrphanResult {
  dryRun: boolean;
  dbOrphans: { count: number; files: { fileId: string; fileName: string }[]; cleaned: number };
  driveOrphans: { count: number; files: { googleFileId: string; fileName: string }[]; cleaned: number };
}

const Maintenance: React.FC = () => {
  const [reconciling, setReconciling] = useState(false);
  const [reconcileResult, setReconcileResult] = useState<ReconcileResult | null>(null);
  const [cleaning, setCleaning] = useState(false);
  const [cleanResult, setCleanResult] = useState<OrphanResult | null>(null);
  const [error, setError] = useState('');

  const handleReconcile = async () => {
    setReconciling(true);
    setError('');
    setReconcileResult(null);
    try {
      const res = await api.post('/admin/maintenance/reconcile-quotas');
      setReconcileResult(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Reconciliation failed');
    } finally {
      setReconciling(false);
    }
  };

  const handleCleanupDryRun = async () => {
    setCleaning(true);
    setError('');
    setCleanResult(null);
    try {
      const res = await api.post('/admin/maintenance/cleanup-orphans?dryRun=true');
      setCleanResult(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Cleanup scan failed');
    } finally {
      setCleaning(false);
    }
  };

  const handleCleanupExecute = async () => {
    if (!window.confirm('This will permanently clean up orphaned files. Are you sure?')) return;
    setCleaning(true);
    setError('');
    try {
      const res = await api.post('/admin/maintenance/cleanup-orphans?dryRun=false');
      setCleanResult(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Cleanup failed');
    } finally {
      setCleaning(false);
    }
  };

  return (
    <div className="page-content">
      <div className="maintenance-header">
        <h2>System Maintenance</h2>
        <p>Run maintenance tasks to keep the system healthy</p>
      </div>

      {error && (
        <div className="maintenance-error">
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      <div className="maintenance-grid">
        {/* Quota Reconciliation Card */}
        <div className="maintenance-card">
          <div className="maintenance-card-header">
            <div className="maintenance-icon reconcile">
              <RefreshCw size={24} />
            </div>
            <div>
              <h3>Quota Reconciliation</h3>
              <p>Recalculate storage usage for all users based on actual active files</p>
            </div>
          </div>
          <div className="maintenance-card-body">
            <p className="maintenance-desc">
              This corrects any quota drift caused by failed transactions or external changes.
              Safe to run at any time — it only updates <code>used_bytes</code> to match reality.
            </p>
            <button
              className="btn-primary maintenance-btn"
              onClick={handleReconcile}
              disabled={reconciling}
            >
              <RefreshCw size={16} className={reconciling ? 'spin' : ''} />
              {reconciling ? 'Reconciling...' : 'Run Reconciliation'}
            </button>
          </div>
          {reconcileResult && (
            <div className="maintenance-result success">
              <CheckCircle size={16} />
              <span>
                {reconcileResult.usersUpdated === 0
                  ? 'All quotas are already correct!'
                  : `Updated ${reconcileResult.usersUpdated} user(s): ${reconcileResult.details.map(d => d.email).join(', ')}`
                }
              </span>
            </div>
          )}
        </div>

        {/* Orphaned Files Cleanup Card */}
        <div className="maintenance-card">
          <div className="maintenance-card-header">
            <div className="maintenance-icon cleanup">
              <Trash2 size={24} />
            </div>
            <div>
              <h3>Orphaned Files Cleanup</h3>
              <p>Find files that exist in DB but not Drive, or in Drive but not DB</p>
            </div>
          </div>
          <div className="maintenance-card-body">
            <p className="maintenance-desc">
              First run a <strong>Dry Run</strong> to see what would be cleaned.
              Then <strong>Execute</strong> to actually clean up orphaned files.
            </p>
            <div className="maintenance-btn-group">
              <button
                className="btn-secondary maintenance-btn"
                onClick={handleCleanupDryRun}
                disabled={cleaning}
              >
                {cleaning ? 'Scanning...' : 'Dry Run (Scan Only)'}
              </button>
              <button
                className="btn-danger maintenance-btn"
                onClick={handleCleanupExecute}
                disabled={cleaning}
              >
                <Trash2 size={16} />
                Execute Cleanup
              </button>
            </div>
          </div>
          {cleanResult && (
            <div className={`maintenance-result ${cleanResult.dryRun ? 'info' : 'success'}`}>
              <CheckCircle size={16} />
              <div>
                <strong>{cleanResult.dryRun ? 'Dry Run Results:' : 'Cleanup Complete:'}</strong>
                <div className="orphan-summary">
                  <div>DB orphans (in DB, not in Drive): <strong>{cleanResult.dbOrphans.count}</strong>
                    {!cleanResult.dryRun && ` — cleaned ${cleanResult.dbOrphans.cleaned}`}
                  </div>
                  <div>Drive orphans (in Drive, not in DB): <strong>{cleanResult.driveOrphans.count}</strong>
                    {!cleanResult.dryRun && ` — cleaned ${cleanResult.driveOrphans.cleaned}`}
                  </div>
                </div>
                {cleanResult.dryRun && (cleanResult.dbOrphans.count > 0 || cleanResult.driveOrphans.count > 0) && (
                  <div className="orphan-files">
                    {cleanResult.dbOrphans.files.map((f, i) => (
                      <div key={i} className="orphan-item db">DB: {f.fileName}</div>
                    ))}
                    {cleanResult.driveOrphans.files.map((f, i) => (
                      <div key={i} className="orphan-item drive">Drive: {f.fileName}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Maintenance;
