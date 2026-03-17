import React, { useState, useEffect } from 'react';
import { User, Mail, Shield, HardDrive, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import '../styles/profile.css';

const Profile: React.FC = () => {
  const { user } = useAuth();
  const [storage, setStorage] = useState({ used: 0, total: 5 * 1024 * 1024 * 1024 });
  const [passwords, setPasswords] = useState({ current: '', newPass: '', confirm: '' });
  const [passMsg, setPassMsg] = useState('');

  useEffect(() => {
    const fetchStorage = async () => {
      try {
        const res = await api.get('/auth/profile');
        setStorage({
          used: parseInt(res.data.used_bytes || '0'),
          total: parseInt(res.data.quota_bytes || String(5 * 1024 ** 3)),
        });
      } catch {
        // fallback — keep defaults
      }
    };
    fetchStorage();
  }, []);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassMsg('');
    if (passwords.newPass !== passwords.confirm) {
      setPassMsg('New passwords do not match');
      return;
    }
    if (passwords.newPass.length < 6) {
      setPassMsg('Password must be at least 6 characters');
      return;
    }
    try {
      await api.put('/auth/password', {
        currentPassword: passwords.current,
        newPassword: passwords.newPass,
      });
      setPassMsg('Password changed successfully');
      setPasswords({ current: '', newPass: '', confirm: '' });
    } catch (err: any) {
      setPassMsg(err.response?.data?.error || 'Failed to change password');
    }
  };

  const usedGB = (storage.used / 1024 ** 3).toFixed(2);
  const totalGB = (storage.total / 1024 ** 3).toFixed(0);
  const pct = Math.min(100, (storage.used / storage.total) * 100);

  return (
    <div className="page-content">
      <h2 className="profile-title">My Profile</h2>

      <div className="profile-grid">
        <div className="profile-card">
          <div className="profile-avatar">
            {user?.fullName?.charAt(0).toUpperCase()}
          </div>
          <div className="profile-info-list">
            <div className="profile-info-row">
              <User size={16} />
              <span className="label">Name</span>
              <span className="value">{user?.fullName}</span>
            </div>
            <div className="profile-info-row">
              <Mail size={16} />
              <span className="label">Email</span>
              <span className="value">{user?.email}</span>
            </div>
            <div className="profile-info-row">
              <Shield size={16} />
              <span className="label">Role</span>
              <span className={`role-badge ${user?.role}`}>{user?.role}</span>
            </div>
            <div className="profile-info-row">
              <HardDrive size={16} />
              <span className="label">Storage</span>
              <span className="value">{usedGB} GB / {totalGB} GB</span>
            </div>
            <div className="storage-bar">
              <div
                className={`storage-fill ${pct > 90 ? 'danger' : pct > 70 ? 'warning' : ''}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>

        <div className="profile-card">
          <h3><Lock size={18} /> Change Password</h3>
          <form onSubmit={handleChangePassword} className="password-form">
            <div className="form-group">
              <label>Current Password</label>
              <input
                type="password"
                value={passwords.current}
                onChange={e => setPasswords(p => ({ ...p, current: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label>New Password</label>
              <input
                type="password"
                value={passwords.newPass}
                onChange={e => setPasswords(p => ({ ...p, newPass: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label>Confirm New Password</label>
              <input
                type="password"
                value={passwords.confirm}
                onChange={e => setPasswords(p => ({ ...p, confirm: e.target.value }))}
                required
              />
            </div>
            {passMsg && (
              <div className={`pass-msg ${passMsg.includes('success') ? 'success' : 'error'}`}>
                {passMsg}
              </div>
            )}
            <button type="submit" className="btn-primary">Update Password</button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Profile;
