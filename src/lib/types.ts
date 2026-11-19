export type Dir = 'in' | 'out';
export type Feeling = 'joy' | 'meh' | 'regret';
export type Nature = 'need' | 'want' | 'save' | 'give' | 'income';

export interface Entry {
  id: string;
  text: string; // what the user wrote
  label: string; // short title
  amount: number; // always positive
  dir: Dir;
  category: string;
  feeling?: Feeling;
  date: string; // YYYY-MM-DD
  createdAt: number;
  source: 'oracle' | 'muse' | 'manual' | 'routine';
  confidence: number; // 0..1
  photo?: string; // picture id in IndexedDB (this device only)
  routine?: string; // the memory it was logged from, when a routine logged it
  updatedAt?: number; // last edit, for sync
}

export interface Goal {
  id: string;
  name: string;
  amount: number;
  emoji: string;
  updatedAt?: number;
}

/** Something CashGlome remembers about the person, in their own words.
 *  routine: money that goes out (or comes in) on set days, logged for them or confirmed with one tap.
 *  balance: what they had at a moment; today's figure is that plus everything written since.
 *  income:  pay that arrives on a day of the month; it ends the "until payday" horizon.
 *  note:    anything else Florin should know ("I'm saving for a laptop", "I don't drive"). */
export type MemoryKind = 'routine' | 'balance' | 'income' | 'note';
export interface Memory {
  id: string;
  kind: MemoryKind;
  text: string; // the person's own words
  label?: string;
  amount?: number;
  category?: string;
  dir?: Dir;
  days?: number[]; // routine: 0 = Sunday … 6 = Saturday
  monthDay?: number; // routine that happens monthly instead (rent on the 1st), 1–31
  time?: string; // routine: HH:MM, when to log or ask
  mode?: 'ask' | 'auto'; // routine: ask with one tap, or log it automatically
  since?: string; // routine: first day it applies (YYYY-MM-DD)
  asOf?: number; // balance: when it was true (ms)
  payDay?: number; // income: day of the month, 1–31
  createdAt: number;
  updatedAt: number;
  deletedAt?: number; // forgotten: kept 30 days so it can be restored
  history?: { at: number; was: Partial<Memory> }[]; // earlier versions, newest first
}

/** What happened to a routine on a day: logged, skipped, or waiting for an answer. */
export type RoutineMark = 'done' | 'skipped' | 'pending';

export type AiProvider = 'local' | 'meta';

export interface Settings {
  ai: {
    provider: AiProvider;
    key: string;
    base: string;
    parseModel: string;
    storyModel: string;
  };
  sound: boolean;
  calm: boolean;
  theme: 'auto' | 'light' | 'dark';
  wallpaper: string; // painting id, or 'season'
  reminder: { on: boolean; time: string };
  /** Questions the app can't count itself may go to Florin: undefined until the person decides. */
  askMuse?: boolean;
  /** Background music: a Spotify playlist, album or track link, and whether it plays. */
  music?: { url: string; on: boolean };
}

export interface Profile {
  name: string;
  currency: string;
  onboarded: boolean;
  createdAt: number;
}

export interface State {
  profile: Profile;
  entries: Entry[];
  goals: Goal[];
  settings: Settings;
  seenBadges: string[];
  month: string; // YYYY-MM being viewed
  seenRestored: Record<string, number>; // patches already shown being cleaned, per month
  /** Days marked "nothing today": a quiet day is kept like a written one. */
  quiet?: string[];
  /** The house the gallery called them to, held for a year. */
  house?: import('./houses').Calling;
  memories: Memory[];
  routineLog: Record<string, RoutineMark>; // "<memory id>@<YYYY-MM-DD>"
  /** Entries and goals deleted on this device, so a sync can delete them everywhere. */
  gone: { kind: 'entry' | 'goal'; id: string; at: number }[];
  /** Cash taken out and not yet accounted for: asked about later, the gap filed as cash spending. */
  cash?: { id: string; amount: number; left: number; date: string; askedOn?: string; closed?: boolean }[];
  /** Rotating savings circles the person belongs to (tontine, susu, tanda, hui, kye, chit fund, stokvel…). */
  circles?: Circle[];
  /** The person's own categories (money in and money out), and built-in ones they've hidden. */
  categories?: import('./categories').Category[];
  hiddenCategories?: string[];
}

/** A rotating savings circle: everyone pays in each round, and one member takes the whole pot in turn. */
export interface Circle {
  id: string;
  name: string; // the person's own word for it: "ajo", "tanda", "계", "chit fund"…
  members: number;
  contribution: number; // what each member pays each round
  every: 'week' | 'month';
  start: string; // YYYY-MM-DD of the first round
  myTurn: number; // 1-based round in which the person takes the pot
  text: string; // the sentence it was read from
  createdAt: number;
  updatedAt: number;
}

export interface Parsed {
  amount: number;
  dir: Dir;
  category: string;
  label: string;
  feeling?: Feeling;
  date: string;
  confidence: number;
  text: string;
  source: 'oracle' | 'muse';
  /** Set when the text names a currency ("4,000 naira", "$20"), which may not be the person's own. */
  currency?: string;
}
