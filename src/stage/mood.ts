// The light the painting rests in: four numbers (calm, rush, weight, plenty). Today every painting
// rests in the same calm light; no model decides how someone's week felt.

export interface Mood { calm: number; rush: number; weight: number; plenty: number }
export const NEUTRAL: Mood = { calm: 0.6, rush: 0, weight: 0, plenty: 0 };
