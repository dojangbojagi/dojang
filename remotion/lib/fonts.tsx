import { useEffect } from 'react';
import { continueRender, delayRender, staticFile } from 'remotion';

const FONT_FACES = `
@font-face {
  font-family: 'Quicksand';
  src: url('${staticFile('fonts/quicksand-latin-400-normal.woff2')}') format('woff2');
  font-weight: 400; font-style: normal; font-display: block;
}
@font-face {
  font-family: 'Quicksand';
  src: url('${staticFile('fonts/quicksand-latin-600-normal.woff2')}') format('woff2');
  font-weight: 600; font-style: normal; font-display: block;
}
@font-face {
  font-family: 'Quicksand';
  src: url('${staticFile('fonts/quicksand-latin-700-normal.woff2')}') format('woff2');
  font-weight: 700; font-style: normal; font-display: block;
}
@font-face {
  font-family: 'JetBrains Mono';
  src: url('${staticFile('fonts/jetbrains-mono-latin-400-normal.woff2')}') format('woff2');
  font-weight: 400; font-style: normal; font-display: block;
}
@font-face {
  font-family: 'JetBrains Mono';
  src: url('${staticFile('fonts/jetbrains-mono-latin-500-normal.woff2')}') format('woff2');
  font-weight: 500; font-style: normal; font-display: block;
}
`;

// Inject font faces once at module level so they exist before any component mounts
if (typeof document !== 'undefined') {
  const el = document.getElementById('gyevo-fonts');
  if (!el) {
    const style = document.createElement('style');
    style.id = 'gyevo-fonts';
    style.textContent = FONT_FACES;
    document.head.appendChild(style);
  }
}

export function useFonts() {
  const handle = delayRender('loading-fonts');
  useEffect(() => {
    // Force-load all variants explicitly — fonts don't auto-load until used by visible text
    Promise.all([
      document.fonts.load('700 16px "Quicksand"'),
      document.fonts.load('600 16px "Quicksand"'),
      document.fonts.load('400 16px "Quicksand"'),
      document.fonts.load('400 16px "JetBrains Mono"'),
      document.fonts.load('500 16px "JetBrains Mono"'),
    ])
      .catch(() => {/* fall through */})
      .finally(() => continueRender(handle));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

// Lightweight wrapper component
export function FontLoader({ children }: { children: React.ReactNode }) {
  useFonts();
  // Always render children — delayRender ensures the screenshot happens after fonts load
  return <>{children}</>;
}
