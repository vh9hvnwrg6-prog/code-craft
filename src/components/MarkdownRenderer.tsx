import React, { useEffect, useMemo, useRef, useState } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { Copy, Check } from 'lucide-react';
import Prism from 'prismjs';

// Load the grammars we actually use so the bundle stays small.
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-rust';

// A small, warm default theme for code blocks that works in both light and
// dark CodeCraft themes. Uses CSS custom properties so it follows the app.
const PRISM_THEME = `
.code-block code { color: var(--text-primary); background: transparent; }
.token.comment,
.token.prolog,
.token.cdata { color: var(--text-muted); font-style: italic; }
.token.keyword,
.token.property,
.token.tag,
.token.symbol,
.token.deleted { color: #c084fc; }
.token.string,
.token.char,
.token.builtin,
.token.inserted,
.token.attr-name,
.token.url { color: #60a5fa; }
.token.number,
.token.boolean,
.token.operator,
.token.regex,
.token.important { color: #f0abfc; }
.token.function,
.token.class-name,
.token.constant,
.token.punctuation { color: #fde68a; }
`;

// Inject the theme once.
let themeInjected = false;
function injectTheme() {
  if (themeInjected) return;
  const style = document.createElement('style');
  style.textContent = PRISM_THEME;
  document.head.appendChild(style);
  themeInjected = true;
}

interface MarkdownRendererProps {
  text: string;
  className?: string;
}

function copyToClipboard(text: string) {
  return navigator.clipboard.writeText(text).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  });
}

function renderCopyButton(
  codeText: string,
  preEl: HTMLPreElement,
  lang: string
): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = 'code-copy-btn';
  btn.setAttribute('aria-label', 'Copy code');
  btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
  btn.style.cssText = `
    position: absolute;
    top: 8px;
    right: 8px;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.12);
    color: var(--text-muted);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    opacity: 0;
    transition: opacity 150ms ease, background 150ms ease, color 150ms ease;
    z-index: 2;
  `;
  btn.onmouseenter = () => { btn.style.opacity = '1'; };
  btn.onmouseleave = () => { btn.style.opacity = '0'; };
  btn.onclick = async (e) => {
    e.stopPropagation();
    try {
      await copyToClipboard(codeText);
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
      btn.style.color = '#60a5fa';
      setTimeout(() => {
        btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
        btn.style.color = 'var(--text-muted)';
      }, 1200);
    } catch {}
  };
  return btn;
}

function addLanguageLabel(preEl: HTMLPreElement, lang: string) {
  const label = document.createElement('span');
  label.className = 'code-lang-label';
  label.textContent = lang.toUpperCase();
  label.style.cssText = `
    position: absolute;
    top: 8px;
    left: 10px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.04em;
    color: var(--text-muted);
    opacity: 0.8;
    text-transform: uppercase;
    pointer-events: none;
    z-index: 2;
  `;
  preEl.appendChild(label);
}

export function MarkdownRenderer({ text, className }: MarkdownRendererProps) {
  const codeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    injectTheme();
  }, []);

  // Parse + sanitize once per text change.
  const html = useMemo(() => {
    if (!text) return '';
    const raw = marked.parse(text, {
      gfm: true,
      breaks: true,
    }) as string;
    return DOMPurify.sanitize(raw, {
      ADD_ATTR: ['target', 'rel', 'class', 'data-lang'],
      ADD_TAGS: ['pre', 'code'],
    });
  }, [text]);

  // Highlight code blocks + add copy buttons + language labels after the HTML is in the DOM.
  useEffect(() => {
    if (!codeRef.current) return;
    const blocks = codeRef.current.querySelectorAll('pre > code');
    blocks.forEach((block) => {
      const el = block as HTMLElement;
      const preEl = el.parentElement as HTMLPreElement;
      if (!preEl || preEl.dataset.enhanced === 'true') return;
      preEl.dataset.enhanced = 'true';

      const lang = (el.className.match(/language-([\w-]+)/) || [])[1] || 'text';
      const codeText = el.textContent || '';

      // Highlight with Prism.
      if (lang !== 'text' && Prism.languages[lang]) {
        try {
          const highlighted = Prism.highlight(codeText, Prism.languages[lang], lang);
          el.innerHTML = highlighted;
        } catch {}
      }
      el.classList.add(`language-${lang}`);

      // Make pre relative for absolute positioning of label/button.
      preEl.style.position = 'relative';
      preEl.style.paddingTop = '36px';

      // Add language label.
      addLanguageLabel(preEl, lang);

      // Add copy button.
      const copyBtn = renderCopyButton(codeText, preEl, lang);
      preEl.appendChild(copyBtn);
    });
  }, [html]);

  return (
    <div
      className={`markdown-body ${className || ''}`}
      ref={codeRef}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}