import React, { useState, useEffect } from 'react';
import { File, Folder, Download, Users, Loader } from 'lucide-react';
import api from '../utils/api';
import { useToast } from '../context/ToastContext';
import '../styles/files.css';
import '../styles/shared.css';

interface SharedItem {
  id: string;
  name: string;
  file_size?: string;
  mime_type?: string;
  created_at: string;
  type: 'file' | 'folder';
  access_level: string;
  shared_by_name: string;
}

const SharedWithMe: React.FC = () => {
  const { showToast } = useToast();
  const [items, setItems] = useState<SharedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchShared = async () => {
      try {
        const res = await api.get('/files/shared-with-me');
        setItems(res.data);
      } catch {
        showToast('Failed to load shared files', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchShared();
  }, []);

  const handleDownload = async (item: SharedItem) => {
    try {
      const res = await api.get(`/files/${item.id}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = item.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      showToast('Failed to download file', 'error');
    }
  };

  return (
    <div className="page-content">
      <div className="files-header">
        <h2 style={{ margin: 0 }}>Shared With Me</h2>
      </div>

      <div className="files-grid">
        <div
          className="grid-header"
          style={{ gridTemplateColumns: '2fr 140px 90px 140px 50px' }}
        >
          <div className="col-name">Name</div>
          <div>Shared By</div>
          <div>Access</div>
          <div className="col-date">Date</div>
          <div className="col-actions"></div>
        </div>

        {loading ? (
          <div className="loading-spinner"><Loader size={24} className="spin" /><span>Loading...</span></div>
        ) : items.length === 0 ? (
          <div className="empty-state-box">
            <Users size={48} />
            <p>Nothing has been shared with you yet</p>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="grid-row"
              style={{ gridTemplateColumns: '2fr 140px 90px 140px 50px' }}
            >
              <div className="col-name">
                {item.type === 'folder'
                  ? <Folder className="icon-folder" size={20} />
                  : <File className="icon-file" size={20} />}
                <span>{item.name}</span>
              </div>
              <div className="shared-by-cell">{item.shared_by_name}</div>
              <div>
                <span className={`shared-badge ${item.access_level}`}>
                  {item.access_level}
                </span>
              </div>
              <div className="col-date">
                {new Date(item.created_at).toLocaleDateString()}
              </div>
              <div className="col-actions">
                {item.type === 'file' && (
                  <button
                    className="action-btn edit"
                    onClick={() => handleDownload(item)}
                    title="Download"
                    style={{ background: 'none', border: '1px solid var(--border)', cursor: 'pointer' }}
                  >
                    <Download size={16} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default SharedWithMe;
