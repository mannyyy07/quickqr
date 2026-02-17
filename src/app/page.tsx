"use client";

import QRCode from "qrcode";
import { FormEvent, useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";

type EventType = "page_visit" | "qr_generated" | "qr_downloaded";
type ThemeMode = "light" | "dark";

const VALID_PROTOCOLS = new Set(["http:", "https:"]);
const QR_SIZE = 320;
const QR_MARGIN = 2;

function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    if (!VALID_PROTOCOLS.has(parsed.protocol)) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function applyTheme(mode: ThemeMode) {
  document.documentElement.dataset.theme = mode;
  window.localStorage.setItem("quickqr_theme", mode);
}

async function trackEvent(
  eventType: EventType,
  sessionId: string,
  payload: Record<string, string | number | null>,
) {
  try {
    await fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType, sessionId, payload }),
    });
  } catch {
    // UI should continue to work even if analytics fails.
  }
}

export default function Home() {
  const [rawLink, setRawLink] = useState("");
  const [purpose, setPurpose] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [qrPng, setQrPng] = useState("");
  const [qrSvg, setQrSvg] = useState("");
  const [finalUrl, setFinalUrl] = useState("");
  const [theme, setTheme] = useState<ThemeMode>("light");

  useEffect(() => {
    const storedTheme = window.localStorage.getItem("quickqr_theme");
    if (storedTheme === "light" || storedTheme === "dark") {
      setTheme(storedTheme);
      applyTheme(storedTheme);
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const systemTheme: ThemeMode = prefersDark ? "dark" : "light";
      setTheme(systemTheme);
      applyTheme(systemTheme);
    }

    const key = "quickqr_session_id";
    const existing = window.localStorage.getItem(key);
    if (existing) {
      setSessionId(existing);
      void trackEvent("page_visit", existing, {});
      return;
    }

    const nextSessionId = crypto.randomUUID();
    window.localStorage.setItem(key, nextSessionId);
    setSessionId(nextSessionId);
    void trackEvent("page_visit", nextSessionId, {});
  }, []);

  const isReady = useMemo(() => qrPng.length > 0, [qrPng]);

  async function onGenerate(event: FormEvent) {
    event.preventDefault();
    setErrorMessage("");

    const normalized = normalizeUrl(rawLink);
    if (!normalized) {
      setErrorMessage("Enter a valid link. Example: https://example.com");
      return;
    }

    setIsBusy(true);
    try {
      const [pngOutput, svgOutput] = await Promise.all([
        QRCode.toDataURL(normalized, { width: QR_SIZE, margin: QR_MARGIN }),
        QRCode.toString(normalized, { type: "svg", width: QR_SIZE, margin: QR_MARGIN }),
      ]);

      setQrPng(pngOutput);
      setQrSvg(svgOutput);
      setFinalUrl(normalized);

      if (sessionId) {
        await trackEvent("qr_generated", sessionId, {
          destinationUrl: normalized,
          purpose: purpose || null,
          size: QR_SIZE,
          margin: QR_MARGIN,
        });
      }
    } catch {
      setErrorMessage("Could not generate QR code. Try a different URL.");
    } finally {
      setIsBusy(false);
    }
  }

  async function onDownloadPng() {
    if (!qrPng) {
      return;
    }

    const anchor = document.createElement("a");
    anchor.href = qrPng;
    anchor.download = "quickqr.png";
    anchor.click();

    if (sessionId) {
      await trackEvent("qr_downloaded", sessionId, {
        destinationUrl: finalUrl,
        format: "png",
      });
    }
  }

  async function onDownloadSvg() {
    if (!qrSvg) {
      return;
    }

    const blob = new Blob([qrSvg], { type: "image/svg+xml" });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = "quickqr.svg";
    anchor.click();
    URL.revokeObjectURL(objectUrl);

    if (sessionId) {
      await trackEvent("qr_downloaded", sessionId, {
        destinationUrl: finalUrl,
        format: "svg",
      });
    }
  }

  function onClear() {
    setRawLink("");
    setPurpose("");
    setQrPng("");
    setQrSvg("");
    setFinalUrl("");
    setErrorMessage("");
  }

  function toggleTheme() {
    const nextTheme: ThemeMode = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    applyTheme(nextTheme);
  }

  return (
    <main className={styles.page}>
      <button type="button" onClick={toggleTheme} className={styles.themeToggle}>
        <span aria-hidden="true" className={styles.themeIcon}>
          {theme === "light" ? "🌙" : "☀️"}
        </span>
        <span className={styles.srOnly}>
          {theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
        </span>
      </button>

      <section className={styles.heroCard}>
        <p className={styles.badge}>QuickQR</p>
        <h1 className={styles.title}>Turn any link into a QR code in seconds.</h1>
        <p className={styles.subtitle}>
          Paste a URL, generate a sharp QR, and download PNG or SVG.
        </p>

        <form onSubmit={onGenerate} className={styles.form}>
          <label htmlFor="url" className={styles.label}>
            Link
          </label>
          <input
            id="url"
            type="text"
            placeholder="https://your-link.com"
            value={rawLink}
            onChange={(event) => setRawLink(event.target.value)}
            className={styles.input}
            autoComplete="off"
            required
          />

          <label htmlFor="purpose" className={styles.label}>
            Purpose (optional)
          </label>
          <input
            id="purpose"
            type="text"
            placeholder="Campaign, resume, portfolio..."
            value={purpose}
            onChange={(event) => setPurpose(event.target.value)}
            className={styles.input}
            maxLength={80}
            autoComplete="off"
          />

          <button type="submit" className={styles.primaryButton} disabled={isBusy}>
            {isBusy ? "Generating..." : "Generate QR"}
          </button>
        </form>

        {errorMessage && <p className={styles.error}>{errorMessage}</p>}
      </section>

      <section className={styles.previewCard}>
        <div className={styles.previewHeader}>
          <p className={styles.previewTitle}>Preview</p>
          <button
            type="button"
            onClick={onClear}
            disabled={!isReady}
            className={styles.clearButton}
            title="Start new"
          >
            + New
          </button>
        </div>
        <div className={styles.previewShell}>
          {isReady ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrPng} alt="Generated QR code" className={styles.qrImage} />
          ) : (
            <p className={styles.emptyText}>Your QR code will appear here.</p>
          )}
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            onClick={() => void onDownloadPng()}
            disabled={!isReady}
            className={styles.secondaryButton}
          >
            Download PNG
          </button>
          <button
            type="button"
            onClick={() => void onDownloadSvg()}
            disabled={!isReady}
            className={styles.secondaryButton}
          >
            Download SVG
          </button>
        </div>
      </section>

      <footer className={styles.footer}>Made with <span aria-hidden="true">❤</span> by Manny</footer>
    </main>
  );
}
