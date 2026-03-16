import React, { useState, useEffect } from 'react';
import {
  Upload, Trash2, RotateCcw, Download, Share2, Edit3, User, Clock, Shield, ChevronLeft, ChevronRight, Loader, Inbox
} from 'lucide-react';
import api from '../utils/api';
import '../styles/activity.css';

interface LogItem {
  actor_name: string;
  action: string;
  target_type: 'file' | 'folder' | 'user';
  file_name: string;
  folder_name: string;
  target_email: string;
  created_at: string;
}

const ActivityStream: React.FC = () => {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchLogs = async (p: number) => {
    setLoading(true);
    try {
      const response = await api.get(`/activity?page=${p}&limit=30`);
      setLogs(response.data.data);
      setTotalPages(response.data.totalPages);
      setTotal(response.data.total);
      setPage(p);
    } catch (err) {
      console.error('Failed to fetch logs', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(1); }, []);

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'upload': return <Upload size={16} className="text-success" />;
      case 'delete': case 'delete_external': return <Trash2 size={16} className="text-danger" />;
      case 'restore': return <RotateCcw size={16} className="text-info" />;
      case 'download': return <Download size={16} className="text-primary" />;
      case 'share': return <Share2 size={16} className="text-warning" />;
      case 'rename': return <Edit3 size={16} className="text-secondary" />;
      case 'suspend': case 'activate': case 'create_user': case 'update_user': case 'reset_password':
        return <Shield size={16} className="text-primary" />;
      default: return <Clock size={16} />;
    }
  };

  const getTargetName = (log: LogItem) => {
    if (log.target_type === 'user') return log.target_email || 'user';
    return log.target_type === 'file' ? log.file_name : log.folder_name;
  };

  const formatAction = (action: string) => {
    const map: Record<string, string> = {
      upload: 'uploaded', delete: 'deleted', delete_external: 'deleted (external)',
      restore: 'restored', download: 'downloaded', share: 'shared',
      rename: 'renamed', create: 'created', suspend: 'suspended',
      activate: 'activated', create_user: 'created user', update_user: 'updated user',
      reset_password: 'reset password for', login: 'logged in', login_failed: 'failed login',
      reconcile_quotas: 'reconciled quotas', cleanup_orphans: 'cleaned up orphans',
    };
    return map[action] || action;
  };

  return (
    <div className="page-content">
      <div className="activity-header">
        <h2>Activity Stream</h2>
        <p>{total} total events</p>
      </div>

      <div className="activity-list">
        {loading ? (
          <div className="loading-spinner"><Loader size={24} className="spin" /><span>Loading activities...</span></div>
        ) : logs.length === 0 ? (
          <div className="empty-state-box"><Inbox size={48} /><p>No recent activity</p></div>
        ) : (
          logs.map((log, idx) => (
            <div key={idx} className="activity-item">
              <div className="activity-icon-bg">{getActionIcon(log.action)}</div>
              <div className="activity-details">
                <div className="activity-main">
                  <span className="actor-name">{log.actor_name || 'System'}</span>
                  <span className="action-text">{formatAction(log.action)}</span>
                  <span className="target-name">{getTargetName(log)}</span>
                </div>
                <div className="activity-meta">
                  <div className="meta-item"><Clock size={12} /> {new Date(log.created_at).toLocaleString()}</div>
                  <div className="meta-item"><User size={12} /> {log.target_type}</div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button className="btn-secondary btn-sm" onClick={() => fetchLogs(page - 1)} disabled={page <= 1}>
            <ChevronLeft size={16} /> Prev
          </button>
          <span className="page-info">Page {page} of {totalPages}</span>
          <button className="btn-secondary btn-sm" onClick={() => fetchLogs(page + 1)} disabled={page >= totalPages}>
            Next <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
};

export default ActivityStream;
