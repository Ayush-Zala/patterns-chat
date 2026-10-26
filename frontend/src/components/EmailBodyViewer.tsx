'use client';

import React, { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface EmailBodyViewerProps {
  emailId?: string;
  bodyHtml?: string | null;
  bodyText?: string | null;
  snippet?: string | null;
  subject?: string;
}

// Split fresh message content from historical quoted replies
function splitQuotedEmail(raw: string): { fresh: string; quote: string | null } {
  if (!raw) return { fresh: '', quote: null };

  const quoteMarkers = [
    /\r?\n(?=(?:[-_\s]*On\s+[\s\S]+?wrote:\s*))/i,
    /\r?\n(?=-----Original Message-----)/i,
    /\r?\n(?=---------- Forwarded message ---------)/i,
    /\r?\n(?=________________________________)/i,
    /\r?\n(?=From:\s+[\s\S]+?\nSent:\s+[\s\S]+?\nTo:)/i,
  ];

  for (const marker of quoteMarkers) {
    const match = raw.match(marker);
    if (match && match.index !== undefined && match.index > 0) {
      return {
        fresh: raw.slice(0, match.index).trim(),
        quote: raw.slice(match.index).trim(),
      };
    }
  }

  const lines = raw.split(/\r?\n/);
  const firstQuoteLine = lines.findIndex((l) => l.trim().startsWith('>'));
  if (firstQuoteLine > 0) {
    return {
      fresh: lines.slice(0, firstQuoteLine).join('\n').trim(),
      quote: lines.slice(firstQuoteLine).join('\n').trim(),
    };
  }

  return { fresh: raw.trim(), quote: null };
}

// Convert plain text URLs to clickable links
function renderLinkifiedText(text: string) {
  const urlRegex = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g;
  const parts = text.split(urlRegex);

  return parts.map((part, i) => {
    if (part.match(urlRegex)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-600 hover:text-indigo-800 underline decoration-indigo-300 hover:decoration-indigo-600 transition-colors break-all"
        >
          {part}
        </a>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

export const EmailBodyViewer: React.FC<EmailBodyViewerProps> = ({
  bodyHtml,
  bodyText,
  snippet,
  subject,
}) => {
  const [iframeHeight, setIframeHeight] = useState<number>(400);
  const [showTrimmed, setShowTrimmed] = useState<boolean>(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Prepare sanitized & styled HTML for iframe (Pure, Clean Light Theme like Gmail)
  const processedHtml = useMemo(() => {
    if (!bodyHtml) return '';

    let html = bodyHtml;

    // 1. Remove preheader spacer blocks that inject hidden non-breaking spaces
    html = html.replace(/<div[^>]*class=["'][^"']*preheader[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, '');
    html = html.replace(/<span[^>]*class=["'][^"']*preheader[^"']*["'][^>]*>[\s\S]*?<\/span>/gi, '');

    // 2. Neutralize @media (prefers-color-scheme: dark) so emails stay light & legible
    html = html.replace(/\(prefers-color-scheme\s*:\s*dark\)/gi, '(prefers-color-scheme: x-dark)');
    html = html.replace(/\[data-ogsc\]/gi, '[data-x-ogsc]');
    html = html.replace(/\[data-ogsb\]/gi, '[data-x-ogsb]');

    const isFullDoc = /<html[^>]*>/i.test(html) || /<!doctype/i.test(html);

    // Clean Gmail-like base styles
    const baseHeadContent = `
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <base target="_blank">
      <style>
        :root {
          color-scheme: light !important;
          supported-color-schemes: light !important;
        }
        html, body {
          margin: 0;
          padding: ${isFullDoc ? '0' : '16px'};
          background-color: #ffffff;
          color: #1e293b;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          word-break: break-word;
          line-height: 1.6;
          font-size: 14px;
        }
        a { color: #4f46e5; text-decoration: underline; }
        img {
          max-width: 100% !important;
          height: auto !important;
        }
        table {
          max-width: 100% !important;
        }
        blockquote, .gmail_quote, .quoted-text {
          border-left: 2px solid #cbd5e1 !important;
          margin: 12px 0 !important;
          padding-left: 14px !important;
          color: #64748b !important;
          background: rgba(248, 250, 252, 0.6) !important;
          border-radius: 0 8px 8px 0 !important;
        }
      </style>
    `;

    if (/<head[^>]*>/i.test(html)) {
      html = html.replace(/<head[^>]*>/i, (match) => `${match}\n${baseHeadContent}`);
    } else if (/<html[^>]*>/i.test(html)) {
      html = html.replace(/<html[^>]*>/i, (match) => `${match}\n<head>${baseHeadContent}</head>`);
    } else {
      html = `<!DOCTYPE html><html><head>${baseHeadContent}</head><body>${html}</body></html>`;
    }

    return html;
  }, [bodyHtml]);

  // Dynamically calculate and adjust iframe height to match content seamlessly
  const adjustHeight = useCallback(() => {
    try {
      const iframe = iframeRef.current;
      if (!iframe) return;
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) return;

      const body = doc.body;
      const docEl = doc.documentElement;
      if (!body && !docEl) return;

      const scrollH = Math.max(
        body ? body.scrollHeight : 0,
        body ? body.offsetHeight : 0,
        docEl ? docEl.clientHeight : 0,
        docEl ? docEl.scrollHeight : 0,
        docEl ? docEl.offsetHeight : 0
      );

      if (scrollH > 60) {
        setIframeHeight(scrollH + 16);
      }
    } catch {
      // Cross-origin guard
    }
  }, []);

  // Monitor content and image loading to dynamically expand iframe
  useEffect(() => {
    if (!bodyHtml) return;

    const iframe = iframeRef.current;
    if (!iframe) return;

    const timer1 = setTimeout(adjustHeight, 100);
    const timer2 = setTimeout(adjustHeight, 400);
    const timer3 = setTimeout(adjustHeight, 1200);
    const timer4 = setTimeout(adjustHeight, 2500);

    let observer: ResizeObserver | null = null;
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc && doc.body && window.ResizeObserver) {
        observer = new ResizeObserver(() => {
          adjustHeight();
        });
        observer.observe(doc.body);

        const imgs = doc.querySelectorAll('img');
        imgs.forEach((img) => {
          if (!img.complete) {
            img.addEventListener('load', adjustHeight);
            img.addEventListener('error', adjustHeight);
          }
        });
      }
    } catch {
      // ignore
    }

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
      if (observer) observer.disconnect();
    };
  }, [processedHtml, bodyHtml, adjustHeight]);

  const rawText = bodyText || snippet || '';
  const cleanedText = useMemo(() => {
    if (!rawText) return 'No message content.';
    let txt = rawText;
    txt = txt.replace(/<!--[\s\S]*?-->/g, '');
    txt = txt.replace(/\n{3,}/g, '\n\n');
    return txt.trim();
  }, [rawText]);

  const { fresh, quote } = useMemo(() => {
    return splitQuotedEmail(cleanedText);
  }, [cleanedText]);

  // Check if content is still being fetched from the server
  const isLoading = !bodyHtml && !bodyText;

  if (isLoading) {
    return (
      <div className="w-full py-12 flex flex-col items-center justify-center gap-2.5 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
        <p className="text-xs font-semibold text-slate-500">Loading message content...</p>
      </div>
    );
  }

  // Pure, clean, Gmail-style HTML rendering
  if (bodyHtml && bodyHtml.trim().length > 0) {
    return (
      <div className="w-full bg-white overflow-hidden">
        <iframe
          ref={iframeRef}
          srcDoc={processedHtml}
          onLoad={adjustHeight}
          title={subject || 'Email Content'}
          sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
          style={{
            width: '100%',
            height: `${iframeHeight}px`,
            border: 'none',
            display: 'block',
            transition: 'height 0.2s ease',
          }}
        />
      </div>
    );
  }

  // Clean, Gmail-caliber typography rendering with quote trimming toggle
  return (
    <div className="w-full bg-white text-slate-800 space-y-3">
      <div className="whitespace-pre-wrap font-sans text-[14px] leading-relaxed select-text break-words text-slate-800">
        {renderLinkifiedText(fresh || cleanedText)}
      </div>

      {quote && (
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowTrimmed((prev) => !prev)}
            className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 text-[11px] font-bold tracking-widest transition-all cursor-pointer select-none border border-slate-200/80 shadow-2xs"
            title={showTrimmed ? 'Hide trimmed content' : 'Show trimmed content'}
          >
            •••
          </button>
          {showTrimmed && (
            <div className="mt-3 pl-3.5 border-l-2 border-slate-300 text-slate-600 text-[13px] leading-relaxed bg-slate-50/70 p-3 rounded-r-xl whitespace-pre-wrap font-sans">
              {renderLinkifiedText(quote)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EmailBodyViewer;
