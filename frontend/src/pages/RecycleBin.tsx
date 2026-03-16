import React, { useState, useEffect } from 'react';
import { File, RotateCcw, Clock, User, Trash2, Loader, X } from 'lucide-react';
import api from '../utils/api';
import { useToast } from '../context/ToastContext';
import '../styles/files.css';
import '../styles/recycle-bin.css';

const RecycleBin: React.FC = () => {
  const { showToast } = useToast();
  const [deletedFiles, setDeletedFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmRestore, setConfirmRestore] = useState<{fileId: string, name: string} | null>(null);

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

  useEffect(() => {
    fetchDeletedFiles();
  }, []);

  const handleRestore = async (fileId: string) => {
    try {
      await api.post(`/files/${fileId}/restore`);
      showToast('File restored successfully', 'success');
      fetchDeletedFiles();
    } catch (err) {
      showToast('Failed to restore file', 'error');
    }
  };

  return (
    <div className="page-content">
      {/* Confirm Restore Modal */}
      {confirmRestore && (
        <div className="modal-overlay" onClick={() => setConfirmRestore(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Restore File</h3>
              <button className="modal-close" onClick={() => setConfirmRestore(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                Restore <strong>"{confirmRestore.name}"</strong> back to its original location?
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setConfirmRestore(null)}>Cancel</button>
              <button className="btn-primary" onClick={() => {
                handleRestore(confirmRestore.fileId);
                setConfirmRestore(null);
              }}>Restore</button>
            </div>
          </div>
        </div>
      )}

      <div className="files-header">
        <div className="breadcrumb">
          <span className="breadcrumb-current">Recycle Bin</span>
        </div>
      </div>

      <div className="files-grid">
        <div className="grid-header">
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
          deletedFiles.map((item, idx) => (
            <div key={idx} className="grid-row">
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
                <button
                  className="restore-btn"
                  onClick={() => setConfirmRestore({ fileId: item.file_id, name: item.name })}
                  title="Restore file"
                >
                  <RotateCcw size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default RecycleBin;
