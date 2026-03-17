import React, { useState, useEffect } from 'react';
import { File, Folder, Star } from 'lucide-react';
import api from '../utils/api';
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

const StarredPage: React.FC = () => {
  const [items, setItems] = useState<StarredItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStarred = async () => {
    try {
      const res = await api.get('/files/starred');
      setItems(res.data);
    } catch (err) {
      console.error('Failed to fetch starred items', err);
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
    } catch (err) {
      alert('Failed to unstar');
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
          <div className="loading">Loading...</div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <Star size={48} style={{ marginBottom: 12 }} />
            <p>No starred items yet</p>
          </div>
        ) : (
          items.map((item, idx) => (
            <div key={idx} className="grid-row">
              <div className="col-name">
                {item.type === 'folder'
                  ? <Folder className="icon-folder" size={20} />
                  : <File className="icon-file" size={20} />}
                <span>{item.name}</span>
              </div>
              <div className="col-size">
                {item.file_size
                  ? `${(parseInt(item.file_size) / 1024).toFixed(1)} KB`
                  : '--'}
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
