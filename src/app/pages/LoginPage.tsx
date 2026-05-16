import { useState } from 'react';
import { motion } from 'motion/react';
import { Mail, Lock, User, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
  const { login, signup, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (isLogin) {
        await login(formData.email, formData.password);
      } else {
        await signup(formData.email, formData.password, formData.username);
      }
      navigate('/profile');
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-x-hidden bg-background px-3 sm:px-4 pb-20 pt-4 sm:pt-8 lg:pb-8">
      {/* Atmospheric Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-crimson/[0.03] blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-gold/[0.02] blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Card */}
        <div className="rounded-lg border border-gold/[0.08] bg-card/90 p-5 sm:p-6 md:p-8 shadow-2xl shadow-black/30 backdrop-blur-xl">
          {/* Decorative top line */}
          <div className="mb-6 sm:mb-8 h-[1px] bg-gradient-to-r from-transparent via-gold/15 to-transparent" />
          
          {/* Logo & Header */}
          <div className="mb-6 sm:mb-8 text-center">
            <img 
              src="/rebyuu-logo.png" 
              alt="Rebyuu Logo" 
              className="mx-auto mb-4 h-12 w-12 sm:h-14 sm:w-14 object-contain opacity-80"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
            <h1 className="mb-2 text-2xl sm:text-3xl font-semibold text-foreground" style={{ fontFamily: 'Cinzel, serif' }}>
              {isLogin ? 'Welcome Back' : 'Join the Archive'}
            </h1>
            <p className="text-sm text-muted-foreground" style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '15px', fontStyle: 'italic' }}>
              {isLogin ? 'Continue your journey through the archive' : 'Begin your path as a keeper of anime culture'}
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-md bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive" style={{ fontFamily: 'Outfit, sans-serif' }}>
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label htmlFor="username" className="mb-2 block text-xs font-medium tracking-wider uppercase text-foreground/70" style={{ fontFamily: 'Outfit, sans-serif' }}>
                  Username
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gold/30" />
                  <input
                    id="username"
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="Choose a name"
                    required={!isLogin}
                    className="input-imperial pl-10 min-h-[44px]"
                    style={{ fontSize: '16px' }}
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="email" className="mb-2 block text-xs font-medium tracking-wider uppercase text-foreground/70" style={{ fontFamily: 'Outfit, sans-serif' }}>
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gold/30" />
                <input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="your@email.com"
                  required
                  className="input-imperial pl-10 min-h-[44px]"
                  style={{ fontSize: '16px' }}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-xs font-medium tracking-wider uppercase text-foreground/70" style={{ fontFamily: 'Outfit, sans-serif' }}>
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gold/30" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Enter your password"
                  required
                  className="input-imperial pl-10 pr-12 min-h-[44px]"
                  style={{ fontSize: '16px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gold/30 hover:text-gold/60 min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {isLogin && (
              <div className="flex items-center justify-between text-xs" style={{ fontFamily: 'Outfit, sans-serif' }}>
                <label className="flex items-center gap-2 text-foreground/60">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-gold/20 bg-input-background text-crimson focus:ring-2 focus:ring-crimson/20"
                  />
                  Remember me
                </label>
                <button type="button" className="text-gold/60 hover:text-gold transition-colors">
                  Forgot password?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-imperial w-full min-h-[48px] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Loading...' : isLogin ? 'Enter the Archive' : 'Create Account'}
            </button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center gap-4">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-gold/10" />
            <span className="text-[10px] tracking-[0.15em] uppercase text-gold/30" style={{ fontFamily: 'Outfit, sans-serif' }}>or</span>
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-gold/10" />
          </div>

          {/* Google Sign In */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="btn-imperial-outline w-full min-h-[48px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </span>
          </button>

          {/* Toggle */}
          <div className="mt-6 text-center text-xs text-muted-foreground" style={{ fontFamily: 'Outfit, sans-serif' }}>
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="font-semibold text-gold hover:text-gold-light transition-colors"
            >
              {isLogin ? 'Sign up' : 'Sign in'}
            </button>
          </div>

          {/* Decorative bottom line */}
          <div className="mt-6 h-[1px] bg-gradient-to-r from-transparent via-gold/10 to-transparent" />
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-[10px] text-muted-foreground/40 tracking-wider" style={{ fontFamily: 'Outfit, sans-serif' }}>
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </motion.div>
    </div>
  );
}
