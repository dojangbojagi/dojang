// GYEVO design tokens — mirrors src/app/theme.css exactly

export const C = {
  ink1000: '#030203',
  ink950:  '#060405',
  ink900:  '#0E0A0C',
  ink850:  '#150F12',
  ink800:  '#1D1519',
  ink700:  '#281D22',
  ink600:  '#3A2B32',

  line:       'rgba(255,255,255,0.12)',
  lineStrong: 'rgba(255,255,255,0.22)',
  lineFaint:  'rgba(255,255,255,0.07)',

  text:     '#F7F3F4',
  textMuted:'#A89DA1',
  textDim:  '#857A7E',

  // burgundy accent (private / proof / primary)
  burgundy:  '#6D001A',
  burgundyHi:'#8F1332',
  gold:      '#B81A34',
  goldInk:   '#FFFFFF',
  periwinkle:'#A8183A',

  // public / on-chain
  celadon:   '#F7F3F4',

  stateValid:  '#F7F3F4',
  stateWarn:   '#E0A95A',
  stateInvalid:'#FF5C5C',
  stateDemo:   '#B8AEB1',
} as const;

export const FONT = {
  display: '"Quicksand", system-ui, sans-serif',
  mono:    '"JetBrains Mono", ui-monospace, monospace',
} as const;

export const EASE = {
  // matches --ease-out: cubic-bezier(0.16,1,0.3,1)
  out:   [0.16, 1, 0.3, 1] as [number,number,number,number],
  sharp: [0.4, 0, 0.2, 1] as [number,number,number,number],
} as const;
