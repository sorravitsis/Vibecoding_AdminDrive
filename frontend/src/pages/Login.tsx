import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Warehouse, Mail, Lock, ArrowRight, Eye, EyeOff, User } from 'lucide-react';
import api from '../utils/api';
import '../styles/login.css';

const Login: React.FC = () => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setFullName('');
    setError('');
    setSuccess('');
  };

  const switchMode = (newMode: 'login' | 'register') => {
    resetForm();
    setMode(newMode);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await api.post('/auth/login', { email, password });
      const { token, user } = response.data;
      login(token, user);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await api.post('/auth/register', { email, fullName, password });
      setSuccess('Account created successfully! You can now sign in.');
      const registeredEmail = email;
      setTimeout(() => {
        setMode('login');
        setPassword('');
        setFullName('');
        setError('');
        setSuccess('');
        setEmail(registeredEmail);
      }, 1500);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-bg-pattern"></div>
      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-icon">
            <Warehouse size={32} />
          </div>
          <h2>SiS Warehouse</h2>
          <p>{mode === 'login' ? 'Sign in to your account' : 'Create a new account'}</p>
        </div>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        {mode === 'login' ? (
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label>Email</label>
              <div className="input-wrapper">
                <Mail size={18} className="input-icon" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>
            <div className="form-group">
              <label>Password</label>
              <div className="input-wrapper">
                <Lock size={18} className="input-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="login-btn">
              {loading ? (
                <span className="btn-loading">Signing in...</span>
              ) : (
                <>Sign In <ArrowRight size={18} /></>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister}>
            <div className="form-group">
              <label>Full Name</label>
              <div className="input-wrapper">
                <User size={18} className="input-icon" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                  required
                />
              </div>
            </div>
            <div className="form-group">
              <label>Email</label>
              <div className="input-wrapper">
                <Mail size={18} className="input-icon" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>
            <div className="form-group">
              <label>Password</label>
              <div className="input-wrapper">
                <Lock size={18} className="input-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 chars, upper+lower+number"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="login-btn">
              {loading ? (
                <span className="btn-loading">Creating account...</span>
              ) : (
                <>Create Account <ArrowRight size={18} /></>
              )}
            </button>
          </form>
        )}

        <div className="login-switch">
          {mode === 'login' ? (
            <p>Don't have an account? <button type="button" onClick={() => switchMode('register')}>Create one</button></p>
          ) : (
            <p>Already have an account? <button type="button" onClick={() => switchMode('login')}>Sign in</button></p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
