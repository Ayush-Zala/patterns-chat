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

export const EmailBodyViewer: React.FC<EmailBodyViewerProps> = ({
  bodyHtml,
  bodyText,
  snippet,
  subject,
}) => {
  const [iframeHeight, setIframeHeight] = useState<number>(400);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Prepare sanitized & styled HTML for iframe (Pure, Clean Light Theme like Gmail)
  const processedHtml = useMemo(() => {
    if (!bodyHtml) return '';

    let html = bodyHtml;

    // 1. Remove preheader spacer blocks that inject hundreds of hidden non-breaking spaces
    html = html.replace(/<div[^>]*class=["'][^"']*preheader[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, '');
    html = html.replace(/<span[^>]*class=["'][^"']*preheader[^"']*["'][^>]*>[\s\S]*?<\/span>/gi, '');

    // 2. Neutralize @media (prefers-color-scheme: dark) so emails with dark-mode media queries
    // don't force white text onto the clean white reading canvas!
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
          line-height: 1.5;
        }
        a { color: #4f46e5; }
        img {
          max-width: 100% !important;
          height: auto !important;
        }
        table {
          max-width: 100% !important;
        }
      </style>
    `;

    // Inject baseHeadContent right after <head> if present
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

  // Pure, clean, Gmail-style rendering without any toolbar or toggle buttons
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

  // Clean fallback for plain-text only emails
  return (
    <div className="w-full bg-white rounded-2xl p-4 text-slate-800">
      <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed select-text break-words">
        {cleanedText}
      </pre>
    </div>
  );
};

export default EmailBodyViewer;
