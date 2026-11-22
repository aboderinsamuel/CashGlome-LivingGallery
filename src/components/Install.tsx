import { useState } from 'react';
import { installLater, promptInstall, setInstallLater, useInstall } from '../lib/install';
import { Icon } from './Icons';

const IOS_HOW = <>In Safari, tap <b>Share</b> <Icon.share size={13} />, then <b>Add to Home Screen</b>.</>;

/** In Your book: where CashGlome stands on this phone, and the one tap to put it on the home screen. */
export function InstallRow({ Row }: { Row: (p: { label: string; sub?: React.ReactNode; children?: React.ReactNode }) => JSX.Element }) {
  const s = useInstall();
  if (s === 'installed') return <Row label="On your home screen" sub="CashGlome opens like an app here, and works with no signal." />;
  if (s === 'ready') return <Row label="Put it on your home screen" sub="Opens like an app, with no browser bar, and works with no signal."><button className="btn primary" onClick={() => void promptInstall()}>Install</button></Row>;
  if (s === 'ios') return <Row label="Put it on your home screen" sub={IOS_HOW} />;
  return <Row label="Put it on your home screen" sub="On your phone, open this page in Chrome or Safari and add it to your home screen. It opens like an app and works with no signal." />;
}

/** On Today, once, after a few lines: the suggestion to keep it on the home screen. "Not now" is kept for good. */
export function InstallNudge({ lines }: { lines: number }) {
  const s = useInstall();
  const [gone, setGone] = useState(installLater);
  if (gone || lines < 3 || (s !== 'ready' && s !== 'ios')) return null;
  const later = () => { setInstallLater(); setGone(true); };
  return (
    <section className="ph-install" aria-label="Put CashGlome on your home screen">
      <img src="./icon-maskable-192.png" alt="" width={44} height={44} />
      <div className="ph-install-t">
        <b>Keep it on your home screen</b>
        <span>{s === 'ios' ? IOS_HOW : 'Opens like an app, with no browser bar, and works with no signal.'}</span>
        <div className="ph-install-do">
          {s === 'ready' && <button className="ph-btn gilt" onClick={async () => { if (await promptInstall()) setGone(true); }}>Install</button>}
          <button className="ph-link" onClick={later}>Not now</button>
        </div>
      </div>
    </section>
  );
}
