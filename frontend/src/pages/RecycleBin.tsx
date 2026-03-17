import React, { useState, useEffect } from 'react';
import { File, RotateCcw, Clock, User, Trash2, Loader, X, CheckSquare, Square, AlertTriangle } from 'lucide-react';
import api from '../utils/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import '../styles/files.css';
import '../styles/recycle-bin.css';

const RecycleBin: React.FC = () => {
  const { showToast } = useToast();
  const { user } = useAuth();
  const [deletedFiles, setDeletedFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmModal, setConfirmModal] = useState<{ message: string; onConfirm: () => void; danger?: boolean } | null>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const fetchDeletedFiles = async () => {
    setLoading(true);
    try {
      const response = await api.get('/files/deleted');
      setDeletedFiles(response.data);
    } catch (err) {
      console.error('Failed to fetch deleted files', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDeletedFiles(); }, []);

  const handleRestore = (fileId: string, name: string) => {
    setConfirmModal({
      message: `Restore "${name}" back to its original location?`,
      onConfirm: async () => {
        try {
          await api.post(`/files/${fileId}/restore`);
          showToast('File restored successfully', 'success');
          fetchDeletedFiles();
        } catch (err) {
          showToast('Failed to restore file', 'error');
        }
      },
    });
  };

  const handlePermanentDelete = (fileId: string, name: string) => {
    setConfirmModal({
      message: `Permanently delete "${name}"? This cannot be undone.`,
      danger: true,
      onConfirm: async () => {
        try {
          await api.delete(`/files/${fileId}/permanent`);
          showToast('File permanently deleted', 'success');
          fetchDeletedFiles();
        } catch (err: any) {
          showToast(err.response?.data?.error || 'Failed to delete permanently', 'error');
        }
      },
    });
  };

  const handleEmptyBin = () => {
    setConfirmModal({
      message: `Permanently delete ALL ${deletedFiles.length} item(s) in the recycle bin? This cannot be undone.`,
      danger: true,
      onConfirm: async () => {
        try {
          await api.delete('/files/recycle-bin/empty');
          showToast('Recycle bin emptied', 'success');
          fetchDeletedFiles();
        } catch (err: any) {
          showToast(err.response?.data?.error || 'Failed to empty recycle bin', 'error');
        }
      },
    });
  };

  const handleBulkRestore = () => {
    if (selectedIds.size === 0) return;
    setConfirmModal({
      message: `Restore ${selectedIds.size} item(s)?`,
      onConfirm: async () => {
        try {
          for (const id of selectedIds) {
            await api.post(`/files/${id}/restore`);
          }
          showToast(`${selectedIds.size} item(s) restored`, 'success');
          setSelectedIds(new Set());
          setBulkMode(false);
          fetchDeletedFiles();
        } catch {
          showToast('Some items failed to restore', 'error');
        }
      },
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === deletedFiles.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(deletedFiles.map(f => f.file_id)));
  };

  const isAdmin = user?.role === 'admin';

  return (
    <div className="page-content">
      {confirmModal && (
        <div className="modal-overlay" onClick={() => setConfirmModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{confirmModal.danger ? 'Warning' : 'Confirm'}</h3>
              <button className="modal-close" onClick={() => setConfirmModal(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              {confirmModal.danger && <AlertTriangle size={24} style={{ color: 'var(--danger, #ef4444)', marginBottom: 8 }} />}
              <p style={{ color: 'var(--text-secondary)', margin: 0 }}>{confirmModal.message}</p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setConfirmModal(null)}>Cancel</button>
              <button
                className={confirmModal.danger ? 'btn-danger' : 'btn-primary'}
                onClick={() => { confirmModal.onConfirm(); setConfirmModal(null); }}
              >
                {confirmModal.danger ? 'Delete Permanently' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="files-header">
        <div className="breadcrumb">
          <span className="breadcrumb-current">Recycle Bin</span>
        </div>
        <div className="actions">
          <button
            className={`btn-secondary${bulkMode ? ' active' : ''}`}
            onClick={() => { setBulkMode(!bulkMode); setSelectedIds(new Set()); }}
          >
            <CheckSquare size={18} />
            <span>{bulkMode ? 'Cancel' : 'Select'}</span>
          </button>

          {bulkMode && selectedIds.size > 0 && (
            <button className="btn-primary" onClick={handleBulkRestore}>
              <RotateCcw size={18} />
              <span>Restore ({selectedIds.size})</span>
            </button>
          )}

          {deletedFiles.length > 0 && (
            <button className="btn-danger" onClick={handleEmptyBin}>
              <Trash2 size={18} />
              <span>Empty Bin</span>
            </button>
          )}
        </div>
      </div>

      <div className="files-grid">
        <div className="grid-header">
          {bulkMode && (
            <div className="col-check" onClick={toggleSelectAll}>
              {selectedIds.size === deletedFiles.length && deletedFiles.length > 0
                ? <CheckSquare size={16} className="check-icon active" />
                : <Square size={16} className="check-icon" />}
            </div>
          )}
          <div className="col-name">Name</div>
          <div className="col-size">Deleted By</div>
          <div className="col-date">Deleted Date</div>
          <div className="col-actions"></div>
        </div>

        {loading ? (
          <div className="loading-spinner"><Loader size={24} className="spin" /><span>Loading recycle bin...</span></div>
        ) : deletedFiles.length === 0 ? (
          <div className="empty-state-box">
            <Trash2 size={48} />
            <p>Recycle bin is empty</p>
            <span>Deleted files will appear here</span>
          </div>
        ) : (
          deletedFiles.map((item) => (
            <div key={item.file_id} className={`grid-row${selectedIds.has(item.file_id) ? ' selected' : ''}`}
              onClick={() => bulkMode && toggleSelect(item.file_id)}>
              {bulkMode && (
                <div className="col-check">
                  {selectedIds.has(item.file_id)
                    ? <CheckSquare size={16} className="check-icon active" />
                    : <Square size={16} className="check-icon" />}
                </div>
              )}
              <div className="col-name">
                <File className="icon-file" size={20} />
                <span>{item.name}</span>
              </div>
              <div className="col-size">
                <div className="meta-cell">
                  <User size={14} />
                  <span>{item.deleted_by_name || 'Unknown'}</span>
                </div>
              </div>
              <div className="col-date">
                <div className="meta-cell">
                  <Clock size={14} />
                  <span>{new Date(item.deleted_at).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="col-actions">
                {!bulkMode && (
                  <div className="recycle-actions">
                    <button
                      className="restore-btn"
                      onClick={() => handleRestore(item.file_id, item.name)}
                      title="Restore"
                    >
                      <RotateCcw size={16} />
                    </button>
                    {isAdmin && (
                      <button
                        className="perm-delete-btn"
                        onClick={() => handlePermanentDelete(item.file_id, item.name)}
                        title="Delete permanently"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default RecycleBin;
