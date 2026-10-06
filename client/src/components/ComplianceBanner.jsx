import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useLocation } from 'react-router-dom';

const STORAGE_KEY = 'gap_privacy_pref';

export default function ComplianceBanner() {
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [prefs, setPrefs] = useState({ analytics: true, marketing: false });
  const reduceMotion = useReducedMotion();
  const location = useLocation();

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      const t = setTimeout(() => setVisible(true), 1200);
      return () => clearTimeout(t);
    }
  }, []);

  const save = (choice) => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        decision: choice,
        analytics: choice === 'all' ? true : choice === 'decline' ? false : prefs.analytics,
        marketing: choice === 'all' ? true : choice === 'decline' ? false : prefs.marketing,
        timestamp: Date.now(),
      }),
    );
    setVisible(false);
  };

  if (location.pathname === '/privacy') {
    return null;
  }

  return (
    <AnimatePresence>
      {visible && (
        <>
          <style>{bannerCss}</style>
          <motion.div
            className="privacy-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.aside
            aria-label="Privacy preferences"
            className="privacy-banner"
            initial={{ y: reduceMotion ? 0 : 18, scale: reduceMotion ? 1 : 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: reduceMotion ? 0 : 14, scale: reduceMotion ? 1 : 0.98, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="privacy-card">
              <div className="privacy-mark" aria-hidden="true">
                <CookieIcon />
              </div>

              <div className="privacy-content">
                <div className="privacy-copy">
                  <h3>Choose your cookies</h3>
                  <p>
                    Cookies help us improve your experience, tailor content, and measure how QuickPost is used.
                    <button type="button" className="privacy-link-button" onClick={() => setShowDetails((d) => !d)}>
                      {showDetails ? 'Hide settings' : 'Learn more and manage'}
                    </button>
                  </p>
                </div>

                <AnimatePresence initial={false}>
                  {showDetails && (
                    <motion.div
                      className="privacy-details"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18 }}
                    >
                      <PreferenceRow
                        label="Essential"
                        desc="Required for login, security, and core site features."
                        checked
                        disabled
                      />
                      <PreferenceRow
                        label="Analytics"
                        desc="Helps us understand product usage and improve workflows."
                        checked={prefs.analytics}
                        onChange={(v) => setPrefs((p) => ({ ...p, analytics: v }))}
                      />
                      <PreferenceRow
                        label="Marketing"
                        desc="Used for relevant product updates and campaigns."
                        checked={prefs.marketing}
                        onChange={(v) => setPrefs((p) => ({ ...p, marketing: v }))}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="privacy-actions">
                  <button type="button" className="privacy-button privacy-button-primary" onClick={() => save('all')}>
                    Accept all
                  </button>
                  <button type="button" className="privacy-button privacy-button-secondary" onClick={() => save('decline')}>
                    Reject non-essential cookies
                  </button>
                  {showDetails && (
                    <button type="button" className="privacy-button privacy-button-soft" onClick={() => save('custom')}>
                      Save preferences
                    </button>
                  )}
                  <a href="/privacy" target="_blank" rel="noopener noreferrer" className="privacy-policy">
                    Privacy Policy
                  </a>
                </div>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function CookieIcon() {
  return (
    <svg viewBox="0 0 120 104" role="img" aria-label="Cookie illustration">
      <path
        d="M100.7 47.2c8.6 27.4-12.2 51.7-40.5 51.7-26.3 0-47.6-19.6-47.6-43.8 0-20.7 15.6-38.1 36.5-42.7 3.2 12.7 15.1 20.3 28.2 17 3.1 9.6 11.4 16.2 23.4 17.8Z"
        fill="#D8902F"
      />
      <path
        d="M95.4 46.1c7.1 24-11.3 45.7-36 45.7-23 0-41.7-16.8-41.7-37.5 0-17.3 13.1-32.1 30.9-36.3 4.2 11.2 15.5 17.4 27.9 13.8 3.6 7.8 10.1 12.7 18.9 14.3Z"
        fill="#F4B94F"
      />
      <path d="M49 18c2 5.8 5.9 10 11.1 12.3-8.4 2-17.8-1.4-22.7-8.2A38 38 0 0 1 49 18Z" fill="#FFD27A" opacity=".78" />
      <path d="M36.5 43.8c5-1.2 9.5 2 10.6 6.8.8 3.5-1.8 5.5-5.2 4.4-3.5-1.1-5.3.5-7.6 2.1-2.9 2.1-6 .7-6.2-2.8-.3-4.5 3.4-9.2 8.4-10.5Z" fill="#6E431F" />
      <path d="M70.7 65.5c4.8-1.2 8.9 1.6 9.6 5.6.5 3.3-2.1 5.2-5.1 4-3.1-1.2-4.9.1-7.2 1.7-2.6 1.8-5.5.5-5.6-2.6-.1-3.8 3.5-7.6 8.3-8.7Z" fill="#6E431F" />
      <path d="M66.8 40.6c3.6-.9 6.9 1.3 7.6 4.3.5 2.4-1.5 3.9-3.8 3-2.4-.8-3.8.2-5.5 1.3-2 1.4-4.1.4-4.2-1.9-.1-2.8 2.3-5.9 5.9-6.7Z" fill="#6E431F" />
      <path d="M54.7 73.5h.1M86.7 54.6h.1M43.4 68.8h.1" stroke="#D8902F" strokeWidth="6" strokeLinecap="round" />
      <path d="M25 15.9 17 18.2M35.8 7.2l-3.5 6M21.5 28.5l-6.4 2.9" stroke="#E9A93C" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

function PreferenceRow({ label, desc, checked, onChange, disabled }) {
  return (
    <div className="preference-row">
      <div>
        <p className="preference-label">{label}</p>
        <p className="preference-desc">{desc}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={`${label} cookies`}
        className="preference-switch"
        disabled={disabled}
        onClick={() => !disabled && onChange?.(!checked)}
      >
        <span />
      </button>
    </div>
  );
}

export function getCompliancePreference() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

const bannerCss = `
.privacy-backdrop {
  position: fixed;
  inset: 0;
  z-index: var(--z-overlay, 400);
  background: rgba(17, 17, 17, 0.34);
  backdrop-filter: blur(2px);
  pointer-events: auto;
}

.privacy-banner {
  position: fixed;
  inset: 0;
  z-index: var(--z-toast, 600);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  pointer-events: none;
}

.privacy-card {
  display: grid;
  gap: 12px;
  width: min(392px, 100%);
  padding: 22px 24px;
  border: 1px solid rgba(20, 20, 19, 0.08);
  border-radius: 16px;
  background: var(--canvas-lifted);
  color: var(--ink);
  font-family: var(--font-body);
  text-align: center;
  pointer-events: auto;
}

.privacy-mark {
  display: flex;
  width: 76px;
  height: 62px;
  align-items: center;
  justify-content: center;
  justify-self: center;
  margin-bottom: 2px;
}

.privacy-mark svg {
  width: 76px;
  height: 66px;
}

.privacy-copy h3 {
  margin: 0;
  color: var(--ink);
  font-size: 24px;
  font-weight: 760;
  line-height: 1.08;
  letter-spacing: -0.02em;
}

.privacy-copy p {
  margin: 10px auto 0;
  max-width: 36ch;
  color: #222220;
  font-size: 14.5px;
  font-weight: 450;
  line-height: 1.48;
  text-wrap: pretty;
}

.privacy-link-button {
  display: inline;
  margin-left: 0;
  padding: 0;
  border: 0;
  border-bottom: 1px solid currentColor;
  background: transparent;
  color: #222220;
  cursor: pointer;
  font: inherit;
  font-weight: 500;
}

.privacy-details {
  display: grid;
  gap: 10px;
  overflow: hidden;
  margin-top: 12px;
  padding: 12px;
  border: 1px solid rgba(20, 20, 19, 0.08);
  border-radius: 10px;
  background: var(--canvas);
  text-align: left;
}

.preference-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.preference-label {
  margin: 0;
  color: var(--ink);
  font-size: 13px;
  font-weight: 650;
  line-height: 1.25;
}

.preference-desc {
  margin: 2px 0 0;
  color: var(--slate);
  font-size: 12px;
  line-height: 1.4;
}

.preference-switch {
  position: relative;
  flex: 0 0 auto;
  width: 42px;
  height: 24px;
  padding: 2px;
  border: 1px solid rgba(20, 20, 19, 0.12);
  border-radius: var(--r-pill, 9999px);
  background: #d8d4cf;
  cursor: pointer;
  transition: background 160ms ease, border-color 160ms ease;
}

.preference-switch[aria-checked="true"] {
  border-color: var(--ink);
  background: var(--ink);
}

.preference-switch:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

.preference-switch span {
  display: block;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  transition: transform 160ms ease;
}

.preference-switch[aria-checked="true"] span {
  transform: translateX(18px);
}

.privacy-actions {
  display: grid;
  gap: 9px;
  margin-top: 18px;
}

.privacy-policy {
  color: var(--slate);
  font-size: 12px;
  font-weight: 650;
  text-align: center;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.privacy-button {
  min-height: 44px;
  width: 100%;
  padding: 11px 16px;
  border-radius: 999px;
  cursor: pointer;
  font-size: 14.5px;
  font-weight: 700;
  line-height: 1;
  transition: background 160ms ease, border-color 160ms ease, color 160ms ease;
  white-space: nowrap;
}

.privacy-button-secondary {
  border: 1.5px solid var(--ink);
  background: #f7f7ff;
  color: var(--ink);
}

.privacy-button-secondary:hover {
  border-color: var(--ink);
}

.privacy-button-soft {
  border: 1px solid rgba(255, 86, 0, 0.22);
  background: var(--color-arc-050, rgba(255, 86, 0, 0.05));
  color: var(--signal, #e84f00);
}

.privacy-button-primary {
  border: 1.5px solid var(--ink);
  background: #171c1f;
  color: #fff;
}

.privacy-button-primary:hover {
  background: #000;
  border-color: #000;
}

.privacy-link-button:focus-visible,
.privacy-policy:focus-visible,
.privacy-button:focus-visible,
.preference-switch:focus-visible {
  outline: 2px solid var(--ink);
  outline-offset: 2px;
}

@media (max-width: 640px) {
  .privacy-banner {
    align-items: flex-end;
    padding: 12px;
  }

  .privacy-card {
    padding: 20px;
    border-radius: 16px;
  }

  .privacy-mark {
    width: 68px;
    height: 56px;
  }

  .privacy-mark svg {
    width: 68px;
    height: 60px;
  }

  .privacy-copy h3 {
    font-size: 22px;
  }

  .privacy-copy p {
    font-size: 14px;
  }

  .privacy-button {
    min-height: 44px;
    font-size: 14px;
  }
}
`;
