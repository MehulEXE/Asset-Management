import { useState } from 'react';
import { Laptop, Eye, EyeOff, Loader2, ShieldCheck, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

type Mode = 'login' | 'register';

export function LoginScreen() {
  const { login, register } = useAuth();

  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const resetForm = () => {
    setName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setError('');
    setSuccess('');
  };

  const switchMode = (newMode: Mode) => {
    resetForm();
    setMode(newMode);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (mode === 'register') {
      if (!name.trim()) { setError('Full name is required.'); return; }
      if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
      if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    }

    if (!email.trim() || !password.trim()) {
      setError('Email and password are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === 'login') {
        await login(email, password);
        // Auth context will redirect away from login screen
      } else {
        await register(name, email, password);
        setSuccess('Account created! Signing you in…');
        // register() auto-logs in via AuthContext
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-screen">
      {/* Animated background orbs */}
      <div className="login-bg-orb login-bg-orb-1" />
      <div className="login-bg-orb login-bg-orb-2" />
      <div className="login-bg-orb login-bg-orb-3" />

      <div className="login-card animated-fade">
        {/* Branding */}
        <div className="login-brand">
          <div className="login-logo">
            <Laptop size={32} />
          </div>
          <h1>ITAM Portal</h1>
          <p>Enterprise IT Asset Management</p>
        </div>

        {/* Form Header */}
        <div className="login-form-header">
          <h2>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
          <p>{mode === 'login'
            ? 'Sign in to access the asset management dashboard'
            : 'Register to get started with asset tracking'
          }</p>
        </div>

        {/* Toasts */}
        {error && (
          <div className="login-toast login-toast-error animated-fade">
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="login-toast login-toast-success animated-fade">
            <span>{success}</span>
          </div>
        )}

        {/* Form */}
        <form className="login-form" onSubmit={handleSubmit}>
          {mode === 'register' && (
            <div className="login-field">
              <label htmlFor="login-name">Full Name</label>
              <input
                id="login-name"
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            </div>
          )}

          <div className="login-field">
            <label htmlFor="login-email">Email Address</label>
            <input
              id="login-email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div className="login-field">
            <label htmlFor="login-password">Password</label>
            <div className="login-password-wrapper">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
              <button
                type="button"
                className="login-password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {mode === 'register' && (
            <div className="login-field">
              <label htmlFor="login-confirm">Confirm Password</label>
              <input
                id="login-confirm"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
          )}

          <button
            type="submit"
            className="login-submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                {mode === 'login' ? 'Signing in…' : 'Creating account…'}
              </>
            ) : (
              <>
                {mode === 'login' ? (
                  <>
                    <ShieldCheck size={18} />
                    Sign In
                  </>
                ) : (
                  <>
                    <ArrowRight size={18} />
                    Create Account
                  </>
                )}
              </>
            )}
          </button>
        </form>

        {/* Mode Toggle */}
        <div className="login-toggle">
          {mode === 'login' ? (
            <p>
              Don't have an account?{' '}
              <button type="button" onClick={() => switchMode('register')}>
                Create one
              </button>
            </p>
          ) : (
            <p>
              Already have an account?{' '}
              <button type="button" onClick={() => switchMode('login')}>
                Sign in
              </button>
            </p>
          )}
        </div>

        {/* Quick login buttons */}
        {mode === 'login' && (
          <div className="login-quick-buttons">
            <button
              type="button"
              className="login-quick-btn login-quick-btn-admin"
              onClick={() => {
                setEmail('admin@gmail.com');
                setPassword('admin123');
              }}
            >
              <ShieldCheck size={15} />
              Admin Login
            </button>
            <button
              type="button"
              className="login-quick-btn login-quick-btn-user"
              onClick={() => {
                setEmail('test@gmail.com');
                setPassword('test123');
              }}
            >
              <Laptop size={15} />
              Test User
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
