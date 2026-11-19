// Line icons drawn to sit next to SF Symbols: 1.6 stroke, round caps, 20px grid.
type P = { size?: number; className?: string };
const I = (paths: React.ReactNode) => ({ size = 18, className }: P) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>{paths}</svg>
);

export const Icon = {
  book: I(<><path d="M10 5.2C8.4 4 6.2 3.6 3.5 3.8v11.4c2.7-.2 4.9.2 6.5 1.4 1.6-1.2 3.8-1.6 6.5-1.4V3.8C13.8 3.6 11.6 4 10 5.2Z" /><path d="M10 5.2v11.4" /></>),
  shelf: I(<><rect x="3" y="4" width="3.4" height="12" rx="1" /><rect x="8.3" y="4" width="3.4" height="12" rx="1" /><path d="m13.6 5.2 3.2-.9 2.9 11.4-3.2.9z" transform="translate(-1.6 0)" /></>),
  list: I(<><path d="M7.5 5.5h9M7.5 10h9M7.5 14.5h9" /><circle cx="4" cy="5.5" r=".6" fill="currentColor" /><circle cx="4" cy="10" r=".6" fill="currentColor" /><circle cx="4" cy="14.5" r=".6" fill="currentColor" /></>),
  repeat: I(<><path d="M4 9V8a3 3 0 0 1 3-3h9l-2.5-2.5M16 11v1a3 3 0 0 1-3 3H4l2.5 2.5" /></>),
  flag: I(<><path d="M4.5 17.5V3.5M4.5 4h9.5l-2 3.5 2 3.5H4.5" /></>),
  seal: I(<><path d="m10 2.8 1.7 1.3 2.1-.2.7 2 1.9 1-.5 2.1.9 1.9-1.5 1.5-.1 2.2-2.1.4-1.3 1.7L10 15.9l-1.9.8-1.3-1.7-2.1-.4-.1-2.2-1.5-1.5.9-1.9-.5-2.1 1.9-1 .7-2 2.1.2Z" /><path d="m7.4 9.8 1.8 1.8 3.4-3.4" /></>),
  gear: I(<><circle cx="10" cy="10" r="2.6" /><path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4" /></>),
  plus: I(<path d="M10 4v12M4 10h12" />),
  search: I(<><circle cx="8.8" cy="8.8" r="5" /><path d="m12.5 12.5 4 4" /></>),
  left: I(<path d="m12 4.5-5.5 5.5 5.5 5.5" />),
  right: I(<path d="m8 4.5 5.5 5.5L8 15.5" />),
  play: I(<path d="M6.5 4.3v11.4c0 .5.5.8 1 .5l8.6-5.7a.6.6 0 0 0 0-1L7.5 3.8c-.5-.3-1 0-1 .5Z" fill="currentColor" stroke="none" />),
  sidebar: I(<><rect x="2.8" y="3.8" width="14.4" height="12.4" rx="2.6" /><path d="M7.6 3.8v12.4" /></>),
  up: I(<path d="M10 16V4.5M5 9.5l5-5 5 5" />),
  arrowUR: I(<path d="M6 14 14 6M7.5 6H14v6.5" />),
  /** Play: a picture in four pieces, one lifted out of place. */
  games: I(<path d="M3.5 3.5h6v6h-6zM3.5 10.5h6v6h-6zM10.5 10.5h6v6h-6zM11.8 2.2h5.9v5.9h-5.9z" />),
  close: I(<path d="m5 5 10 10M15 5 5 15" />),
  camera: I(<><path d="M3 7.2c0-1 .8-1.8 1.8-1.8h1.7l1.2-1.9h4.6l1.2 1.9h1.7c1 0 1.8.8 1.8 1.8v7.3c0 1-.8 1.8-1.8 1.8H4.8c-1 0-1.8-.8-1.8-1.8Z" /><circle cx="10" cy="10.6" r="3" /></>),
  stop: I(<rect x="5.5" y="5.5" width="9" height="9" rx="2" fill="currentColor" stroke="none" />),
  image: I(<><rect x="3" y="3.8" width="14" height="12.4" rx="2.4" /><circle cx="7.3" cy="8" r="1.4" /><path d="m3.4 14.6 4.1-3.8 3 2.6 2.4-2 3.7 3.2" /></>),
  receipt: I(<><path d="M5 2.8h10v14.4l-1.7-1.1-1.6 1.1-1.7-1.1-1.7 1.1-1.6-1.1L5 17.2Z" /><path d="M7.6 6.6h4.8M7.6 9.4h4.8M7.6 12.2h2.6" /></>),
  ask: I(<><path d="M4 4.5h12a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5H9l-3.5 3v-3H4A1.5 1.5 0 0 1 2.5 13V6A1.5 1.5 0 0 1 4 4.5Z" /><path d="M8.4 8a1.7 1.7 0 1 1 2.4 1.5c-.5.2-.8.6-.8 1.1M10 12.4v.1" /></>),
  music: I(<><path d="M7.5 15V4.8l9-1.8v10" /><circle cx="5.5" cy="15" r="2" /><circle cx="14.5" cy="13" r="2" /></>),
  mic: I(<><rect x="7.5" y="2.8" width="5" height="9" rx="2.5" /><path d="M4.8 9.6a5.2 5.2 0 0 0 10.4 0M10 14.8v2.4" /></>),
  trash: I(<><path d="M4 6h12M8 6V4.5h4V6M5.5 6l.8 10h7.4l.8-10" /></>),
  check: I(<path d="m4.5 10.5 3.5 3.5 7.5-8" />),
  sun: I(<><circle cx="10" cy="10" r="3.2" /><path d="M10 2.5v1.6M10 15.9v1.6M2.5 10h1.6M15.9 10h1.6M4.7 4.7l1.1 1.1M14.2 14.2l1.1 1.1M4.7 15.3l1.1-1.1M14.2 5.8l1.1-1.1" /></>),
  moon: I(<path d="M15.8 12.3A6.5 6.5 0 0 1 7.7 4.2a6.5 6.5 0 1 0 8.1 8.1Z" />),
  chevronDown: I(<path d="m5.5 8 4.5 4.5L14.5 8" />),
  sparkline: I(<path d="M3 14.5 7 10l3 3 7-8" />),
  undo: I(<path d="M7.5 5 4 8.5 7.5 12M4.5 8.5H12a4 4 0 0 1 0 8h-2" />),
  share: I(<><path d="M10 12.5V3.5M6.8 6.5 10 3.3l3.2 3.2" /><path d="M7 9H5.5a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1H13" /></>),
  download: I(<path d="M10 3.5v9M6 9l4 4 4-4M4 16.5h12" />),
  upload: I(<path d="M10 13V4M6 7.5l4-4 4 4M4 16.5h12" />),
  person: I(<><circle cx="10" cy="7" r="3.2" /><path d="M4 17c.8-3 3.2-4.6 6-4.6s5.2 1.6 6 4.6" /></>),
  quill: I(<><path d="M16.5 3.5c-5 .5-9 4.4-10.2 10.1l-.8 3" /><path d="M16.5 3.5c-.6 4.3-3.2 7.7-7.6 8.6M8.6 9.4h3.3" /></>),
  cloud: I(<path d="M6 15.5h8.2a3.3 3.3 0 0 0 .4-6.6 4.8 4.8 0 0 0-9.2-.9A3.8 3.8 0 0 0 6 15.5Z" />),
  bolt: I(<path d="M11 2.8 4.8 11h4.6L8.8 17.2 15.2 9h-4.6Z" />),
};
