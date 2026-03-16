import React, { useState, useEffect } from 'react';
import {
  UserX,
  UserCheck,
  Shield,
  UserPlus,
  X
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
  role?: string;
}

const UsersManagement: React.FC = () => {
  const [users, setUsers] = useState<UserStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ email: '', fullName: '', password: '', userRole: 'user' });
  const [creating, setCreating] = useState(false);

  const handleCreateUser = async () => {
    if (!createForm.email || !createForm.fullName || !createForm.password) {
      alert('Please fill all fields');
      return;
    }
    setCreating(true);
    try {
      await api.post('/admin/users', createForm);
      alert('User created successfully!');
      setShowCreate(false);
      setCreateForm({ email: '', fullName: '', password: '', userRole: 'user' });
      fetchUsers();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };

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
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create New User</h3>
              <button className="modal-close" onClick={() => setShowCreate(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <label>Full Name</label>
              <input className="modal-input" placeholder="John Doe"
                value={createForm.fullName} onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })} />
              <label>Email</label>
              <input className="modal-input" type="email" placeholder="user@example.com"
                value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} />
              <label>Password</label>
              <input className="modal-input" type="password" placeholder="Min 6 characters"
                value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} />
              <label>Role</label>
              <select className="modal-input" value={createForm.userRole}
                onChange={(e) => setCreateForm({ ...createForm, userRole: e.target.value })}>
                <option value="user">User</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
              <p style={{ fontSize: 12, color: '#888', margin: '4px 0 0' }}>Quota: 5 GB (default)</p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleCreateUser} disabled={creating}>
                {creating ? 'Creating...' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="users-header">
        <div>
          <h2>Users Management</h2>
          <p>Manage user accounts, storage quotas, and security status</p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(true)}><UserPlus size={18} /><span>Create User</span></button>
      </div>

      <div className="users-table-container">
        {loading ? (
          <div className="loading">Loading user data...</div>
        ) : (
          <table className="users-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
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
                        <span className="user-email">{user.email || ''}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`role-badge ${user.role || 'user'}`}>
                      {user.role || 'user'}
                    </span>
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
