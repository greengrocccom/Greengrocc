import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, KeyRound, MessageSquareCode } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/client';
import { BTN, BTN_PRIMARY, INPUT, PAGE_KICKER, PAGE_SUB, PAGE_TITLE, PANEL } from '../utils/ui';
import '../styles/admin.css';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [authMode, setAuthMode] = useState('otp'); // 'otp' | 'password'
  const [email, setEmail] = useState('admin@greengrocc.com');
  const [password, setPassword] = useState('admin123');
  const [adminPhone, setAdminPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [phoneHint, setPhoneHint] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const signInWithPassword = async (loginEmail, loginPassword) => {
    setLoading(true);
    setError('');
    setInfoMsg('');
    try {
      const response = await apiClient.post('/users/login', {
        email: String(loginEmail || '').trim().toLowerCase(),
        password: loginPassword,
      });
      if (response.data?.success && response.data?.data?.token) {
        const { user: authUser, token: authToken } = response.data.data;
        login(authUser, authToken);
        navigate('/');
      } else {
        setError(response.data?.message || 'Login failed. Please check credentials.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const loginIdent = String(adminPhone || email || '').trim();
    if (!loginIdent) {
      setError('Please enter your admin email or registered mobile number.');
      return;
    }
    setLoading(true);
    setError('');
    setInfoMsg('');
    try {
      const response = await apiClient.post('/users/admin/otp/send', {
        login: loginIdent,
      });
      if (response.data?.success) {
        setOtpSent(true);
        setResendCooldown(30);
        setPhoneHint(response.data?.data?.phoneHint || '');
        setInfoMsg(response.data?.message || 'OTP sent successfully to registered phone.');
      } else {
        setError(response.data?.message || 'Failed to send OTP');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send admin OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (resendCooldown > 0 || loading) return;
    const loginIdent = String(adminPhone || email || '').trim();
    if (!loginIdent) {
      setError('Please enter your admin email or registered mobile number.');
      return;
    }
    setLoading(true);
    setError('');
    setInfoMsg('');
    try {
      let response;
      try {
        response = await apiClient.post('/users/admin/otp/resend', { login: loginIdent });
      } catch {
        response = await apiClient.post('/users/admin/otp/send', { login: loginIdent });
      }
      if (response.data?.success) {
        setOtp('');
        setResendCooldown(30);
        setPhoneHint(response.data?.data?.phoneHint || phoneHint || '');
        setInfoMsg(response.data?.message || 'New OTP sent successfully to registered phone.');
      } else {
        setError(response.data?.message || 'Failed to resend OTP');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Could not resend admin OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const loginIdent = String(adminPhone || email || '').trim();
    if (!loginIdent || !otp.trim()) {
      setError('Please enter both admin identifier and the OTP.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.post('/users/admin/otp/verify', {
        login: loginIdent,
        otp: otp.trim(),
      });
      if (response.data?.success && response.data?.data?.token) {
        const { user: authUser, token: authToken } = response.data.data;
        login(authUser, authToken);
        navigate('/');
      } else {
        setError(response.data?.message || 'Invalid OTP');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'OTP verification failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitPassword = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }
    await signInWithPassword(email, password);
  };

  return (
    <div className="admin-auth-shell flex min-h-dvh items-center justify-center px-4 py-8 text-slate-900">
      <div className={`w-full max-w-md ${PANEL} p-5 sm:p-7`}>
        <p className={PAGE_KICKER}>GreenGrocc Admin</p>
        <h1 className={`mt-1 ${PAGE_TITLE}`}>Sign in to Admin Panel</h1>
        <p className={`mt-0.5 ${PAGE_SUB}`}>
          {authMode === 'password'
            ? 'Enter your admin email and password to continue.'
            : 'Sign in securely using Admin Login OTP.'}
        </p>

        {/* Tab switch */}
        <div className="mt-4 flex rounded-xl bg-slate-100 p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setAuthMode('password');
              setError('');
              setInfoMsg('');
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition ${
              authMode === 'password'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <KeyRound className="h-3.5 w-3.5" />
            Password
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode('otp');
              setError('');
              setInfoMsg('');
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition ${
              authMode === 'otp'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MessageSquareCode className="h-3.5 w-3.5" />
            Login with OTP
          </button>
        </div>

        {error ? <p className="mt-3 text-xs text-[#DC2626] font-medium">{error}</p> : null}
        {infoMsg ? <p className="mt-3 text-xs text-emerald-700 font-medium">{infoMsg}</p> : null}

        {authMode === 'password' ? (
          <form onSubmit={handleSubmitPassword} className="mt-4 space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={INPUT}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={INPUT}
              />
            </div>
            <button type="submit" disabled={loading} className={`w-full ${BTN_PRIMARY} py-2`}>
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={otpSent ? handleVerifyOtp : handleSendOtp} className="mt-4 space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold">
                Admin Email or Registered Mobile
              </label>
              <input
                type="text"
                required
                placeholder="admin@greengrocc.com or registered mobile"
                value={adminPhone}
                disabled={otpSent && loading}
                onChange={(e) => {
                  setAdminPhone(e.target.value);
                }}
                className={INPUT}
              />
            </div>

            {otpSent ? (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold">Enter 6-digit OTP</label>
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={loading || resendCooldown > 0}
                    className={`text-[11px] font-semibold transition ${
                      resendCooldown > 0 || loading
                        ? "text-slate-400 cursor-not-allowed"
                        : "text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer"
                    }`}
                  >
                    {loading
                      ? "Sending..."
                      : resendCooldown > 0
                      ? `Resend OTP in ${resendCooldown}s`
                      : "Resend OTP"}
                  </button>
                </div>
                <input
                  type="text"
                  required
                  maxLength={8}
                  placeholder="Enter OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className={`${INPUT} tracking-widest text-center font-mono text-base font-bold`}
                />
                {phoneHint ? (
                  <p className="mt-1 text-[11px] text-slate-500">Sent to {phoneHint}</p>
                ) : null}
              </div>
            ) : null}

            <button type="submit" disabled={loading} className={`w-full ${BTN_PRIMARY} py-2`}>
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Please wait...
                </span>
              ) : otpSent ? (
                'Verify & Sign In'
              ) : (
                'Send Admin Login OTP'
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

