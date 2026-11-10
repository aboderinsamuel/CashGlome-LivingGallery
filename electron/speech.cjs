// Offline dictation on Windows through the built-in System.Speech recogniser.
// Chromium's Web Speech API needs Google's servers, which Electron doesn't have, so the desktop app
// listens with Windows' own engine instead: no network, no key, nothing leaves the machine.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const CS = String.raw`
using System;
using System.Globalization;
using System.Speech.Recognition;
public static class CgListen {
  public static void Run() {
    Console.OutputEncoding = System.Text.Encoding.UTF8;
    var outw = new System.IO.StreamWriter(Console.OpenStandardOutput()); outw.AutoFlush = true; Console.SetOut(outw);
    var all = SpeechRecognitionEngine.InstalledRecognizers();
    if (all.Count == 0) { Console.WriteLine("E no-recognizer"); return; }
    RecognizerInfo pick = all[0];
    foreach (var r in all) if (r.Culture.Name == CultureInfo.CurrentUICulture.Name) pick = r;
    using (var e = new SpeechRecognitionEngine(pick)) {
      e.LoadGrammar(new DictationGrammar());
      try { e.SetInputToDefaultAudioDevice(); } catch { Console.WriteLine("E no-mic"); return; }
      e.EndSilenceTimeout = TimeSpan.FromSeconds(0.9);
      var done = new System.Threading.ManualResetEvent(false);
      e.SpeechHypothesized += (s, a) => Console.WriteLine("P " + a.Result.Text);
      e.SpeechRecognized += (s, a) => Console.WriteLine("F " + a.Result.Text);
      e.AudioLevelUpdated += (s, a) => Console.WriteLine("L " + a.AudioLevel);
      e.RecognizeCompleted += (s, a) => done.Set();
      e.RecognizeAsync(RecognizeMode.Multiple);
      Console.WriteLine("R " + pick.Culture.Name);
      Console.In.ReadLine();
      e.RecognizeAsyncStop();
      done.WaitOne(4000);
      Console.WriteLine("D");
    }
  }
}`;

function script(dir) {
  const dll = path.join(dir, 'cg-listen-1.dll');
  const ps1 = path.join(dir, 'cg-listen-1.ps1');
  if (!fs.existsSync(ps1)) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'cg-listen.cs'), CS);
    fs.writeFileSync(ps1, [
      '$ErrorActionPreference = "Stop"',
      `$dll = '${dll.replace(/'/g, "''")}'`,
      'Add-Type -AssemblyName System.Speech',
      `if (-not (Test-Path $dll)) { Add-Type -Path '${path.join(dir, 'cg-listen.cs').replace(/'/g, "''")}' -ReferencedAssemblies System.Speech -OutputAssembly $dll -OutputType Library }`,
      'Add-Type -Path $dll',
      '[CgListen]::Run()',
    ].join('\r\n'));
  }
  return ps1;
}

/** Starts listening; returns a stop function. Events: ready, partial, final, level, error, end. */
function listen(dir, emit) {
  if (process.platform !== 'win32') { emit('error', 'unsupported'); emit('end'); return () => {}; }
  let ended = false;
  const end = () => { if (!ended) { ended = true; emit('end'); } };
  const p = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script(dir)], { windowsHide: true });
  let buf = '';
  p.stdout.setEncoding('utf8');
  p.stdout.on('data', (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).replace(/\r$/, ''); buf = buf.slice(i + 1);
      const k = line[0], v = line.slice(2);
      if (k === 'R') emit('ready', v);
      else if (k === 'P') emit('partial', v);
      else if (k === 'F') emit('final', v);
      else if (k === 'L') emit('level', Math.min(1, Number(v) / 60));
      else if (k === 'E') emit('error', v);
      else if (k === 'D') end();
    }
  });
  p.stderr.on('data', (d) => { const t = String(d); if (/exception|error/i.test(t)) emit('error', 'engine'); });
  p.on('exit', end);
  p.on('error', () => { emit('error', 'engine'); end(); });
  const timer = setTimeout(() => stop(), 60000); // never listen for more than a minute
  function stop() {
    clearTimeout(timer);
    try { p.stdin.write('stop\n'); } catch { /* already gone */ }
    setTimeout(() => { if (!ended) { try { p.kill(); } catch { /* gone */ } end(); } }, 5000);
  }
  return stop;
}

module.exports = { listen };
