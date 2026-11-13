"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useAuth } from "../context/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import logo from "/logo.png";
import {
  AppleIcon,
  Mail,
  ChevronLeftIcon,
  GithubIcon,
  Loader2,
  KeyRound,
  Fingerprint,
  Sparkles,
  ScanEye,
  EyeOff,
  MailCheck,
} from "lucide-react";
import { cn } from "../lib/utils";

export default function AuthPage() {
  const { login, signUp, googleSignIn } = useAuth();
  const [mode, setMode] = useState("login"); // 'login' | 'signup'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setNotice(null);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await signUp(email, password, name);
        setNotice({
          title: "Confirmation email sent",
          message: "Open the link we sent to your inbox to activate this account.",
        });
      }
    } catch (err) {
      const message = err.message || "An error occurred";
      const needsConfirmation = /email not confirmed|confirmation/i.test(message);
      setNotice({
        title: needsConfirmation ? "Email confirmation needed" : "We could not continue",
        message: needsConfirmation
          ? "Please confirm your email from the link in your inbox, then sign in again."
          : message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setNotice(null);
    try {
      await googleSignIn();
    } catch (err) {
      setNotice({
        title: "Google sign-in did not finish",
        message: err.message || "Please try again in a moment.",
      });
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-[100dvh] lg:h-screen lg:overflow-hidden lg:grid lg:grid-cols-2 bg-background font-sans">
      {/* Left side - Branding & Hero */}
      <div className="bg-muted/10 relative hidden h-full flex-col border-r p-8 lg:flex lg:p-10">
        <div className="from-background absolute inset-0 z-10 bg-gradient-to-t to-transparent opacity-30" />
        <Link to="/" className="z-20 flex items-center gap-4 no-underline">
          <img src={logo} alt="GAP Social-pilot" className="size-8 object-contain" />

          <span
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: "var(--ink)",
              fontFamily: "var(--font-logo)",
              letterSpacing: "-0.03em",
              lineHeight: 0.9,
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--arc)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>GAP</span>
            <span>Social‑pilot</span>
          </span>
        </Link>

        <div className="z-20 mt-auto">
          <blockquote className="space-y-4">
            <p className="text-2xl font-medium leading-relaxed text-ink/90">
              &ldquo;GAP Social-pilot has completely transformed how I handle
              multi-platform content. What used to take hours now takes
              minutes.&rdquo;
            </p>
          </blockquote>
        </div>

        {/* Animated Background Paths */}
        <div className="absolute inset-0 z-0">
          <FloatingPaths position={1} />
          <FloatingPaths position={-1} />
        </div>
      </div>

      {/* Right side - Auth Form */}
      <div className="relative flex min-h-[100dvh] lg:min-h-0 lg:h-full flex-col justify-center px-6 py-6 sm:px-8 sm:py-8 md:p-12 overflow-y-auto lg:overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 isolate contain-strict -z-10 opacity-40 pointer-events-none"
        >
          <div
            className="bg-[radial-gradient(68.54%_68.72%_at_55.02%_31.46%,var(--arc)_0,transparent_70%)] absolute top-0 right-0 h-[600px] w-[600px] -translate-y-1/2 opacity-10 blur-3xl rounded-full"
            style={{ willChange: "transform" }}
          />
        </div>

        {/* Desktop-only back button */}
        <Button
          variant="ghost"
          className="hidden lg:flex absolute top-8 left-8 hover:bg-muted/50"
          onClick={() => navigate("/")}
        >
          <ChevronLeftIcon className="size-4 me-2" />
          Back to Home
        </Button>

        <div className="mx-auto w-full max-w-[400px] flex flex-col space-y-4 sm:space-y-5 lg:space-y-6 my-auto">
          {/* Mobile Header: Logo on left, Back to Home button on right */}
          <div className="flex items-center justify-between w-full lg:hidden pb-1">
            <Link to="/" className="flex items-center gap-2.5 no-underline group shrink-0">
              <div className="bg-ink p-1.5 rounded-lg shadow-sm group-hover:scale-105 transition-transform">
                <img
                  src={logo}
                  alt="GAP Social-pilot"
                  className="size-5 object-contain"
                />
              </div>
              <span
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: "var(--ink)",
                  fontFamily: "var(--font-logo)",
                  letterSpacing: "-0.03em",
                  lineHeight: 0.9,
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--arc)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 1 }}>GAP</span>
                <span>Social‑pilot</span>
              </span>
            </Link>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs font-semibold text-slate hover:text-ink hover:bg-muted/50 h-8 px-2.5 rounded-lg gap-1 shrink-0 -me-1"
              onClick={() => navigate("/")}
            >
              <ChevronLeftIcon className="size-3.5" />
              <span>Back to home</span>
            </Button>
          </div>

          <div className="flex flex-col space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">
              {mode === "login" ? "Welcome back" : "Start broadcasting"}
            </h1>
            <p className="text-slate text-sm">
              {mode === "login"
                ? "Sign in to manage your social channels."
                : "Create your account to start reaching more people."}
            </p>
          </div>

          {/* Auth status */}
          <AnimatePresence mode="wait">
            {notice && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="flex items-start gap-2.5 rounded-lg border border-[var(--dust)] bg-white p-2.5 text-xs text-[var(--ink)]"
              >
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#fff1e8] text-[var(--arc)]">
                  <MailCheck className="size-3.5" />
                </span>
                <span className="min-w-0">
                  <strong className="block text-xs font-semibold text-[var(--ink)]">
                    {notice.title}
                  </strong>
                  <span className="mt-0.5 block leading-normal text-[var(--slate)] text-xs">
                    {notice.message}
                  </span>
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* SSO Buttons */}
          <div className="space-y-2 sm:space-y-2.5">
            {/* GetAiPilot Hub SSO Button */}
            <Button
              type="button"
              size="lg"
              className="w-full h-11 sm:h-12 bg-gradient-to-r from-[#031b4e] to-[#0d3880] text-white hover:opacity-95 hover:shadow-md transition-all duration-300 font-bold shadow-sm flex items-center justify-center gap-2.5 border border-[#031b4e]/20 cursor-pointer text-xs sm:text-sm"
              onClick={() => {
                const hubUrl = "https://getaipilot.in";
                window.location.href = `${hubUrl}/login?sso=social`;
              }}
              disabled={loading}
            >
              <img
                src="https://getaipilot.in/logo.png"
                alt="GetAiPilot Logo"
                className="w-5 h-5 rounded object-contain shrink-0"
                style={{ width: "20px", height: "20px", minWidth: "20px", minHeight: "20px" }}
              />
              <span>Continue with GetAiPilot</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full h-11 sm:h-12 border-muted hover:border-slate-300 hover:bg-white hover:shadow-md transition-all duration-300 font-bold bg-white text-ink shadow-sm flex items-center justify-center gap-2.5 text-xs sm:text-sm"
              onClick={handleGoogleLogin}
              disabled={loading}
            >
              <GoogleIcon className="w-5 h-5 shrink-0" />
              <span>Continue with Google</span>
            </Button>
          </div>

          <AuthSeparator />

          <form className="space-y-2.5 sm:space-y-3" onSubmit={handleSubmit}>
            {mode === "signup" && (
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate ml-1">
                  Full Name
                </label>
                <div className="relative">
                  <Input
                    placeholder="Jane Doe"
                    className="h-11 sm:h-12 ps-10 border-muted focus:border-arc transition-all bg-white text-sm"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <div className="absolute inset-y-0 start-0 flex items-center ps-3.5 pointer-events-none">
                    <Fingerprint className="size-4 text-arc/60" />
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate ml-1">
                Email Address
              </label>
              <div className="relative">
                <Input
                  placeholder="name@example.com"
                  className="h-11 sm:h-12 ps-10 border-muted focus:border-arc transition-all bg-white text-sm"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <div className="absolute inset-y-0 start-0 flex items-center ps-3.5 pointer-events-none">
                  <Mail className="size-4 text-arc/60" />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate ml-1">
                Password
              </label>
              <div className="relative">
                <Input
                  placeholder="••••••••"
                  className="h-11 sm:h-12 ps-10 pe-10 border-muted focus:border-arc transition-all bg-white text-sm"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <div className="absolute inset-y-0 start-0 flex items-center ps-3.5 pointer-events-none">
                  <KeyRound className="size-4 text-arc/60" />
                </div>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 end-0 flex items-center pe-3.5 text-slate hover:text-arc transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <ScanEye className="size-4" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full mx-auto flex h-11 sm:h-12 text-white font-bold transition-all duration-300 hover:brightness-110 shadow-lg border-none text-sm sm:text-base mt-2"
              style={{
                backgroundImage: 'url("/download (2).jpg")',
                backgroundSize: 'cover',
                backgroundPosition: '20% 50%',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                boxShadow: '0 0 20px rgba(255, 255, 255, 0.1), 0 12px 40px rgba(0, 0, 0, 0.3)',
              }}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <>
                  {mode === "login" ? "Sign In" : "Create Account"}
                  <Sparkles className="size-4 ms-2 group-hover:animate-pulse" />
                </>
              )}
            </Button>
          </form>

          {/* Switch Mode Link */}
          <p className="text-center text-xs sm:text-sm text-slate pt-2 pb-2">
            {mode === "login" ? "New here?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
              className="text-arc font-bold hover:underline underline-offset-4"
            >
              {mode === "login" ? "Create an account" : "Sign in instead"}
            </button>
          </p>
        </div>
      </div>
    </main>
  );
}

function FloatingPaths({ position }) {
  const paths = React.useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        id: i,
        d: `M-${380 - i * 15 * position} -${189 + i * 18}C-${
          380 - i * 15 * position
        } -${189 + i * 18} -${312 - i * 15 * position} ${216 - i * 18} ${
          152 - i * 15 * position
        } ${343 - i * 18}C${616 - i * 15 * position} ${470 - i * 18} ${
          684 - i * 15 * position
        } ${875 - i * 18} ${684 - i * 15 * position} ${875 - i * 18}`,
        color: `rgba(255, 86, 0, ${0.3 + i * 0.05})`,
        width: 1.5 + i * 0.1,
        duration: 15 + Math.random() * 10,
      })),
    [position],
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg
        className="h-full w-full opacity-100"
        viewBox="0 0 696 316"
        fill="none"
        style={{ willChange: "transform" }}
      >
        <title>Background Paths</title>
        {paths.map((path) => (
          <motion.path
            key={path.id}
            d={path.d}
            stroke={path.color}
            strokeWidth={path.width}
            initial={{ pathLength: 0.3, opacity: 0 }}
            animate={{
              pathLength: 1,
              opacity: [0, 0.8, 0],
              pathOffset: [0, 1],
            }}
            transition={{
              duration: path.duration,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        ))}
      </svg>
    </div>
  );
}

const GoogleIcon = ({ className }) => (
  <img
    src="/icons/google-icon.svg"
    alt="Google"
    className={cn("w-5 h-5 shrink-0 object-contain", className)}
    style={{ width: "20px", height: "20px", minWidth: "20px", minHeight: "20px" }}
  />
);

const AuthSeparator = () => {
  return (
    <div className="flex w-full items-center justify-center gap-3 my-0.5 sm:my-1">
      <div className="bg-muted h-[1px] w-full" />
      <span className="text-slate px-2 text-[10px] sm:text-xs font-bold uppercase tracking-wider">
        OR
      </span>
      <div className="bg-muted h-[1px] w-full" />
    </div>
  );
};
