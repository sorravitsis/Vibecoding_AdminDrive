import React, { useState, useEffect } from 'react';
import { File, Folder, Download, Users } from 'lucide-react';
import api from '../utils/api';
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
  const [items, setItems] = useState<SharedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchShared = async () => {
      try {
        const res = await api.get('/files/shared-with-me');
        setItems(res.data);
      } catch (err) {
        console.error('Failed to fetch shared files', err);
      } finally {
        setLoading(false);
      }
    };
    fetchShared();
  }, []);

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
          <div className="loading">Loading...</div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <Users size={48} style={{ marginBottom: 12 }} />
            <p>Nothing has been shared with you yet</p>
          </div>
        ) : (
          items.map((item, idx) => (
            <div
              key={idx}
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
                  <div className="action-menu" title="Download">
                    <Download size={16} />
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

export default SharedWithMe;
