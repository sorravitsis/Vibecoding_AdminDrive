import React, { useState, useEffect } from 'react';
import { X, File, User, Calendar, HardDrive, Clock } from 'lucide-react';
import api from '../utils/api';
import '../styles/file-info-panel.css';
import '../styles/shared.css';

interface FileInfo {
  file_name: string;
  file_size: string;
  mime_type: string;
  created_at: string;
  uploader_name: string;
  folder_path: string;
  shared_with: { full_name: string; access_level: string }[];
  recent_activity: { action: string; actor_name: string; created_at: string }[];
}

interface FileInfoPanelProps {
  fileId: string;
  onClose: () => void;
}

const FileInfoPanel: React.FC<FileInfoPanelProps> = ({ fileId, onClose }) => {
  const [info, setInfo] = useState<FileInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInfo = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/files/${fileId}/info`);
        setInfo(res.data);
      } catch (err) {
        console.error('Failed to fetch file info', err);
      } finally {
        setLoading(false);
      }
    };
    fetchInfo();
  }, [fileId]);

  return (
    <>
      <div className="info-panel-overlay" onClick={onClose} />
      <div className="info-panel">
        <div className="info-panel-header">
          <h3>File Details</h3>
          <button className="info-panel-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div className="info-panel-loading">Loading...</div>
        ) : !info ? (
          <div className="info-panel-loading">Failed to load info</div>
        ) : (
          <div className="info-panel-body">
            <section className="info-section">
              <h4>Details</h4>
              <div className="info-row">
                <File size={14} />
                <span className="info-label">Name</span>
                <span>{info.file_name}</span>
              </div>
              <div className="info-row">
                <HardDrive size={14} />
                <span className="info-label">Size</span>
                <span>{(parseInt(info.file_size) / 1024).toFixed(1)} KB</span>
              </div>
              <div className="info-row">
                <File size={14} />
                <span className="info-label">Type</span>
                <span style={{ wordBreak: 'break-all' }}>{info.mime_type}</span>
              </div>
              <div className="info-row">
                <Calendar size={14} />
                <span className="info-label">Created</span>
                <span>{new Date(info.created_at).toLocaleDateString()}</span>
              </div>
              <div className="info-row">
                <User size={14} />
                <span className="info-label">Owner</span>
                <span>{info.uploader_name}</span>
              </div>
              {info.folder_path && (
                <div className="info-row">
                  <File size={14} />
                  <span className="info-label">Path</span>
                  <span style={{ wordBreak: 'break-all' }}>{info.folder_path}</span>
                </div>
              )}
            </section>

            <section className="info-section">
              <h4>Shared With</h4>
              {info.shared_with.length === 0 ? (
                <p className="info-empty">Not shared with anyone</p>
              ) : (
                info.shared_with.map((s, i) => (
                  <div key={i} className="info-row">
                    <User size={14} />
                    <span style={{ flex: 1 }}>{s.full_name}</span>
                    <span className={`shared-badge ${s.access_level}`}>
                      {s.access_level}
                    </span>
                  </div>
                ))
              )}
            </section>

            <section className="info-section">
              <h4>Recent Activity</h4>
              {info.recent_activity.length === 0 ? (
                <p className="info-empty">No recent activity</p>
              ) : (
                info.recent_activity.map((a, i) => (
                  <div key={i} className="info-activity-row">
                    <Clock size={12} />
                    <span>
                      {a.actor_name} {a.action}ed
                    </span>
                    <span className="info-time">
                      {new Date(a.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))
              )}
            </section>
          </div>
        )}
      </div>
    </>
  );
};

export default FileInfoPanel;
