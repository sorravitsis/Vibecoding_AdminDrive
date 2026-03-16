import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

import api from '../utils/api';
import '../styles/header.css';

const Header: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({ used: 0, total: 5 * 1024 * 1024 * 1024 });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await api.get('/me/storage');
        setStats({
          used: parseInt(response.data.used_bytes),
          total: parseInt(response.data.quota_bytes)
        });
      } catch (err) {
        console.error('Failed to fetch storage stats', err);
      }
    };

    if (user) fetchStats();
  }, [user]);

  const usedGB = (stats.used / (1024 ** 3)).toFixed(2);
  const totalGB = (stats.total / (1024 ** 3)).toFixed(0);
  const percentage = Math.min(100, (stats.used / stats.total) * 100);

  return (
    <header className="main-header">
      <div className="header-left">
        <h1 className="page-title">SiS Warehouse</h1>
      </div>
      <div className="header-right">
        <div className="quota-container">
          <div className="quota-info">
            <span>{usedGB} GB / {totalGB} GB</span>
            <span className={percentage > 90 ? 'text-danger' : percentage > 70 ? 'text-warning' : ''}>{percentage.toFixed(1)}%</span>
          </div>
          <div className="progress-bar">
            <div
              className={`progress-fill ${percentage > 90 ? 'danger' : percentage > 70 ? 'warning' : ''}`}
              style={{ width: `${percentage}%` }}
            ></div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
