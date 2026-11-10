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
  source: 'oracle' | 'muse' | 'manual';
  confidence: number; // 0..1
  photo?: string; // picture id in IndexedDB (this device only)
}

export interface Goal {
  id: string;
  name: string;
  amount: number;
  emoji: string;
}

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
}
