import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Files, Trash2, History, Users, LogOut, Warehouse, Wrench, Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import '../styles/sidebar.css';

const Sidebar = () => {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const menuItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard, roles: ['admin', 'manager', 'user'] },
    { name: 'Files', path: '/files', icon: Files, roles: ['admin', 'manager', 'user'] },
    { name: 'Recycle Bin', path: '/recycle-bin', icon: Trash2, roles: ['admin', 'manager', 'user'] },
    { name: 'Activity Stream', path: '/activity', icon: History, roles: ['admin', 'manager', 'user'] },
    { name: 'Users Management', path: '/admin/users', icon: Users, roles: ['admin'] },
    { name: 'Maintenance', path: '/admin/maintenance', icon: Wrench, roles: ['admin'] },
  ];

  return (
    <>
      {/* Mobile hamburger button */}
      <button className="mobile-menu-btn" onClick={() => setMobileOpen(true)}>
        <Menu size={24} />
      </button>

      {/* Overlay for mobile */}
      {mobileOpen && <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />}

      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <div className="logo">
          <Warehouse size={28} />
          <div className="logo-text">
            <h2>SiS Warehouse</h2>
            <span>File Management</span>
          </div>
          <button className="mobile-close-btn" onClick={() => setMobileOpen(false)}>
            <X size={20} />
          </button>
        </div>
        <nav className="nav-menu">
          {menuItems.map((item) => (
            item.roles.includes(user?.role || '') && (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
                onClick={() => setMobileOpen(false)}
              >
                <item.icon size={20} />
                <span>{item.name}</span>
              </NavLink>
            )
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">{user?.fullName?.charAt(0) || 'U'}</div>
            <div className="user-text">
              <p className="user-name">{user?.fullName}</p>
              <p className="user-role">{user?.role}</p>
            </div>
          </div>
          <button className="logout-btn" onClick={logout}>
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
