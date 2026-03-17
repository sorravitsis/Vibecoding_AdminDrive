import React, { useState, useEffect } from 'react';
import { File, Folder, Star, Loader } from 'lucide-react';
import api from '../utils/api';
import { useToast } from '../context/ToastContext';
import '../styles/files.css';

interface StarredItem {
  id: string;
  name: string;
  file_size?: string;
  mime_type?: string;
  created_at: string;
  type: 'file' | 'folder';
  starred_at: string;
}

const formatBytes = (bytes: string) => {
  const b = parseInt(bytes);
  if (!b || b === 0) return '--';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return parseFloat((b / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const StarredPage: React.FC = () => {
  const { showToast } = useToast();
  const [items, setItems] = useState<StarredItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStarred = async () => {
    try {
      const res = await api.get('/files/starred');
      setItems(res.data);
    } catch {
      showToast('Failed to load starred items', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStarred();
  }, []);

  const handleUnstar = async (item: StarredItem) => {
    const url =
      item.type === 'file'
        ? `/files/${item.id}/star`
        : `/files/folders/${item.id}/star`;
    try {
      await api.delete(url);
      setItems(prev => prev.filter(i => i.id !== item.id));
      showToast('Removed from starred', 'success');
    } catch {
      showToast('Failed to unstar', 'error');
    }
  };

  return (
    <div className="page-content">
      <div className="files-header">
        <h2 style={{ margin: 0 }}>Starred</h2>
      </div>

      <div className="files-grid">
        <div className="grid-header">
          <div className="col-name">Name</div>
          <div className="col-size">Size</div>
          <div className="col-date">Starred</div>
          <div className="col-actions"></div>
        </div>

        {loading ? (
          <div className="loading-spinner"><Loader size={24} className="spin" /><span>Loading...</span></div>
        ) : items.length === 0 ? (
          <div className="empty-state-box">
            <Star size={48} />
            <p>No starred items yet</p>
            <span>Star files or folders to find them quickly</span>
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="grid-row">
              <div className="col-name">
                {item.type === 'folder'
                  ? <Folder className="icon-folder" size={20} />
                  : <File className="icon-file" size={20} />}
                <span>{item.name}</span>
              </div>
              <div className="col-size">
                {item.file_size ? formatBytes(item.file_size) : '--'}
              </div>
              <div className="col-date">
                {new Date(item.starred_at).toLocaleDateString()}
              </div>
              <div className="col-actions">
                <div className="action-menu">
                  <button
                    className="star-btn starred"
                    onClick={() => handleUnstar(item)}
                    title="Remove from Starred"
                  >
                    <Star size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default StarredPage;
