// Writes the synthetic bank statements in public/samples/: fictional banks, fictional people, no logos.
// They exist to test the statement reader and to demo it. Run: node scripts/make-statements.mjs
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = new URL('../public/samples/', import.meta.url);
mkdirSync(OUT, { recursive: true });

/* ——— A tiny PDF writer: Helvetica text and rules, nothing else ——— */
const W = { '0': 556, '1': 556, '2': 556, '3': 556, '4': 556, '5': 556, '6': 556, '7': 556, '8': 556, '9': 556, ',': 278, '.': 278, '-': 333, ' ': 278, '(': 333, ')': 333, '+': 584 };
const width = (s, size) => [...s].reduce((a, c) => a + (W[c] ?? 556), 0) * size / 1000;
const esc = (s) => s.replace(/[\\()]/g, (c) => '\\' + c);

function pdf(pages) {
  // pages: [{ ops: string[] }]; text ops are already PDF operators.
  const objs = [];
  const add = (body) => { objs.push(body); return objs.length; };
  const catalog = add(null), pagesId = add(null);
  const f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const f3 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Times-Italic /Encoding /WinAnsiEncoding >>');
  const kids = [];
  for (const p of pages) {
    const stream = p.ops.join('\n');
    const c = add(`<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`);
    kids.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R /F3 ${f3} 0 R >> >> /Contents ${c} 0 R >>`));
  }
  objs[catalog - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objs[pagesId - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;
  let out = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const offsets = [];
  objs.forEach((body, i) => { offsets.push(Buffer.byteLength(out, 'latin1')); out += `${i + 1} 0 obj\n${body}\nendobj\n`; });
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('')}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}
const T = (x, y, s, size = 9, font = 'F1') => `BT /${font} ${size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${esc(s)}) Tj ET`;
const R = (x, y, s, size = 9, font = 'F1') => T(x - width(s, size), y, s, size, font); // right-aligned
const rule = (x1, y, x2, w = 0.6, g = 0.25) => `${g} G ${w} w ${x1} ${y} m ${x2} ${y} l S 0 G`;

/* ——— Statement one: Lantern & Quay Bank, US dollars, money out / money in columns, two pages ——— */
{
  const fmt = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const rows = [
    ['01 Oct 2026', 'SALARY  NORTHWIND STUDIO PAYROLL', 0, 3200],
    ['01 Oct 2026', 'STANDING ORDER  RENT  ELM COURT LETTINGS', 1150, 0],
    ['02 Oct 2026', 'CARD PURCHASE  GREENLEAF GROCERS', 64.3, 0],
    ['02 Oct 2026', 'CARD PURCHASE  BEAN THERE COFFEE', 4.8, 0],
    ['03 Oct 2026', 'UBER *TRIP', 12.6, 0],
    ['04 Oct 2026', 'NETFLIX.COM SUBSCRIPTION', 15.49, 0],
    ['05 Oct 2026', 'TRANSFER TO MUM  BIRTHDAY GIFT', 200, 0],
    ['06 Oct 2026', 'CITY POWER ELECTRICITY BILL', 78.2, 0],
    ['07 Oct 2026', 'CARD PURCHASE  BEAN THERE COFFEE', 4.8, 0],
    ['08 Oct 2026', 'ATM WITHDRAWAL  HIGH ST', 100, 0],
    ['09 Oct 2026', 'CARD PURCHASE  LITTLE SAIGON RESTAURANT', 38.5, 0],
    ['10 Oct 2026', 'FREELANCE  DESIGN CLIENT  INVOICE 0042', 0, 450],
    ['11 Oct 2026', 'CARD PURCHASE  GREENLEAF GROCERS', 82.15, 0],
    ['12 Oct 2026', 'SPOTIFY PREMIUM', 10.99, 0],
    ['13 Oct 2026', 'UBER *TRIP', 9.4, 0],
    ['14 Oct 2026', 'CORNER PHARMACY', 23.6, 0],
    ['15 Oct 2026', 'IRONWORKS GYM MEMBERSHIP', 45, 0],
    ['16 Oct 2026', 'CARD PURCHASE  BEAN THERE COFFEE', 5.2, 0],
    ['17 Oct 2026', 'AMAZON MARKETPLACE  HEADPHONES', 59.99, 0],
    ['18 Oct 2026', 'CINEMA  STARLIGHT PICTUREHOUSE', 24, 0],
    ['19 Oct 2026', 'CARD PURCHASE  GREENLEAF GROCERS', 71.4, 0],
    ['20 Oct 2026', 'MOBILE PHONE BILL  BRIGHTWAVE', 35, 0],
    ['21 Oct 2026', 'UBER *TRIP', 14.1, 0],
    ['22 Oct 2026', 'TRANSFER TO SAVINGS  RAINY DAY POT', 300, 0],
    ['23 Oct 2026', 'CARD PURCHASE  LITTLE SAIGON RESTAURANT', 42.75, 0],
    ['24 Oct 2026', 'BOOKSHOP  PAGES & CO', 18.99, 0],
    ['25 Oct 2026', 'CARD PURCHASE  BEAN THERE COFFEE', 4.8, 0],
    ['26 Oct 2026', 'REFUND  AMAZON MARKETPLACE', 0, 59.99],
    ['27 Oct 2026', 'CARD PURCHASE  GREENLEAF GROCERS', 58.2, 0],
    ['28 Oct 2026', 'BARBER  SHARP LINES', 22, 0],
    ['29 Oct 2026', 'UBER *TRIP', 11.3, 0],
    ['30 Oct 2026', 'MONTHLY ACCOUNT FEE', 4.5, 0],
    ['31 Oct 2026', 'INTEREST PAID', 0, 1.12],
  ];
  let bal = 1240.55;
  const opening = bal;
  const lines = rows.map(([d, desc, out, inn]) => { bal = Math.round((bal - out + inn) * 100) / 100; return { d, desc, out, inn, bal }; });
  const pages = [];
  const perPage = 20;
  const head = (ops, y) => {
    ops.push(T(40, y, 'Date', 8.5, 'F2'), T(110, y, 'Description', 8.5, 'F2'), R(400, y, 'Money out', 8.5, 'F2'), R(475, y, 'Money in', 8.5, 'F2'), R(555, y, 'Balance', 8.5, 'F2'));
    ops.push(rule(40, y - 6, 555, 0.8, 0.1));
  };
  for (let p = 0; p * perPage < lines.length; p++) {
    const ops = [];
    let y = 790;
    if (p === 0) {
      ops.push(T(40, y, 'Lantern & Quay Bank', 18, 'F2'));
      ops.push(T(40, y - 16, 'A fictional bank, for demonstration only', 8.5, 'F3'));
      ops.push(R(555, y, 'Current account statement', 10, 'F2'));
      ops.push(R(555, y - 14, 'Statement period: 1 October 2026 to 31 October 2026', 8.5));
      ops.push(T(40, y - 46, 'Account holder: A. Reader', 9), T(40, y - 58, 'Account: Everyday Current  ****0000', 9), T(40, y - 70, 'Currency: USD', 9));
      ops.push(R(555, y - 46, `Opening balance  ${fmt(opening)}`, 9), R(555, y - 58, `Closing balance  ${fmt(bal)}`, 9));
      y -= 110;
      head(ops, y); y -= 20;
      ops.push(T(40, y, '01 Oct 2026', 9), T(110, y, 'Opening balance', 9, 'F3'), R(555, y, fmt(opening), 9)); y -= 17;
    } else {
      ops.push(T(40, y, 'Lantern & Quay Bank', 11, 'F2'), R(555, y, 'Statement period: 1 October 2026 to 31 October 2026', 8.5));
      y -= 34;
      head(ops, y); y -= 20;
    }
    for (const l of lines.slice(p * perPage, (p + 1) * perPage)) {
      ops.push(T(40, y, l.d, 9), T(110, y, l.desc, 9));
      if (l.out) ops.push(R(400, y, fmt(l.out), 9));
      if (l.inn) ops.push(R(475, y, fmt(l.inn), 9));
      ops.push(R(555, y, fmt(l.bal), 9));
      // a wrapped second line under some payments, as banks print them
      if (/LITTLE SAIGON|AMAZON MARKETPLACE  HEAD/.test(l.desc)) { y -= 11; ops.push(T(110, y, 'Card ****0000  Ref 88412093', 7.5)); }
      ops.push(rule(40, y - 5, 555, 0.3, 0.8));
      y -= 17;
    }
    if ((p + 1) * perPage >= lines.length) { y -= 6; ops.push(T(110, y, 'Closing balance', 9, 'F3'), R(555, y, fmt(bal), 9, 'F2')); }
    ops.push(T(40, 40, `Page ${p + 1} of ${Math.ceil(lines.length / perPage)}`, 8), R(555, 40, 'Lantern & Quay Bank is fictional. No real account is shown.', 7.5, 'F3'));
    pages.push({ ops });
  }
  writeFileSync(new URL('lantern-quay-october-2026.pdf', OUT), pdf(pages));
}

/* ——— Statement two: Compass Mutual Bank, euros, one signed amount column, decimal commas, day.month.year ——— */
{
  const fmt = (n) => (n < 0 ? '-' : '') + Math.abs(n).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const rows = [
    ['01.11.2026', '01.11.2026', 'Salary - Atelier Verde', 2650],
    ['02.11.2026', '02.11.2026', 'Rent - Casa Lumen apartment', -980],
    ['03.11.2026', '03.11.2026', 'Supermarket Mercato Fresco', -47.85],
    ['03.11.2026', '04.11.2026', 'Metro card top-up', -30],
    ['05.11.2026', '05.11.2026', 'Cafe Aurora', -6.4],
    ['06.11.2026', '06.11.2026', 'Electricity - Solaris Energy', -64.1],
    ['07.11.2026', '07.11.2026', 'Supermarket Mercato Fresco', -52.3],
    ['08.11.2026', '08.11.2026', 'Trattoria del Ponte dinner', -58],
    ['09.11.2026', '09.11.2026', 'Internet - Fibrelink', -29.99],
    ['10.11.2026', '10.11.2026', 'Transfer from L. Moreau (concert tickets)', 45],
    ['11.11.2026', '11.11.2026', 'Concert tickets - Sala Nova', -90],
    ['12.11.2026', '12.11.2026', 'Pharmacy San Marco', -12.5],
    ['13.11.2026', '13.11.2026', 'Cafe Aurora', -5.9],
    ['14.11.2026', '14.11.2026', 'Clothing - Filo & Trama', -79],
    ['15.11.2026', '15.11.2026', 'Savings transfer - Holiday fund', -200],
    ['16.11.2026', '16.11.2026', 'Taxi Ride', -18.4],
    ['17.11.2026', '17.11.2026', 'Supermarket Mercato Fresco', -61.2],
    ['18.11.2026', '18.11.2026', 'Streaming subscription - Cinevault', -9.99],
    ['19.11.2026', '19.11.2026', 'Account maintenance fee', -3],
  ];
  let bal = 812.4;
  const opening = bal;
  const lines = rows.map(([d, v, desc, amt]) => { bal = Math.round((bal + amt) * 100) / 100; return { d, v, desc, amt, bal }; });
  const ops = [];
  let y = 790;
  ops.push(T(40, y, 'COMPASS MUTUAL BANK', 15, 'F2'));
  ops.push(T(40, y - 15, 'A fictional bank, for demonstration only', 8.5, 'F3'));
  ops.push(R(555, y, 'Account statement no. 11/2026', 9, 'F2'), R(555, y - 13, 'Period 01.11.2026 - 19.11.2026', 8.5));
  ops.push(T(40, y - 44, 'Account holder: J. Example', 9), T(40, y - 56, 'IBAN: XX00 0000 0000 0000 0000 00', 9), T(40, y - 68, 'Currency: EUR', 9));
  y -= 104;
  ops.push(T(40, y, 'Booking date', 8.5, 'F2'), T(110, y, 'Value date', 8.5, 'F2'), T(175, y, 'Transaction details', 8.5, 'F2'), R(470, y, 'Amount', 8.5, 'F2'), R(555, y, 'Balance', 8.5, 'F2'));
  ops.push(rule(40, y - 6, 555, 0.8, 0.1));
  y -= 20;
  ops.push(T(175, y, 'Balance brought forward', 9, 'F3'), R(555, y, fmt(opening), 9)); y -= 17;
  for (const l of lines) {
    ops.push(T(40, y, l.d, 9), T(110, y, l.v, 9), T(175, y, l.desc, 9), R(470, y, fmt(l.amt), 9), R(555, y, fmt(l.bal), 9));
    ops.push(rule(40, y - 5, 555, 0.3, 0.8));
    y -= 17;
  }
  y -= 6;
  ops.push(T(175, y, 'New balance', 9, 'F2'), R(555, y, fmt(bal), 9, 'F2'));
  ops.push(T(40, 40, 'Page 1 of 1', 8), R(555, 40, 'Compass Mutual Bank is fictional. No real account is shown.', 7.5, 'F3'));
  writeFileSync(new URL('compass-mutual-november-2026.pdf', OUT), pdf([{ ops }]));
}

/* ——— A "scanned" statement: a page of shapes and no words, to show the kind message ——— */
{
  const ops = ['0.85 g 40 760 515 40 re f', '0.92 g'];
  for (let i = 0; i < 26; i++) ops.push(`40 ${700 - i * 22} ${200 + ((i * 97) % 300)} 9 re f`);
  writeFileSync(new URL('scanned-statement.pdf', OUT), pdf([{ ops }]));
}

/* ——— A CSV export: Saltmarsh Credit Union, Kenyan shillings, debit and credit columns ——— */
{
  const rows = [
    ['2026-11-01', 'MOBILE MONEY RECEIVED FROM W. KAMAU (GIFT)', '', '2,000.00'],
    ['2026-11-02', 'SALARY - KILIMO COOPERATIVE', '', '68,500.00'],
    ['2026-11-02', 'RENT - BAOBAB HEIGHTS', '22,000.00', ''],
    ['2026-11-03', 'MAVUNO SUPERMARKET', '3,450.00', ''],
    ['2026-11-04', 'MATATU FARE', '200.00', ''],
    ['2026-11-05', 'ELECTRICITY PREPAID TOKENS', '1,500.00', ''],
    ['2026-11-06', 'CHAI CORNER LUNCH', '850.00', ''],
    ['2026-11-08', 'AIRTIME TOP-UP', '500.00', ''],
    ['2026-11-10', 'CHAMA CONTRIBUTION - SAVINGS', '5,000.00', ''],
    ['2026-11-12', 'PHARMACY - AFYA CHEMIST', '780.00', ''],
    ['2026-11-15', 'MAVUNO SUPERMARKET', '2,960.00', ''],
    ['2026-11-16', 'SCHOOL FEES - LITTLE ACORNS', '9,000.00', ''],
  ];
  let bal = 15400;
  const n = (s) => Number(s.replace(/,/g, '')) || 0;
  const fmt = (x) => x.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const lines = ['Saltmarsh Credit Union,Everyday Savings,Currency: KES', 'Account holder,M. Example,Statement,1-16 November 2026', '', 'Date,Description,Debit,Credit,Balance', ...rows.map(([d, desc, dr, cr]) => { bal = Math.round((bal - n(dr) + n(cr)) * 100) / 100; return [d, `"${desc}"`, dr ? `"${dr}"` : '', cr ? `"${cr}"` : '', `"${fmt(bal)}"`].join(','); })];
  writeFileSync(new URL('saltmarsh-credit-union-november-2026.csv', OUT), lines.join('\n') + '\n');
}
console.log('Wrote the sample statements to public/samples/');
