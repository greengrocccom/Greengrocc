import React, { useState, useEffect } from 'react';
import {
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Send,
  RefreshCw,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import apiClient from '../api/client';
import { BTN, BTN_PRIMARY, INPUT, PAGE_KICKER, PAGE_SUB, PAGE_TITLE, PANEL } from '../utils/ui';
import { getAdminTheme, setAdminTheme } from '../utils/adminTheme';

export default function Settings() {
  const [theme, setTheme] = useState(getAdminTheme);
  // OTP flow state
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [phoneHint, setPhoneHint] = useState('');
  const [devOtpHint, setDevOtpHint] = useState('');

  // Password fields state (Opens only after OTP is entered and verified)
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Form submission state
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Resend cooldown timer
  useEffect(() => {
    if (resendTimer <= 0) return;
    const interval = setInterval(() => {
      setResendTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  // Load registered phone hint on mount
  useEffect(() => {
    async function loadPhoneHint() {
      try {
        const res = await apiClient.get('/users/me');
        if (res.data?.success && res.data?.data?.phone) {
          const digits = String(res.data.data.phone);
          setPhoneHint(`******${digits.slice(-4)}`);
        }
      } catch {}
    }
    loadPhoneHint();
  }, []);

  // Step 1: Send Common OTP
  const handleSendOtp = async () => {
    if (sendingOtp || resendTimer > 0) return;

    setSendingOtp(true);
    setErrorMsg('');
    setSuccessMsg('');
    setDevOtpHint('');
    setOtpVerified(false);

    try {
      const res = await apiClient.post('/users/me/security-otp');
      if (res.data?.success) {
        setOtpSent(true);
        setResendTimer(60);
        if (res.data?.data?.phoneHint) {
          setPhoneHint(res.data.data.phoneHint);
        }
        if (res.data?.data?.devOtp) {
          setDevOtpHint(String(res.data.data.devOtp));
        }
        setSuccessMsg(
          res.data?.message || 'GreenGrocc Common OTP नोंदणीकृत मोबाइलवर पाठवला आहे.'
        );
      } else {
        setErrorMsg(res.data?.message || 'OTP पाठवणे अयशस्वी झाले.');
      }
    } catch (err) {
      setErrorMsg(
        err.response?.data?.message || 'OTP पाठवता आला नाही. सर्व्हर कनेक्शन तपासा.'
      );
    } finally {
      setSendingOtp(false);
    }
  };

  // Step 2: Verify OTP to open password options
  const handleVerifyOtp = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const cleanOtp = String(otp || '').trim();

    if (!cleanOtp) {
      setErrorMsg('कृपया 6-अंकी OTP टाका.');
      return;
    }

    if (cleanOtp.length !== 6) {
      setErrorMsg('कृपया संपूर्ण 6-अंकी OTP टाका.');
      return;
    }

    setVerifyingOtp(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await apiClient.post('/users/me/security-otp/verify', { otp: cleanOtp });
      if (res.data?.success) {
        setOtpVerified(true);
        setSuccessMsg('OTP सत्यापित झाला! आता तुम्ही नवीन पासवर्ड टाकू शकता.');
      } else {
        setErrorMsg(res.data?.message || 'अवैध OTP.');
      }
    } catch (err) {
      setErrorMsg(
        err.response?.data?.message || 'अवैध किंवा कालबाह्य OTP. योग्य OTP टाका.'
      );
    } finally {
      setVerifyingOtp(false);
    }
  };

  // Step 3: Update Password
  const handleSubmitPassword = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanPassword = String(newPassword || '').trim();
    const cleanConfirm = String(confirmPassword || '').trim();

    if (!otpVerified) {
      setErrorMsg('कृपया प्रथम OTP सत्यापित (Verify) करा.');
      return;
    }

    if (!cleanPassword) {
      setErrorMsg('नवीन पासवर्ड टाकणे आवश्यक आहे.');
      return;
    }

    if (cleanPassword.length < 6) {
      setErrorMsg('नवीन पासवर्ड किमान 6 वर्णांचा (characters) असणे आवश्यक आहे.');
      return;
    }

    if (cleanPassword !== cleanConfirm) {
      setErrorMsg('नवीन पासवर्ड आणि कन्फर्म नवीन पासवर्ड जुळत नाहीत.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiClient.patch('/users/me/password', {
        newPassword: cleanPassword,
        otp: String(otp || '').trim(),
      });

      if (res.data?.success) {
        setSuccessMsg('पासवर्ड यशस्वीरित्या बदलला आहे! (Password updated successfully).');
        setNewPassword('');
        setConfirmPassword('');
        setOtp('');
        setOtpSent(false);
        setOtpVerified(false);
        setDevOtpHint('');
        setResendTimer(0);
      } else {
        setErrorMsg(res.data?.message || 'Password change failed.');
      }
    } catch (err) {
      setErrorMsg(
        err.response?.data?.message ||
          'पासवर्ड अपडेट अयशस्वी. योग्य OTP शिवाय पासवर्ड बदलला जाणार नाही.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-12">
      {/* Header */}
      <div>
        <p className={PAGE_KICKER}>Admin Settings</p>
        <h1 className={PAGE_TITLE}>Settings</h1>
      </div>

      <section className={`${PANEL} flex flex-wrap items-center justify-between gap-3 p-4`} aria-labelledby="appearance-title">
        <div>
          <h2 id="appearance-title" className="text-sm font-semibold text-slate-900">Appearance</h2>
          <p className={PAGE_SUB}>Choose how the admin panel looks on this device.</p>
        </div>
        <div>
          <label htmlFor="admin-theme" className="sr-only">Color theme</label>
          <select id="admin-theme" className={INPUT} value={theme} onChange={(event) => setTheme(setAdminTheme(event.target.value))}>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
      </section>

      <div>
        <h2 className="text-sm font-semibold text-slate-900">पासवर्ड बदला / Change Password</h2>
        <p className={PAGE_SUB}>
          Common OTP वापरून सुरक्षितपणे ॲडमिन पासवर्ड अपडेट करा.
        </p>
      </div>

      {/* Main Form Card */}
      <div className={`${PANEL} p-6 sm:p-8`}>
        {/* Error Alert */}
        {errorMsg && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
            <div className="flex-1 font-medium">{errorMsg}</div>
          </div>
        )}

        {/* Success Alert */}
        {successMsg && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            <div className="flex-1 font-medium">{successMsg}</div>
          </div>
        )}

        {/* Dev OTP Hint */}
        {devOtpHint && (
          <div className="mb-5 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <span className="font-semibold">Dev Mode OTP:</span>
            <span className="rounded bg-amber-200 px-2 py-0.5 font-mono text-sm font-bold text-amber-950">
              {devOtpHint}
            </span>
          </div>
        )}

        <div className="space-y-6">
          {/* Send Common OTP Option */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="block text-sm font-bold text-slate-800">
                  Send Common OTP
                </span>
                <span className="text-xs text-slate-500">
                  {phoneHint
                    ? `नोंदणीकृत फोन (${phoneHint}) वर OTP पाठवला जाईल`
                    : 'ॲडमिनच्या नोंदणीकृत मोबाइल नंबरवर Common OTP पाठवला जाईल'}
                </span>
              </div>

              <button
                type="button"
                onClick={handleSendOtp}
                disabled={sendingOtp || resendTimer > 0}
                className={`${
                  otpSent ? BTN : BTN_PRIMARY
                } h-10 gap-2 px-4 text-xs font-semibold whitespace-nowrap`}
              >
                {sendingOtp ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : resendTimer > 0 ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Resend OTP ({resendTimer}s)</span>
                  </>
                ) : otpSent ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Resend Common OTP</span>
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    <span>Send Common OTP</span>
                  </>
                )}
              </button>
            </div>

            {/* OTP Input Field (Shown once OTP is sent) */}
            {otpSent && !otpVerified && (
              <div className="mt-4 border-t border-slate-200 pt-3">
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  OTP टाका <span className="text-rose-500">*</span>
                </label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    type="text"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="6-अंकी OTP टाका"
                    className={`${INPUT} max-w-xs font-mono text-base font-bold tracking-widest`}
                  />
                  <button
                    type="button"
                    onClick={handleVerifyOtp}
                    disabled={verifyingOtp || otp.trim().length !== 6}
                    className={`${BTN_PRIMARY} h-10 px-5 text-xs font-bold whitespace-nowrap`}
                  >
                    {verifyingOtp ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>सत्यापित करत आहे...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="h-4 w-4" />
                        <span>Verify OTP</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* OTP Verified Confirmation Badge */}
            {otpVerified && (
              <div className="mt-3 flex items-center gap-2 text-xs font-bold text-emerald-700">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>Common OTP सत्यापित झाला (Verified)</span>
              </div>
            )}
          </div>

          {/* OTP टाकल्यानंतरच हे ऑप्शन्स ओपन होतील (Opens only after OTP is entered & verified) */}
          {otpVerified && (
            <form onSubmit={handleSubmitPassword} className="space-y-5 animate-in fade-in duration-300">
              {/* नवीन पासवर्ड (New Password) * */}
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  नवीन पासवर्ड (New Password) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="नवीन पासवर्ड टाका (किमान 6 वर्ण)"
                    className={`${INPUT} pr-10`}
                    required
                    minLength={6}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    tabIndex={-1}
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* कन्फर्म नवीन पासवर्ड (Confirm New Password) * */}
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  कन्फर्म नवीन पासवर्ड (Confirm New Password) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="पुन्हा पासवर्ड टाका"
                    className={`${INPUT} pr-10`}
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className={`${BTN_PRIMARY} w-full gap-2 py-3 text-sm font-bold shadow-md`}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>पासवर्ड अपडेट करत आहे...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4" />
                      <span>पासवर्ड बदला (Change Password)</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
