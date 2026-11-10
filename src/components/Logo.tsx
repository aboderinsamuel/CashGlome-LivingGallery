/** The app icon (gold florin on lapis) and a one-colour lily for the menu bar. */
export function AppIcon({ size = 64, style }: { size?: number; style?: React.CSSProperties }) {
  return <img src={size <= 40 ? "./icon-64.png" : "./icon.png"} width={size} height={size} alt="" draggable={false} style={{ display: 'block', ...style }} />;
}

export function LilyGlyph({ size = 15, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="-140 -170 280 300" aria-hidden fill={color}>
      <path d="M0 -150 C 30 -118 40 -64 18 -8 L -18 -8 C -40 -64 -30 -118 0 -150 Z" />
      <path d="M16 -4 C 48 -40 104 -58 122 -20 C 134 6 112 34 88 24 C 104 6 94 -16 72 -10 C 52 -4 38 14 26 30 Z" />
      <path d="M-16 -4 C -48 -40 -104 -58 -122 -20 C -134 6 -112 34 -88 24 C -104 6 -94 -16 -72 -10 C -52 -4 -38 14 -26 30 Z" />
      <rect x="-58" y="22" width="116" height="26" rx="9" />
      <path d="M-14 48 C -26 82 -56 102 -92 100 C -74 118 -32 118 -6 84 Z" />
      <path d="M14 48 C 26 82 56 102 92 100 C 74 118 32 118 6 84 Z" />
      <path d="M-10 46 L10 46 L6 112 L-6 112 Z" />
      <path d="M-14 -16 L-46 -104" stroke={color} strokeWidth="14" strokeLinecap="round" />
      <path d="M14 -16 L46 -104" stroke={color} strokeWidth="14" strokeLinecap="round" />
      <circle cx="-50" cy="-118" r="16" /><circle cx="50" cy="-118" r="16" />
    </svg>
  );
}
