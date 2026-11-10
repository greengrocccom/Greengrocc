import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useVendorAuth } from "../../context/VendorAuthContext";
import { useDriverAuth } from "../../context/DriverAuthContext";
import { vendorApi } from "../../api/vendorApi";
import { Eye, EyeOff, Lock, Smartphone, ArrowLeft, Loader2 } from "lucide-react";

export default function VendorLoginPage() {
  const { login: vendorLogin, logout: vendorLogout } = useVendorAuth();
  const { login: driverLogin, logout: driverLogout } = useDriverAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const fromPath = location.state?.from?.pathname || "";

  // mode: "password" | "otp"
  const [mode, setMode] = useState("password");
  // step: "login" | "otp"
  const [step, setStep] = useState("login");
  const [form, setForm] = useState({ mobile: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [otpValue, setOtpValue] = useState("");
  const [otpMsg, setOtpMsg] = useState("");
  const [resendTimer, setResendTimer] = useState(0);
  const [resending, setResending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (resendTimer <= 0) return;
    const timer = setInterval(() => {
      setResendTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendTimer]);

  const handleChange = (e) => {
    setError("");
    const { name } = e.target;
    let { value } = e.target;
    if (name === "mobile") {
      value = value.replace(/\D/g, "");
      if (value.length > 10 && value.startsWith("91")) value = value.slice(-10);
      value = value.slice(0, 10);
    }
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setStep("login");
    setError("");
    setOtpMsg("");
    setOtpValue("");
  };

  const navigateAfterLogin = (vendorOk, driverOk) => {
    const defaultVendorTarget = (() => {
      try {
        const raw = localStorage.getItem("greengrocc_vendor_panel_settings");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.display?.defaultLandingPage) return parsed.display.defaultLandingPage;
        }
      } catch {}
      return "/dashboard";
    })();

    if (vendorOk && !driverOk) {
      driverLogout();
      navigate(
        fromPath.startsWith("/vendor/") || fromPath.startsWith("/dashboard")
          ? fromPath
          : defaultVendorTarget,
        { replace: true }
      );
      return;
    }
    if (driverOk && !vendorOk) {
      vendorLogout();
      navigate(fromPath.startsWith("/driver/") ? fromPath : "/driver", { replace: true });
      return;
    }
    if (vendorOk && driverOk) {
      driverLogout();
      navigate(
        fromPath.startsWith("/vendor/") || fromPath.startsWith("/dashboard")
          ? fromPath
          : defaultVendorTarget,
        { replace: true }
      );
      return;
    }
  };

  // 1. Password Login Handler
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!form.mobile || !form.password) {
      setError("Mobile and password are required");
      return;
    }
    if (!/^\d{10}$/.test(form.mobile)) {
      setError("Enter a valid 10 digit mobile number");
      return;
    }
    setSubmitting(true);
    setError("");
    setOtpMsg("");

    const credentials = { mobile: form.mobile.trim(), password: form.password };
    const [vendorResult, driverResult] = await Promise.allSettled([
      vendorLogin(credentials),
      driverLogin(credentials),
    ]);
    setSubmitting(false);

    const vendorOk = vendorResult.status === "fulfilled" && vendorResult.value?.token;
    const driverOk = driverResult.status === "fulfilled" && driverResult.value?.token;

    if (vendorOk || driverOk) {
      navigateAfterLogin(vendorOk, driverOk);
      return;
    }

    const vendorErr = vendorResult.status === "rejected" ? vendorResult.reason : null;
    const driverErr = driverResult.status === "rejected" ? driverResult.reason : null;
    const isAuthError = (err) => [400, 401, 403].includes(err?.response?.status);
    const authErr = [vendorErr, driverErr].find(isAuthError);
    setError(
      authErr?.response?.data?.message ||
        vendorErr?.response?.data?.message ||
        driverErr?.response?.data?.message ||
        vendorErr?.message ||
        "Invalid mobile or password"
    );
  };

  // 2. Send OTP Handler (For OTP Login)
  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    if (!form.mobile || !/^\d{10}$/.test(form.mobile)) {
      setError("Enter a valid 10 digit mobile number");
      return;
    }
    setSendingOtp(true);
    setError("");
    setOtpMsg("");
    try {
      const res = await vendorApi.sendLoginOtp({ mobile: form.mobile.trim() });
      setStep("otp");
      setOtpValue("");
      setResendTimer(30);
      setOtpMsg(
        res?.data?.code
          ? `Verification OTP sent via GreenGrocc Common OTP (GREGRC_Common_OTP) (Dev code: ${res.data.code})`
          : res?.data?.message || "Verification OTP sent via GreenGrocc Common OTP (GREGRC_Common_OTP)"
      );
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to send OTP. Please check mobile number."
      );
    } finally {
      setSendingOtp(false);
    }
  };

  // 3. Verify OTP Handler (Completes OTP Login)
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const cleanOtp = String(otpValue || "").trim();
    if (!cleanOtp || cleanOtp.length < 4) {
      setError("Please enter the 6-digit OTP");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await vendorLogin({
        mobile: form.mobile.trim(),
        otp: cleanOtp,
      });

      if (res?.token) {
        navigateAfterLogin(true, false);
      }
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Invalid or expired OTP");
    } finally {
      setSubmitting(false);
    }
  };

  // 4. Resend OTP Handler
  const handleResendOtp = async () => {
    if (resendTimer > 0 || resending) return;
    setResending(true);
    setError("");
    setOtpMsg("");
    try {
      const res = await vendorApi.resendLoginOtp({
        mobile: form.mobile.trim(),
      });
      setResendTimer(30);
      setOtpMsg(
        res?.data?.code
          ? `Verification OTP sent via GreenGrocc Common OTP (GREGRC_Common_OTP) (Dev code: ${res.data.code})`
          : res?.data?.message || "Verification OTP sent via GreenGrocc Common OTP (GREGRC_Common_OTP)"
      );
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to resend OTP");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F9FAF9] px-4">
      <div className="w-full max-w-sm border border-[#D4D4D4] bg-white p-8 shadow-sm">
        {/* Brand Header */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center bg-[#217346]">
            <span className="text-xl font-bold text-white">G</span>
          </div>
          <h1 className="text-base font-bold text-[#1F2937]">
            {step === "otp"
              ? "Verify OTP"
              : mode === "otp"
              ? "Login with OTP"
              : "Login with Password"}
          </h1>
          <p className="mt-1 text-xs text-[#6B7280]">
            {step === "otp"
              ? `Verification OTP sent to +91 ${form.mobile}`
              : mode === "otp"
              ? "Enter your mobile number to receive OTP"
              : "Enter your mobile and password to sign in"}
          </p>
        </div>

        {/* Tab switchers: Login with Password vs Login with OTP */}
        {step !== "otp" ? (
          <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg bg-[#F0F3F1] p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => switchMode("password")}
              className={`flex items-center justify-center gap-1.5 rounded-md py-2 transition-all ${
                mode === "password"
                  ? "bg-white text-[#217346] shadow-sm font-bold"
                  : "text-[#6B7280] hover:text-[#1F2937]"
              }`}
            >
              <Lock className="h-3.5 w-3.5" />
              <span>Password</span>
            </button>
            <button
              type="button"
              onClick={() => switchMode("otp")}
              className={`flex items-center justify-center gap-1.5 rounded-md py-2 transition-all ${
                mode === "otp"
                  ? "bg-white text-[#217346] shadow-sm font-bold"
                  : "text-[#6B7280] hover:text-[#1F2937]"
              }`}
            >
              <Smartphone className="h-3.5 w-3.5" />
              <span>OTP</span>
            </button>
          </div>
        ) : null}

        {/* Global Error Banner */}
        {error ? (
          <div className="mb-4 border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
            {error}
          </div>
        ) : null}

        {/* Step: OTP Verification */}
        {step === "otp" ? (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="rounded-lg border border-[#217346]/20 bg-[#217346]/5 p-2.5 text-center">
              <span className="text-[11px] font-medium text-[#217346]">
                Security verification with GreenGrocc Common OTP (GREGRC_Common_OTP)
              </span>
            </div>
            {otpMsg ? (
              <div className="border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                {otpMsg}
              </div>
            ) : null}
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#1F2937]">
                Enter 6-Digit OTP
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otpValue}
                onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="••••••"
                className="w-full border border-[#D4D4D4] px-3 py-2 text-center text-sm font-bold tracking-widest text-[#1F2937] outline-none focus:border-[#217346]"
                autoFocus
                required
              />
            </div>

            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => {
                  setStep("login");
                  setOtpValue("");
                  setError("");
                  setOtpMsg("");
                }}
                className="flex items-center gap-1 text-xs text-[#6B7280] hover:text-[#1F2937] hover:underline"
              >
                <ArrowLeft className="h-3 w-3" />
                <span>Back to Sign In</span>
              </button>
              {resendTimer > 0 ? (
                <span className="text-xs text-[#9CA3AF]">Resend in {resendTimer}s</span>
              ) : (
                <button
                  type="button"
                  disabled={resending}
                  onClick={handleResendOtp}
                  className="font-semibold text-[#217346] hover:underline disabled:opacity-50"
                >
                  {resending ? "Resending…" : "Resend OTP"}
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting || otpValue.length < 4}
              className="flex w-full items-center justify-center gap-1.5 bg-[#217346] py-2 text-xs font-semibold text-white hover:bg-[#1a5c38] disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              <span>{submitting ? "Verifying OTP…" : "Verify & Sign In"}</span>
            </button>
          </form>
        ) : mode === "password" ? (
          /* Mode 1: Login with Password */
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#1F2937]">Mobile Number</label>
              <input
                type="tel"
                name="mobile"
                inputMode="numeric"
                maxLength={10}
                pattern="\d{10}"
                title="10 digit mobile number"
                value={form.mobile}
                onChange={handleChange}
                placeholder="10 digit mobile number"
                className="w-full border border-[#D4D4D4] px-3 py-2 text-xs outline-none focus:border-[#217346]"
                autoComplete="tel-national"
                required
              />
              {form.mobile && form.mobile.length < 10 ? (
                <p className="mt-1 text-[10px] text-[#9CA3AF]">
                  {10 - form.mobile.length} more digit{10 - form.mobile.length === 1 ? "" : "s"}
                </p>
              ) : null}
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="block text-xs font-semibold text-[#1F2937]">Password</label>
                <button
                  type="button"
                  onClick={() => switchMode("otp")}
                  className="text-[11px] text-[#217346] hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="w-full border border-[#D4D4D4] px-3 py-2 pr-9 text-xs outline-none focus:border-[#217346]"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || form.mobile.length !== 10 || !form.password}
              className="flex w-full items-center justify-center gap-1.5 bg-[#217346] py-2 text-xs font-semibold text-white hover:bg-[#1a5c38] disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              <span>{submitting ? "Signing in…" : "Sign In with Password"}</span>
            </button>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => switchMode("otp")}
                className="text-xs text-[#217346] hover:underline"
              >
                Or Login with OTP
              </button>
            </div>
          </form>
        ) : (
          /* Mode 2: Login with OTP (Mobile Input & Send OTP) */
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div className="rounded-lg border border-[#217346]/20 bg-[#217346]/5 p-2.5 text-center">
              <span className="text-[11px] font-medium text-[#217346]">
                Security verification with GreenGrocc Common OTP (GREGRC_Common_OTP)
              </span>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[#1F2937]">Mobile Number</label>
              <input
                type="tel"
                name="mobile"
                inputMode="numeric"
                maxLength={10}
                pattern="\d{10}"
                title="10 digit mobile number"
                value={form.mobile}
                onChange={handleChange}
                placeholder="10 digit mobile number"
                className="w-full border border-[#D4D4D4] px-3 py-2 text-xs outline-none focus:border-[#217346]"
                autoComplete="tel-national"
                autoFocus
                required
              />
              {form.mobile && form.mobile.length < 10 ? (
                <p className="mt-1 text-[10px] text-[#9CA3AF]">
                  {10 - form.mobile.length} more digit{10 - form.mobile.length === 1 ? "" : "s"}
                </p>
              ) : null}
            </div>

            <button
              type="submit"
              disabled={sendingOtp || form.mobile.length !== 10}
              className="flex w-full items-center justify-center gap-1.5 bg-[#217346] py-2 text-xs font-semibold text-white hover:bg-[#1a5c38] disabled:opacity-60"
            >
              {sendingOtp ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              <span>{sendingOtp ? "Sending OTP…" : "Send OTP"}</span>
            </button>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => switchMode("password")}
                className="text-xs text-[#217346] hover:underline"
              >
                Or Login with Password
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
