import React, { useState, useEffect } from 'react';
import { 
  UserX, 
  UserCheck, 
  Shield, 
  MoreVertical
} from 'lucide-react';
import api from '../utils/api';
import '../styles/users.css';

interface UserStats {
  full_name: string;
  used_bytes: string;
  quota_bytes: string;
  pct: string;
  email?: string;
  status?: string;
  user_id?: string;
}

const UsersManagement: React.FC = () => {
  const [users, setUsers] = useState<UserStats[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/storage-stats');
      // In a real app, we might need a separate endpoint for full user list, 
      // but we'll use storage-stats for now as it contains the key info.
      setUsers(response.data);
    } catch (err) {
      console.error('Failed to fetch user stats', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleToggleStatus = async (userId: string, currentStatus: string) => {
    try {
      if (currentStatus === 'suspended') {
        await api.put(`/admin/users/${userId}/activate`);
      } else {
        await api.put(`/admin/users/${userId}/suspend`);
      }
      fetchUsers();
    } catch (err) {
      alert('Failed to update user status');
    }
  };

  const formatBytes = (bytes: string) => {
    const b = parseInt(bytes);
    if (b === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(b) / Math.log(k));
    return parseFloat((b / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="page-content">
      <div className="users-header">
        <h2>Users Management</h2>
        <p>Manage user accounts, storage quotas, and security status</p>
      </div>

      <div className="users-table-container">
        {loading ? (
          <div className="loading">Loading user data...</div>
        ) : (
          <table className="users-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Status</th>
                <th>Storage Usage</th>
                <th>Quota</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user, idx) => (
                <tr key={idx}>
                  <td>
                    <div className="user-cell">
                      <div className="avatar-placeholder">
                        <Shield size={16} />
                      </div>
                      <div className="user-info-text">
                        <span className="user-name">{user.full_name}</span>
                        <span className="user-email">user@example.com</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`status-badge ${user.status || 'active'}`}>
                      {user.status || 'active'}
                    </span>
                  </td>
                  <td>
                    <div className="storage-cell">
                      <div className="storage-text">{user.pct}% used</div>
                      <div className="mini-progress">
                        <div className="mini-fill" style={{ width: `${user.pct}%` }}></div>
                      </div>
                      <div className="storage-detail">{formatBytes(user.used_bytes)}</div>
                    </div>
                  </td>
                  <td>{formatBytes(user.quota_bytes)}</td>
                  <td>
                    <div className="action-buttons">
                      <button 
                        className={`action-btn ${user.status === 'suspended' ? 'activate' : 'suspend'}`}
                        onClick={() => handleToggleStatus(user.user_id || 'dummy', user.status || 'active')}
                        title={user.status === 'suspended' ? 'Activate' : 'Suspend'}
                      >
                        {user.status === 'suspended' ? <UserCheck size={18} /> : <UserX size={18} />}
                      </button>
                      <button className="action-btn">
                        <MoreVertical size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default UsersManagement;
