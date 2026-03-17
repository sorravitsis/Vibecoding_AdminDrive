import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Files, FolderOpen, Trash2, Upload, Clock, HardDrive, Loader, Inbox,
  Image, Film, Music, FileText, File, Share2, Download, Edit3, ArrowRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import '../styles/dashboard.css';

const formatAction = (action: string) => {
  const map: Record<string, string> = {
    upload: 'uploaded', delete: 'deleted', delete_external: 'deleted (external)',
    restore: 'restored', download: 'downloaded', share: 'shared',
    rename: 'renamed', create: 'created', suspend: 'suspended',
    activate: 'activated', create_user: 'created user', update_user: 'updated user',
    reset_password: 'reset password for', login: 'logged in', login_failed: 'failed login',
    copy: 'copied', move: 'moved',
  };
  return map[action] || action;
};

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const CATEGORY_COLORS: Record<string, string> = {
  image: '#22d3ee',
  video: '#a78bfa',
  audio: '#f472b6',
  document: '#60a5fa',
  other: '#94a3b8',
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  image: <Image size={16} />,
  video: <Film size={16} />,
  audio: <Music size={16} />,
  document: <FileText size={16} />,
  other: <File size={16} />,
};

interface DashboardData {
  storage: { used_bytes: string; quota_bytes: string; pct: string };
  file_counts: { total_files: string; total_folders: string; deleted_files: string };
  file_type_breakdown: { mime_category: string; count: string; total_size: string }[];
  recent_files: { file_name: string; file_size: string; mime_type: string; created_at: string }[];
  recent_activity: { action: string; target_type: string; created_at: string; actor_name: string; metadata: any }[];
}

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard/stats')
      .then(res => setData(res.data))
      .catch(err => console.error('Dashboard error:', err))
      .finally(() => setLoading(false));
  }, []);

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'upload': return <Upload size={14} />;
      case 'delete': case 'delete_external': return <Trash2 size={14} />;
      case 'share': return <Share2 size={14} />;
      case 'download': return <Download size={14} />;
      case 'rename': return <Edit3 size={14} />;
      default: return <Clock size={14} />;
    }
  };

  if (loading) return (
    <div className="page-content">
      <div className="loading-spinner"><Loader size={24} className="spin" /><span>Loading dashboard...</span></div>
    </div>
  );

  if (!data) return (
    <div className="page-content">
      <div className="empty-state-box"><Inbox size={48} /><p>Failed to load dashboard</p></div>
    </div>
  );

  const used = parseInt(data.storage.used_bytes) || 0;
  const total = parseInt(data.storage.quota_bytes) || 5368709120;
  const pct = Math.min(100, (used / total) * 100);
  const totalBreakdownSize = data.file_type_breakdown.reduce((s, b) => s + parseInt(b.total_size || '0'), 0);

  return (
    <div className="page-content">
      <div className="dashboard-greeting">
        <h2>Welcome, {user?.fullName}</h2>
        <p>Here's an overview of your SiS Warehouse</p>
      </div>

      {/* Stats Cards */}
      <div className="dashboard-cards">
        <div className="dash-card">
          <div className="dash-card-icon storage"><HardDrive size={24} /></div>
          <div className="dash-card-info">
            <span className="dash-card-value">{formatBytes(used)}</span>
            <span className="dash-card-label">of {formatBytes(total)} used</span>
          </div>
          <div className="dash-storage-bar">
            <div className={`dash-storage-fill ${pct > 90 ? 'danger' : pct > 70 ? 'warning' : ''}`}
              style={{ width: `${pct}%` }}></div>
          </div>
        </div>

        <div className="dash-card clickable" onClick={() => navigate('/files')}>
          <div className="dash-card-icon files"><Files size={24} /></div>
          <div className="dash-card-info">
            <span className="dash-card-value">{data.file_counts.total_files}</span>
            <span className="dash-card-label">Files</span>
          </div>
        </div>

        <div className="dash-card clickable" onClick={() => navigate('/files')}>
          <div className="dash-card-icon folders"><FolderOpen size={24} /></div>
          <div className="dash-card-info">
            <span className="dash-card-value">{data.file_counts.total_folders}</span>
            <span className="dash-card-label">Folders</span>
          </div>
        </div>

        <div className="dash-card clickable" onClick={() => navigate('/recycle-bin')}>
          <div className="dash-card-icon trash"><Trash2 size={24} /></div>
          <div className="dash-card-info">
            <span className="dash-card-value">{data.file_counts.deleted_files}</span>
            <span className="dash-card-label">In Recycle Bin</span>
          </div>
        </div>
      </div>

      {/* Two-column layout: File Type Breakdown + Recent Files */}
      <div className="dashboard-columns">
        {/* File Type Breakdown */}
        <div className="dashboard-section">
          <h3>Storage by File Type</h3>
          {data.file_type_breakdown.length === 0 ? (
            <p className="dash-empty">No files yet</p>
          ) : (
            <div className="type-breakdown">
              <div className="type-bar">
                {data.file_type_breakdown.map(b => {
                  const size = parseInt(b.total_size || '0');
                  const w = totalBreakdownSize > 0 ? (size / totalBreakdownSize) * 100 : 0;
                  return (
                    <div
                      key={b.mime_category}
                      className="type-bar-segment"
                      style={{ width: `${Math.max(w, 2)}%`, background: CATEGORY_COLORS[b.mime_category] || CATEGORY_COLORS.other }}
                      title={`${b.mime_category}: ${formatBytes(size)}`}
                    />
                  );
                })}
              </div>
              <div className="type-legend">
                {data.file_type_breakdown.map(b => (
                  <div key={b.mime_category} className="type-legend-item">
                    <span className="type-legend-dot" style={{ background: CATEGORY_COLORS[b.mime_category] || CATEGORY_COLORS.other }} />
                    <span className="type-legend-icon">{CATEGORY_ICONS[b.mime_category] || CATEGORY_ICONS.other}</span>
                    <span className="type-legend-label">{b.mime_category}</span>
                    <span className="type-legend-count">{b.count} files</span>
                    <span className="type-legend-size">{formatBytes(parseInt(b.total_size || '0'))}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Recent Files */}
        <div className="dashboard-section">
          <div className="section-header">
            <h3>Recent Files</h3>
            <button className="dash-link" onClick={() => navigate('/files')}>View all <ArrowRight size={14} /></button>
          </div>
          {data.recent_files.length === 0 ? (
            <p className="dash-empty">No files uploaded yet</p>
          ) : (
            <div className="recent-files-list">
              {data.recent_files.map((f, idx) => (
                <div key={idx} className="recent-file-item">
                  <div className="recent-file-icon">
                    {f.mime_type?.startsWith('image/') ? <Image size={16} /> :
                     f.mime_type?.startsWith('video/') ? <Film size={16} /> :
                     f.mime_type?.startsWith('audio/') ? <Music size={16} /> :
                     f.mime_type === 'application/pdf' ? <FileText size={16} /> :
                     <File size={16} />}
                  </div>
                  <span className="recent-file-name">{f.file_name}</span>
                  <span className="recent-file-size">{formatBytes(parseInt(f.file_size || '0'))}</span>
                  <span className="recent-file-date">{new Date(f.created_at).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="dashboard-activity">
        <div className="section-header">
          <h3>Recent Activity</h3>
          <button className="dash-link" onClick={() => navigate('/activity')}>View all <ArrowRight size={14} /></button>
        </div>
        {data.recent_activity.length === 0 ? (
          <div className="empty-state-box">
            <Inbox size={40} />
            <p>No recent activity</p>
          </div>
        ) : (
          <div className="activity-mini-list">
            {data.recent_activity.map((log, idx) => (
              <div key={idx} className="activity-mini-item">
                <div className="activity-mini-icon">{getActionIcon(log.action)}</div>
                <div className="activity-mini-text">
                  <span className="activity-mini-actor">{log.actor_name || 'System'}</span>
                  <span className="activity-mini-action">{formatAction(log.action)}</span>
                  <span className="activity-mini-target">{log.metadata?.file_name || log.metadata?.folder_name || ''}</span>
                </div>
                <span className="activity-mini-time">{new Date(log.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
