import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Files, FolderOpen, Trash2, Upload, Clock, HardDrive } from 'lucide-react';
import api from '../utils/api';
import '../styles/dashboard.css';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({ used: 0, total: 5368709120, fileCount: 0, folderCount: 0, deletedCount: 0 });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const [storageRes, activityRes, filesRes, deletedRes] = await Promise.all([
          api.get('/me/storage'),
          api.get('/activity'),
          api.get('/files'),
          api.get('/files/deleted'),
        ]);

        const items = filesRes.data;
        setStats({
          used: parseInt(storageRes.data.used_bytes) || 0,
          total: parseInt(storageRes.data.quota_bytes) || 5368709120,
          fileCount: items.filter((i: any) => i.type === 'file').length,
          folderCount: items.filter((i: any) => i.type === 'folder').length,
          deletedCount: deletedRes.data.length,
        });
        setRecentActivity(activityRes.data.slice(0, 8));
      } catch (err) {
        console.error('Dashboard error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const percentage = Math.min(100, (stats.used / stats.total) * 100);

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'upload': return <Upload size={14} />;
      case 'delete': case 'delete_external': return <Trash2 size={14} />;
      default: return <Clock size={14} />;
    }
  };

  if (loading) return <div className="page-content"><div className="loading">Loading dashboard...</div></div>;

  return (
    <div className="page-content">
      <div className="dashboard-greeting">
        <h2>Welcome, {user?.fullName}</h2>
        <p>Here's an overview of your drive</p>
      </div>

      <div className="dashboard-cards">
        <div className="dash-card">
          <div className="dash-card-icon storage"><HardDrive size={24} /></div>
          <div className="dash-card-info">
            <span className="dash-card-value">{formatBytes(stats.used)}</span>
            <span className="dash-card-label">of {formatBytes(stats.total)} used</span>
          </div>
          <div className="dash-storage-bar">
            <div className={`dash-storage-fill ${percentage > 90 ? 'danger' : percentage > 70 ? 'warning' : ''}`}
              style={{ width: `${percentage}%` }}></div>
          </div>
        </div>

        <div className="dash-card">
          <div className="dash-card-icon files"><Files size={24} /></div>
          <div className="dash-card-info">
            <span className="dash-card-value">{stats.fileCount}</span>
            <span className="dash-card-label">Files</span>
          </div>
        </div>

        <div className="dash-card">
          <div className="dash-card-icon folders"><FolderOpen size={24} /></div>
          <div className="dash-card-info">
            <span className="dash-card-value">{stats.folderCount}</span>
            <span className="dash-card-label">Folders</span>
          </div>
        </div>

        <div className="dash-card">
          <div className="dash-card-icon trash"><Trash2 size={24} /></div>
          <div className="dash-card-info">
            <span className="dash-card-value">{stats.deletedCount}</span>
            <span className="dash-card-label">In Recycle Bin</span>
          </div>
        </div>
      </div>

      <div className="dashboard-activity">
        <h3>Recent Activity</h3>
        {recentActivity.length === 0 ? (
          <p className="empty-state">No recent activity</p>
        ) : (
          <div className="activity-mini-list">
            {recentActivity.map((log, idx) => (
              <div key={idx} className="activity-mini-item">
                <div className="activity-mini-icon">{getActionIcon(log.action)}</div>
                <div className="activity-mini-text">
                  <span className="activity-mini-actor">{log.actor_name || 'System'}</span>
                  <span className="activity-mini-action">{log.action}ed</span>
                  <span className="activity-mini-target">{log.file_name || log.folder_name}</span>
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
