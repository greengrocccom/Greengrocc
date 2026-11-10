import React, { useState, useEffect, useRef } from "react";
import { Link, Navigate, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api, { sendOtpLogin, resendOtpLogin, verifyOtpLogin, completeOtpSignup } from "../api/api";
import toast from "react-hot-toast";
import OptimizedImg from "../components/common/OptimizedImg";

const PHONE_PATTERN = /^[6789]\d{9}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GST_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

const ACCOUNT_TYPES = [
  { id: "retail", title: "Retail", desc: "Everyday shopping" },
  { id: "bulk", title: "Bulk / Business", desc: "Grade A, B & C pricing" },
];

const fieldWrapClass =
  "relative flex items-center rounded-2xl border border-gray-200 bg-gray-50/50 px-3.5 py-2.5 focus-within:bg-white focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-500/10 transition-all";
const fieldInputClass =
  "w-full bg-transparent text-[13.5px] text-gray-900 placeholder:text-gray-400 focus:outline-none";

export default function Signup() {
  const { signupWithOtp, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // "form" | "otp"
  const [step, setStep] = useState("form");
  const [accountType, setAccountType] = useState(() =>
    new URLSearchParams(location.search).get("type") === "bulk" ? "bulk" : "retail"
  );
  const [shopName, setShopName] = useState("");
  const [shopAddress, setShopAddress] = useState("");
  const [ownerContact, setOwnerContact] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const isBulk = accountType === "bulk";
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(true);

  // OTP verification states
  const [otp, setOtp] = useState("");
  const [timer, setTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);

  // Status states
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const otpInputRef = useRef(null);
  const timerRef = useRef(null);
  const redirectTo = location.state?.from || "/";

  // Countdown timer for OTP
  useEffect(() => {
    if (step === "otp" && timer > 0) {
      timerRef.current = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [step, timer]);

  // Escape key closes modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleClose = () => {
    if (location.state?.from && location.state.from !== "/login" && location.state.from !== "/signup") {
      navigate(location.state.from);
    } else {
      navigate("/");
    }
  };

  if (user) {
    return <Navigate to={redirectTo} replace />;
  }

  // --- Step 1: Send Registration OTP ---
  const handleSendRegistrationOtp = async (e) => {
    e.preventDefault();
    setError("");

    if (!name.trim() || name.trim().length < 2) {
      setError("Please enter your full name (at least 2 characters)");
      return;
    }

    const cleanPhone = phone.trim().replace(/\D/g, "").slice(-10);
    if (!PHONE_PATTERN.test(cleanPhone)) {
      setError("Phone number must be 10 digits starting with 6, 7, 8, or 9");
      return;
    }

    if (email.trim() && !EMAIL_PATTERN.test(email.trim())) {
      setError("Please enter a valid email address");
      return;
    }

    if (password.trim() && password.trim().length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (isBulk) {
      if (shopName.trim().length < 2) {
        setError("Please enter your business name (at least 2 characters)");
        return;
      }
      if (shopAddress.trim().length < 5) {
        setError("Please enter your complete business address");
        return;
      }
      const cleanOwner = (ownerContact.trim() || cleanPhone).replace(/\D/g, "").slice(-10);
      if (!PHONE_PATTERN.test(cleanOwner)) {
        setError("Owner contact must be 10 digits starting with 6, 7, 8, or 9");
        return;
      }
      const gst = gstNumber.trim().toUpperCase();
      if (gst && !GST_PATTERN.test(gst)) {
        setError("Please enter a valid 15-character GST number");
        return;
      }
    }

    if (!agreedToTerms) {
      setError("Please agree to the Terms & Conditions and Privacy Policy");
      return;
    }

    setSubmitting(true);
    try {
      // Uses MSG91 template: GreenGrocc Customer Registration OTP (template 4)
      const res = await sendOtpLogin({ phone: cleanPhone, purpose: "signup" });
      setStep("otp");
      setTimer(30);
      setCanResend(false);
      setOtp("");
      toast.success(res.data?.message || "Registration OTP sent to your phone");
      setTimeout(() => otpInputRef.current?.focus(), 150);
    } catch (err) {
      setError(
        err.response?.data?.message || err.message || "Failed to send registration OTP. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  // --- Resend Registration OTP ---
  const handleResendRegistrationOtp = async () => {
    if (!canResend) return;
    setError("");
    const cleanPhone = phone.trim().replace(/\D/g, "").slice(-10);

    setSubmitting(true);
    try {
      // Uses MSG91 template 4
      const res = await resendOtpLogin({ phone: cleanPhone, purpose: "signup" });
      setTimer(30);
      setCanResend(false);
      toast.success(res.data?.message || "New registration OTP sent");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to resend OTP");
    } finally {
      setSubmitting(false);
    }
  };

  // --- Step 2: Verify OTP & Complete Signup ---
  const handleVerifyAndCompleteSignup = async (e) => {
    e.preventDefault();
    setError("");
    const cleanPhone = phone.trim().replace(/\D/g, "").slice(-10);
    const cleanOtp = otp.trim().replace(/\D/g, "");

    if (cleanOtp.length < 4 || cleanOtp.length > 6) {
      setError("Please enter the 6-digit OTP code");
      return;
    }

    setSubmitting(true);
    try {
      // 1. Verify OTP with backend
      const verifyRes = await verifyOtpLogin({ phone: cleanPhone, otp: cleanOtp });
      if (!verifyRes.data?.success) {
        throw new Error(verifyRes.data?.message || "Invalid OTP");
      }

      // 2. Complete signup registration
      const payload = {
        name: name.trim(),
        phone: cleanPhone,
        accountType,
        ...(email.trim() ? { email: email.trim().toLowerCase() } : {}),
        ...(password.trim() ? { password: password.trim() } : {}),
        ...(isBulk
          ? {
              shopName: shopName.trim(),
              shopAddress: shopAddress.trim(),
              ownerContact: (ownerContact.trim() || cleanPhone).replace(/\D/g, "").slice(-10),
              ...(gstNumber.trim() ? { gstNumber: gstNumber.trim().toUpperCase() } : {}),
            }
          : {}),
      };

      await signupWithOtp(payload);
      toast.success(isBulk ? "Business account created successfully!" : "Account created successfully!");
      navigate("/location", { replace: true, state: { returnTo: redirectTo } });
    } catch (err) {
      setError(
        err.response?.data?.message || err.message || "Failed to verify OTP or complete signup. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-5 bg-black/50 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
    >
      {/* Modal Box: Clean, Responsive Popup (Zero Images, Proper Only Form) */}
      <div
        className="relative my-auto w-full max-w-[420px] bg-white rounded-3xl shadow-2xl p-5 sm:p-7 z-[121] max-h-[94vh] overflow-y-auto flex flex-col justify-between animate-in zoom-in-95 duration-200 select-none border border-gray-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button (X) */}
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all cursor-pointer z-30"
          aria-label="Close Modal"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Top Header Section: Logo + Tab Switcher */}
        <div className="flex flex-col items-center text-center">
          {/* Brand Logo */}
          <Link to="/" onClick={handleClose} className="inline-block transition-transform active:scale-98">
            <OptimizedImg
              src="/assets/payment/logo.png"
              alt="GreenGrocc Logo"
              className="h-10 sm:h-11 w-auto object-contain mx-auto"
            />
          </Link>

          {/* Navigation Tab Switcher: Sign In / Sign Up */}
          <div className="flex items-center justify-center mt-3 mb-1.5 w-full">
            <div className="inline-flex p-1 rounded-full border border-gray-200 bg-gray-50/90 w-full max-w-[260px]">
              <Link
                to="/login"
                className="flex-1 py-1.5 text-center text-xs font-bold rounded-full text-gray-600 hover:text-gray-900 transition-all"
              >
                Sign In
              </Link>
              <Link
                to="/signup"
                className="flex-1 py-1.5 text-center text-xs font-bold rounded-full bg-[#075e34] text-white shadow-xs transition-all"
              >
                Sign Up
              </Link>
            </div>
          </div>

          {/* Heading */}
          <h2 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight mt-1">
            {step === "otp" ? "Verify Registration OTP" : isBulk ? "Business Registration" : "Create Account"}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5 max-w-xs mx-auto leading-relaxed">
            {step === "otp"
              ? `Enter 6-digit verification code sent to +91 ${phone}`
              : isBulk
                ? "Register your shop, hotel or business for bulk Grade A, B & C pricing"
                : "Join GreenGrocc for fresh farm produce delivered fast"}
          </p>
        </div>

        {/* Center Form Section (Proper Only Form, Zero Images) */}
        <div className="my-auto py-2.5 w-full">
          {error && (
            <div className="mb-2.5 p-2 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-600 font-medium">
              {error}
              {error.includes("already exists") && (
                <Link to="/login" className="block mt-1 font-bold text-emerald-800 underline">
                  Click here to Sign In
                </Link>
              )}
            </div>
          )}

          {step === "form" ? (
            // --- Step 1: Customer Registration Details ---
            <form onSubmit={handleSendRegistrationOtp} className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Account type">
                {ACCOUNT_TYPES.map((type) => {
                  const active = accountType === type.id;
                  return (
                    <button
                      key={type.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => {
                        setAccountType(type.id);
                        setError("");
                      }}
                      className={`rounded-2xl border px-3 py-2 text-left transition-all cursor-pointer ${
                        active
                          ? "border-[#075e34] bg-emerald-50 ring-2 ring-emerald-500/15"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <span className={`block text-[13px] font-bold ${active ? "text-[#075e34]" : "text-gray-800"}`}>
                        {type.title}
                      </span>
                      <span className="block text-[11px] text-gray-500">{type.desc}</span>
                    </button>
                  );
                })}
              </div>

              {/* Full Name */}
              <div className="relative flex items-center rounded-2xl border border-gray-200 bg-gray-50/50 px-3.5 py-2.5 focus-within:bg-white focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-500/10 transition-all">
                <svg className="w-4.5 h-4.5 text-gray-400 mr-2.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setError("");
                  }}
                  placeholder={isBulk ? "Owner Full Name" : "Full Name"}
                  className="w-full bg-transparent text-[13.5px] text-gray-900 placeholder:text-gray-400 focus:outline-none"
                  autoComplete="name"
                  required
                />
              </div>

              {/* Phone Number */}
              <div className="relative flex items-center rounded-2xl border border-gray-200 bg-gray-50/50 px-3.5 py-2.5 focus-within:bg-white focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-500/10 transition-all">
                <span className="text-[13.5px] font-bold text-gray-600 mr-2 border-r border-gray-200 pr-2">
                  +91
                </span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value.replace(/\D/g, "").slice(0, 10));
                    setError("");
                  }}
                  placeholder="10-digit mobile number"
                  maxLength={10}
                  className="w-full bg-transparent text-[13.5px] text-gray-900 placeholder:text-gray-400 focus:outline-none font-medium"
                  autoComplete="tel"
                  required
                />
              </div>

              {isBulk && (
                <>
                  <div className={fieldWrapClass}>
                    <input
                      type="text"
                      value={shopName}
                      onChange={(e) => {
                        setShopName(e.target.value);
                        setError("");
                      }}
                      placeholder="Business / Shop Name"
                      className={fieldInputClass}
                      autoComplete="organization"
                      required
                    />
                  </div>
                  <div className={fieldWrapClass}>
                    <input
                      type="text"
                      value={shopAddress}
                      onChange={(e) => {
                        setShopAddress(e.target.value);
                        setError("");
                      }}
                      placeholder="Business Address (area, city, pincode)"
                      className={fieldInputClass}
                      autoComplete="street-address"
                      required
                    />
                  </div>
                  <div className={fieldWrapClass}>
                    <span className="text-[13.5px] font-bold text-gray-600 mr-2 border-r border-gray-200 pr-2">
                      +91
                    </span>
                    <input
                      type="tel"
                      value={ownerContact}
                      onChange={(e) => {
                        setOwnerContact(e.target.value.replace(/\D/g, "").slice(0, 10));
                        setError("");
                      }}
                      placeholder="Owner contact (same as mobile if blank)"
                      maxLength={10}
                      className={`${fieldInputClass} font-medium`}
                    />
                  </div>
                  <div className={fieldWrapClass}>
                    <input
                      type="text"
                      value={gstNumber}
                      onChange={(e) => {
                        setGstNumber(e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 15));
                        setError("");
                      }}
                      placeholder="GST Number (optional)"
                      maxLength={15}
                      className={`${fieldInputClass} tracking-wide`}
                    />
                  </div>
                </>
              )}

              {/* Email Address (optional) */}
              <div className="relative flex items-center rounded-2xl border border-gray-200 bg-gray-50/50 px-3.5 py-2.5 focus-within:bg-white focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-500/10 transition-all">
                <svg className="w-4.5 h-4.5 text-gray-400 mr-2.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError("");
                  }}
                  placeholder="Email Address (optional)"
                  className="w-full bg-transparent text-[13.5px] text-gray-900 placeholder:text-gray-400 focus:outline-none"
                  autoComplete="email"
                />
              </div>

              {/* Password Field (optional password fallback) */}
              <div className="relative flex items-center rounded-2xl border border-gray-200 bg-gray-50/50 px-3.5 py-2.5 focus-within:bg-white focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-500/10 transition-all">
                <svg className="w-4.5 h-4.5 text-gray-400 mr-2.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                  placeholder="Create Password (optional)"
                  className="w-full bg-transparent text-[13.5px] text-gray-900 placeholder:text-gray-400 focus:outline-none pr-2"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1 text-gray-400 hover:text-gray-600 cursor-pointer flex-shrink-0"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Terms & Conditions Checkbox */}
              <label className="flex items-center gap-2 pt-0.5 text-[11.5px] text-gray-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-700 focus:ring-emerald-600 border-gray-300 cursor-pointer flex-shrink-0"
                />
                <span className="truncate">
                  I agree to the{" "}
                  <Link to="/terms" className="font-semibold text-[#075e34] hover:underline">
                    Terms
                  </Link>{" "}
                  &amp;{" "}
                  <Link to="/privacy" className="font-semibold text-[#075e34] hover:underline">
                    Privacy Policy
                  </Link>
                </span>
              </label>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full h-11 bg-[#075e34] hover:bg-[#064e2b] active:scale-[0.98] text-white font-bold text-[14.5px] rounded-full flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-60"
              >
                <span>{submitting ? "Sending OTP..." : "Continue & Verify OTP"}</span>
                {!submitting && (
                  <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                )}
              </button>
            </form>
          ) : (
            // --- Step 2: OTP Verification Screen ---
            <form onSubmit={handleVerifyAndCompleteSignup} className="space-y-3">
              <div className="flex items-center justify-between text-xs text-gray-500 pb-0.5">
                <span>Mobile: <strong className="text-gray-900">+91 {phone}</strong></span>
                <button
                  type="button"
                  onClick={() => {
                    setStep("form");
                    setError("");
                  }}
                  className="font-bold text-[#075e34] hover:underline cursor-pointer"
                >
                  Edit Details
                </button>
              </div>

              <div className="relative flex items-center rounded-2xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 focus-within:bg-white focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-500/10 transition-all">
                <svg className="w-5 h-5 text-gray-400 mr-2.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
                <input
                  ref={otpInputRef}
                  type="text"
                  value={otp}
                  onChange={(e) => {
                    setOtp(e.target.value.replace(/\D/g, "").slice(0, 6));
                    setError("");
                  }}
                  placeholder="Enter 6-digit OTP"
                  maxLength={6}
                  className="w-full bg-transparent text-[16px] tracking-widest text-gray-900 placeholder:text-gray-400 placeholder:tracking-normal focus:outline-none font-bold"
                  autoComplete="one-time-code"
                  required
                />
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500 pt-0.5">
                {timer > 0 ? (
                  <span>Resend code in <strong className="text-gray-800">{timer}s</strong></span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendRegistrationOtp}
                    disabled={submitting}
                    className="font-bold text-[#075e34] hover:underline cursor-pointer"
                  >
                    Resend OTP
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting || otp.length < 4}
                className="w-full h-11 bg-[#075e34] hover:bg-[#064e2b] active:scale-[0.98] text-white font-bold text-[14.5px] rounded-full flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-60"
              >
                <span>{submitting ? "Verifying & Registering..." : "Verify & Complete Registration"}</span>
                {!submitting && (
                  <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Footer Section */}
        <div className="w-full pt-1 pb-0.5">

          {/* Footer Link */}
          <div className="text-center pt-3 pb-0.5 text-[12.5px] text-gray-500">
            Already have an account?{" "}
            <Link to="/login" className="font-bold text-[#075e34] hover:underline">
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
