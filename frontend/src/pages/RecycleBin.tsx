import React, { useState, useEffect } from 'react';
import { File, RotateCcw, Trash2, Clock, User } from 'lucide-react';
import api from '../utils/api';
import '../styles/files.css';

const RecycleBin: React.FC = () => {
  const [deletedFiles, setDeletedFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDeletedFiles = async () => {
    setLoading(true);
    try {
      // Fetch activity logs and filter for 'delete' actions to show in recycle bin
      // In a real app, you might have a dedicated /files/deleted endpoint
      const response = await api.get('/activity');
      const deletes = response.data.filter((a: any) => a.action === 'delete');
      setDeletedFiles(deletes);
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
      alert('File restored successfully');
      fetchDeletedFiles();
    } catch (err) {
      alert('Failed to restore file');
    }
  };

  return (
    <div className="page-content">
      <div className="files-header">
        <div className="breadcrumb">
          <span>Recycle Bin</span>
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
          <div className="loading">Loading bin...</div>
        ) : deletedFiles.length === 0 ? (
          <div className="empty-state">Recycle bin is empty</div>
        ) : (
          deletedFiles.map((item, idx) => (
            <div key={idx} className="grid-row">
              <div className="col-name">
                <File className="icon-file" size={20} />
                <span>{item.file_name}</span>
              </div>
              <div className="col-size">
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <User size={14} /> {item.actor_name}
                </div>
              </div>
              <div className="col-date">
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={14} /> {new Date(item.created_at).toLocaleDateString()}
                </div>
              </div>
              <div className="col-actions">
                <div className="action-menu">
                  <div className="dropdown" style={{ display: 'block', position: 'static', border: 'none', boxShadow: 'none', background: 'none' }}>
                    <button style={{ color: '#28a745', padding: '4px' }} onClick={() => handleRestore(item.target_id)}>
                      <RotateCcw size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default RecycleBin;
