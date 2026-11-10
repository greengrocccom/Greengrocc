import { Link } from "react-router-dom";
import OptimizedImg from "../common/OptimizedImg";

const AUTH_IMAGES = {
  login: {
    src: "/onboarding-desktop.webp",
    fallback: "/onboarding-desktop.png",
    headline: "Fresh groceries,",
    highlight: "delivered fast",
    sub: "Sign in to track orders, save addresses, and checkout in seconds.",
  },
  signup: {
    src: "/herobaner.png",
    fallback: "/banners/fruits-banner.png",
    headline: "Join GreenGrocc",
    highlight: "today",
    sub: "Shop everyday groceries or register as a bulk buyer for Grade A, B & C pricing.",
  },
};

export default function AuthSplitLayout({ mode = "login", children, wide = false }) {
  const visual = AUTH_IMAGES[mode] || AUTH_IMAGES.login;

  return (
    <div className="h-screen overflow-hidden bg-white text-gray-900">
      <div className="grid h-full lg:grid-cols-2">
        <aside className="relative hidden h-screen overflow-hidden bg-emerald-950 lg:sticky lg:top-0 lg:flex lg:flex-col">
          <OptimizedImg
            src={visual.src}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            onError={(event) => {
              if (event.currentTarget.src.includes(visual.fallback)) return;
              event.currentTarget.src = visual.fallback;
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/25" />

          <div className="relative z-10 flex h-full flex-col justify-between p-10 xl:p-14">
            <Link to="/" className="inline-flex items-center gap-2.5 self-start">
              <OptimizedImg
                src="/greengrocc-logo.png"
                alt="GreenGrocc"
                className="h-10 w-auto rounded-lg bg-white/95 p-1 shadow-sm"
              />
              <span className="text-lg font-bold tracking-tight text-white">GreenGrocc</span>
            </Link>

            <div className="max-w-md">
              <h1 className="text-4xl font-extrabold leading-[1.15] text-white xl:text-[2.75rem]">
                {visual.headline}{" "}
                <span className="text-emerald-300">{visual.highlight}</span>
              </h1>
              <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-white/75">
                {visual.sub}
              </p>
            </div>

            <p className="text-sm text-white/50">Farm-fresh · Fair prices · Fast delivery</p>
          </div>
        </aside>

        <main className="relative flex h-screen flex-col overflow-y-auto overscroll-contain bg-white">
          <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3.5 lg:hidden">
            <Link to="/" className="inline-flex items-center gap-2">
              <OptimizedImg src="/greengrocc-logo.png" alt="GreenGrocc" className="h-8 w-auto" />
              <span className="text-base font-bold text-gray-900">GreenGrocc</span>
            </Link>
            <Link to="/" className="text-sm font-medium text-primary hover:underline">
              Back
            </Link>
          </div>

          <div className="flex flex-1 justify-center px-4 py-6 sm:px-5 sm:py-8 lg:px-6 lg:py-10">
            <div className={`my-auto w-full ${wide ? "max-w-[520px]" : "max-w-[420px]"}`}>
              {children}
            </div>
          </div>

          <div className="hidden shrink-0 px-6 pb-6 lg:block">
            <Link to="/" className="text-sm font-medium text-gray-500 transition hover:text-primary">
              ← Back to shopping
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
}

export function AuthHeader({ eyebrow, title, subtitle }) {
  return (
    <header className="mb-6 border-b border-gray-100 pb-5">
      {eyebrow ? (
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="mt-1.5 text-[1.65rem] font-bold leading-tight tracking-tight text-gray-900 sm:text-[1.85rem]">
        {title}
      </h2>
      {subtitle ? (
        <p className="mt-2 text-[13.5px] leading-relaxed text-gray-500">{subtitle}</p>
      ) : null}
    </header>
  );
}

export function AuthSection({ title, children }) {
  return (
    <section className="space-y-3.5">
      {title ? (
        <div className="flex items-center gap-3">
          <h3 className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">
            {title}
          </h3>
          <div className="h-px flex-1 bg-gray-100" />
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function AuthField({ label, htmlFor, optional, hint, children }) {
  return (
    <div className="min-w-0">
      <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline gap-1.5 text-[13px] font-medium text-gray-700">
        <span>{label}</span>
        {optional ? <span className="text-[11px] font-normal text-gray-400">Optional</span> : null}
      </label>
      {children}
      {hint ? <p className="mt-1 text-[11px] text-gray-400">{hint}</p> : null}
    </div>
  );
}

export const authInputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-[13.5px] text-gray-900 placeholder:text-gray-400 transition focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/10";

export const authPhoneWrapClass =
  "flex overflow-hidden rounded-lg border border-gray-200 bg-white transition focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10";

export function AuthSubmitButton({ submitting, children }) {
  return (
    <button
      type="submit"
      disabled={submitting}
      className="mt-1 flex w-full items-center justify-center rounded-lg bg-primary py-3 text-[14px] font-semibold text-white shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {submitting ? "Please wait..." : children}
    </button>
  );
}

export function AuthFooterLink({ prompt, to, label, state }) {
  return (
    <p className="mt-5 text-center text-[13px] text-gray-500">
      {prompt}{" "}
      <Link to={to} state={state} className="font-semibold text-primary hover:underline">
        {label}
      </Link>
    </p>
  );
}

export function AuthError({ message }) {
  if (!message) return null;
  return (
    <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[13px] text-red-600">
      {message}
    </p>
  );
}
