import React, { useState, useEffect } from 'react';
import { 
  Upload, 
  Trash2, 
  RotateCcw, 
  Download, 
  Share2, 
  Edit3,
  User,
  Clock
} from 'lucide-react';
import api from '../utils/api';
import '../styles/activity.css';

interface LogItem {
  actor_name: string;
  action: string;
  target_type: 'file' | 'folder';
  file_name: string;
  folder_name: string;
  created_at: string;
}

const ActivityStream: React.FC = () => {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const response = await api.get('/activity');
        setLogs(response.data);
      } catch (err) {
        console.error('Failed to fetch logs', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'upload': return <Upload size={16} className="text-success" />;
      case 'delete': return <Trash2 size={16} className="text-danger" />;
      case 'restore': return <RotateCcw size={16} className="text-info" />;
      case 'download': return <Download size={16} className="text-primary" />;
      case 'share': return <Share2 size={16} className="text-warning" />;
      case 'rename': return <Edit3 size={16} className="text-secondary" />;
      default: return <Clock size={16} />;
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <div className="page-content">
      <div className="activity-header">
        <h2>Global Activity Stream</h2>
        <p>Recent events across the drive</p>
      </div>

      <div className="activity-list">
        {loading ? (
          <div className="loading">Loading activities...</div>
        ) : logs.length === 0 ? (
          <div className="empty-state">No recent activity</div>
        ) : (
          logs.map((log, idx) => (
            <div key={idx} className="activity-item">
              <div className="activity-icon-bg">
                {getActionIcon(log.action)}
              </div>
              <div className="activity-details">
                <div className="activity-main">
                  <span className="actor-name">{log.actor_name || 'System'}</span>
                  <span className="action-text">{log.action}ed</span>
                  <span className="target-name">
                    {log.target_type === 'file' ? log.file_name : log.folder_name}
                  </span>
                </div>
                <div className="activity-meta">
                  <div className="meta-item"><Clock size={12} /> {formatTime(log.created_at)}</div>
                  <div className="meta-item"><User size={12} /> {log.target_type}</div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ActivityStream;
