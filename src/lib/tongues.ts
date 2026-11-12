// Tongues: what the Oracle needs to read money written in languages other than English.
// Spanish, French, Portuguese, Chinese, Japanese, Korean, Hindi (both scripts), Arabic and Swahili.
//
// Three jobs, all on the device:
//   plain          the same writing with its numbers in digits: "3万5" → 35000, "25 mil" → 25000, "٢٥٠" → 250
//   tongueDir      which way the money went, from each language's own verbs ("me pagaron", "收到", "받았어")
//   tongueCategory what it was for ("almuerzo", "午饭", "점심" are all eating out)
// Every rule is pinned by tests/languages.mjs (npm run test:parser).
import type { Dir } from './types';

/* ——— Folding: accents off, so "pagué" and "pague" read alike. Keeps every character in its place. ——— */
const latinFold = (s: string) => s.replace(/[À-ɏ]/g, (c) => c.normalize('NFD')[0]);
/** For matching words only (it drops marks, so positions shift): Arabic vowel marks and alef forms, the Hindi nukta. */
const deepFold = (s: string) => latinFold(s.normalize('NFC').toLowerCase())
  .replace(/[ً-ْـ़]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[’`]/g, "'");
const flatten = (s: string) => ' ' + deepFold(s).replace(/[^\p{L}\p{M}\p{N}']+/gu, ' ').trim() + ' ';
const words = (s: string) => deepFold(s).split(/\s+/).filter(Boolean).map((w) => ' ' + w + ' ');
const hasAny = (flat: string, list: string[]) => list.some((w) => flat.includes(w));

/* ——— Numbers ——— */
const DIGIT_RUNS: [RegExp, number][] = [[/[٠-٩]/g, 0x0660], [/[۰-۹]/g, 0x06f0], [/[०-९]/g, 0x0966], [/[０-９]/g, 0xff10]];
const HAN_DIGIT: Record<string, number> = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 兩: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 일: 1, 이: 2, 삼: 3, 사: 4, 오: 5, 육: 6, 칠: 7, 팔: 8, 구: 9 };
const SMALL: Record<string, number> = { 十: 10, 百: 100, 千: 1000, 십: 10, 백: 100, 천: 1000 };
const BIG: Record<string, number> = { 万: 1e4, 萬: 1e4, 만: 1e4, 亿: 1e8, 億: 1e8, 억: 1e8 };

/** "3万5" 35000 · "7万5千" 75000 · "三百五" 350 · "1.2万" 12000 · "2천만" 20000000 · "만" 10000 */
function eastValue(s: string): number {
  let total = 0, section = 0, num: number | null = null, last = 0, single = false, zero = false;
  for (const tok of s.match(/\d[\d,]*(?:\.\d+)?|./gu) ?? []) {
    if (/^\d/.test(tok)) { num = parseFloat(tok.replace(/,/g, '')); single = tok.length === 1; continue; }
    if (tok === '零' || tok === '〇') { zero = true; continue; }
    if (HAN_DIGIT[tok] !== undefined) { num = HAN_DIGIT[tok]; single = true; continue; }
    if (SMALL[tok]) { section += (num ?? 1) * SMALL[tok]; num = null; last = SMALL[tok]; continue; }
    if (BIG[tok]) { section += num ?? 0; total += (section || 1) * BIG[tok]; section = 0; num = null; last = BIG[tok]; }
  }
  // "三千五" is 3,500 and "3万5" is 35,000: a lone last digit counts in the next place down
  if (num !== null) section += single && !zero && last >= 100 ? (num * last) / 10 : num;
  return Math.round((total + section) * 100) / 100;
}

const EAST_LED = /(?<![\d.,])\d[\d,]*(?:\.\d+)?(?:[十百千万萬亿億십백천만억](?:\d+(?:\.\d+)?|[〇零一二两兩三四五六七八九])?)+/gu;
const HAN_RUN = /[〇零一二两兩三四五六七八九十百千万萬亿億]+/gu;
const HANGUL_WON = /(?<![가-힣\d])[일이삼사오육칠팔구십백천만억]+(?=\s?원)/gu;
const HAN_MONEY_NEXT = /^\s?(?:元|块|塊|円|圓)/u;
// Things counted, not paid: "2杯咖啡", "3個", "11月", "2명". A number glued to one of these is left alone.
const COUNTERS = '个個杯瓶件次天号號月年点點人份斤张張本包盒碗日時时分枚回台辆輛双雙条條只隻位岁歲楼樓路개명잔병번일월년시분살층호인캔장';
const EAST = '\\u3040-\\u30ff\\u3400-\\u9fff\\uac00-\\ud7af';

const ROMANCE_NUM: Record<string, number> = { un: 1, uno: 1, una: 1, um: 1, uma: 1, dos: 2, dois: 2, duas: 2, deux: 2, tres: 3, trois: 3, cuatro: 4, quatro: 4, quatre: 4, cinco: 5, cinq: 5, seis: 6, six: 6, siete: 7, sete: 7, sept: 7, ocho: 8, oito: 8, huit: 8, nueve: 9, nove: 9, neuf: 9, diez: 10, dez: 10, dix: 10, quince: 15, quinze: 15, veinte: 20, vinte: 20, vingt: 20, treinta: 30, trinta: 30, trente: 30, cuarenta: 40, quarenta: 40, quarante: 40, cincuenta: 50, cinquenta: 50, cinquante: 50, cien: 100, cem: 100, cent: 100 };
const ROMANCE_WORD_MIL = new RegExp(`\\b(${Object.keys(ROMANCE_NUM).join('|')})\\s+(?:mil|mille)\\b`, 'gi');
const ROMANCE_MARK = /\b(pesos?|reais|soles|del|los|las|una|uma|mi|minha|meu|pra|pro|renta|alquiler|sueldo|salario|quincena|nomina|aluguel|luz|agua|comida|mercado|gasolina|conta|almuerzo|almoco|cena|jantar|pague|gaste|compre|cobre|recibi|gane|vendi|preste|mande|envie|pagaron|pago|paguei|gastei|comprei|recebi|ganhei|mandei|caiu)\b/i;
const SWAHILI_NUM: Record<string, number> = { moja: 1, mbili: 2, tatu: 3, nne: 4, tano: 5, sita: 6, saba: 7, nane: 8, tisa: 9, kumi: 10, ishirini: 20, thelathini: 30, arobaini: 40, hamsini: 50, sitini: 60, sabini: 70, themanini: 80, tisini: 90, mia: 100 };
const SWAHILI_SCALE: Record<string, number> = { mia: 100, elfu: 1e3, laki: 1e5, milioni: 1e6 };
// "mia" is also a name ("sent Mia 5000"), so it only counts before a Swahili number word
const SWAHILI_RE = new RegExp(`\\b(?:(elfu|laki|milioni)\\s+(\\d+(?:\\.\\d+)?|${Object.keys(SWAHILI_NUM).join('|')})|(mia)\\s+(${Object.keys(SWAHILI_NUM).join('|')}))\\b`, 'gi');
const HINDI_SCALE: [RegExp, number][] = [
  [/(\d+(?:\.\d+)?)\s*(?:hazaar|hazar|hajaar|hajar|हज़?ार)(?![\p{L}\p{M}])/giu, 1e3],
  [/(\d+(?:\.\d+)?)\s*(?:lakhs?|lacs?|लाख)(?![\p{L}\p{M}])/giu, 1e5],
  [/(\d+(?:\.\d+)?)\s*(?:crores?|करोड़?)(?![\p{L}\p{M}])/giu, 1e7],
  [/(\d+(?:\.\d+)?)\s*(?:ألف|الف|آلاف|الاف)(?![\p{L}])/gu, 1e3],
  [/(\d+(?:\.\d+)?)\s*(?:مليون|ملايين)(?![\p{L}])/gu, 1e6],
];
const num = (n: number) => String(Math.round(n * 100) / 100);
const FOREIGN = /[^\u0000-\u007f]|\b(?:mil|mille|elfu|laki|milioni|mia|hazaar|hazar|hajaar|hajar|lakhs?|lacs?|crores?|fcfa|cfa)\b/i;

/** The same writing, with every number in digits and its punctuation in the form the reader splits on. */
export function plain(text: string, home?: string): string {
  if (!FOREIGN.test(text)) return text; // plain English: nothing to do, and nothing to get wrong
  let t = text.normalize('NFC');
  for (const [re, zero] of DIGIT_RUNS) t = t.replace(re, (d) => String(d.charCodeAt(0) - zero));
  t = t.replace(/[，、；]/g, ', ').replace(/[،؛]/g, ', ').replace(/[。।]/g, '. ').replace(/：/g, ': ').replace(/￥/g, '¥').replace(/　/g, ' ');

  // East Asian numbers
  t = t.replace(EAST_LED, (m) => num(eastValue(m)));
  t = t.replace(HANGUL_WON, (m) => (/[십백천만억]/.test(m) ? num(eastValue(m)) : m));
  t = t.replace(HAN_RUN, (m: string, at: number, all: string) => {
    const paid = HAN_MONEY_NEXT.test(all.slice(at + m.length));
    if (!paid && (m.length < 2 || !/[百千万萬亿億]/.test(m) || /^(千万|万一)/.test(m))) return m;
    return num(eastValue(m));
  });
  // "午饭35" → "午饭 35": a price stands apart from the words around it; a count ("2杯") stays glued and is skipped
  t = t.replace(new RegExp(`([${EAST}])(?=\\d)`, 'gu'), '$1 ');
  t = t.replace(new RegExp(`(\\d)(?=[${EAST}])(?![${COUNTERS}])`, 'gu'), '$1 ');

  // Spanish, Portuguese, French
  const f = latinFold(t);
  const romance = home === 'MXN' || home === 'BRL' || ROMANCE_MARK.test(f) || ROMANCE_WORD_MIL.test(f);
  ROMANCE_WORD_MIL.lastIndex = 0;
  if (romance) t = t.replace(/(?<![\d.,])\d{1,3}(?:\.\d{3})+(?![\d,]|\s?[kmb]\b)/g, (m) => m.replace(/\./g, '')); // 1.250 is 1250
  t = t.replace(/(?<![\d.,])(\d{1,3})((?: \d{3})+)(?=\s?(?:fcfa|f ?cfa|cfa|francs?|€|euros?)(?![\p{L}]))/giu, (_m, a: string, b: string) => a + b.replace(/ /g, '')); // 1 250 fcfa
  t = splice(t, ROMANCE_WORD_MIL, (m) => num(ROMANCE_NUM[m[1].toLowerCase()] * 1000));
  t = t.replace(/(?<![\d.,])(\d+(?:[.,]\d+)?)\s*mille\b/gi, (_m, n: string) => num(parseFloat(n.replace(',', '.')) * 1000));
  if (romance) t = t.replace(/(?<![\d.,])(\d+(?:[.,]\d+)?)\s*mil\b/gi, (_m, n: string) => num(parseFloat(n.replace(',', '.')) * 1000));
  t = splice(t, /(?<![\d.,])(\d+(?:[.,]\d+)?)\s*(?:millones|millon|milhoes|milhao)\b/gi, (m) => num(parseFloat(m[1].replace(',', '.')) * 1e6));
  t = splice(t, /\b(?:mil|mille)\b(?=\s+(?:pesos|reais|francs?|fcfa|cfa|euros|soles))/gi, () => '1000');

  // Hindi and Arabic scale words, Swahili "elfu tano"
  for (const [re, scale] of HINDI_SCALE) t = t.replace(re, (_m, n: string) => num(parseFloat(n) * scale));
  t = t.replace(SWAHILI_RE, (_m, s1?: string, n1?: string, s2?: string, n2?: string) => {
    const scale = (s1 ?? s2)!.toLowerCase(), n = (n1 ?? n2)!.toLowerCase();
    return num((SWAHILI_NUM[n] ?? parseFloat(n)) * SWAHILI_SCALE[scale]);
  });
  return t;
}

/** Finds on the accent-folded text (same length), replaces in the original. */
function splice(t: string, re: RegExp, to: (m: RegExpExecArray) => string): string {
  const f = latinFold(t);
  if (f.length !== t.length) return t;
  const hits: RegExpExecArray[] = [];
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(f))) { hits.push(m); if (!m[0].length) re.lastIndex++; }
  re.lastIndex = 0;
  for (const h of hits.reverse()) t = t.slice(0, h.index) + to(h) + t.slice(h.index + h[0].length);
  return t;
}

/* ——— Which way the money went ——— */
// Someone did it to me: always money in. Checked first.
const IN_PHRASE: RegExp[] = [
  / me (?:pagaron|pago|mandaron|mando|enviaron|envio|dieron|dio|regalaron|regalo|transfirieron|transfirio|depositaron|deposito|devolvieron|devolvio|prestaron|presto|cayo|cayeron|llego|llegaron) /,
  / me (?:pagaram|pagou|mandou|mandaram|enviou|enviaram|deu|deram|transferiu|transferiram|devolveu|devolveram|emprestou|emprestaram|depositou|depositaram) /,
  / pix recebido /, / caiu /,
  / (?:j'ai|jai|j ai) (?:ete payee?|recu|gagne|vendu|touche|encaisse) /,
  / m'(?:a|ont) (?:envoye|paye|donne|vire|rembourse|prete|offert|rendu|verse) /,
  / (?:recu de|virement recu|ete payee?) /,
  / (?:मुझे|मुझको|मेरेको|mujhe|mujhko|mereko) (?:[^ ]+ ){0,4}(?:दिया|दिए|दी|भेजा|भेजे|भेजी|diya|diye|di|bheja|bheje|bheji) /u,
  / (?:حول|رجع|ارسل|بعث|دفع|بعت)(?:ت|وا)? ?لي /u,
  // "पापा ने 5000 भेजे": someone else did the sending, and nobody else is named as receiving it
  / (?!मैंने |मैने |हमने |maine |humne |hamne )[^ ]+ (?:ने|ne) (?!(?:[^ ]+ )*(?:को|ko) )(?:[^ ]+ ){0,5}(?:दिया|दिए|दी|भेजा|भेजे|भेजी|diya|diye|bheja|bheje|bheji) /u,
];
const set = (s: string) => words(s);
const IN_WORD = set(
  'cobre recibi gane vendi reembolso ' +
  'recebi ganhei reembolso estorno ' +
  'remboursement ' +
  'मिला मिले मिली कमाया कमाए बेचा बेची बेचे रिफंड mila mile mili kamaya kamaye becha bechi beche ' +
  'استلمت قبضت وصلني وصلتني جاني جالي حولي حوللي اعطاني عطاني اداني رجعلي رجعتلي كسبت ربحت بعت سلفني اقرضني ' +
  'nimepokea nilipokea nimepata nilipata nimelipwa nililipwa nimeuza niliuza nimeshinda nimerudishiwa amenitumia alinitumia wamenitumia amenipa alinipa amenilipa alinilipa wamenilipa amenirudishia imeingia zimeingia',
);
// I did it: money out, even when the thing paid for is a wage ("pagué el sueldo de la empleada").
const OUT_PHRASE: RegExp[] = [/ (?:fiz|mandei|enviei) um pix /, / pix (?:de [^ ]+ )?(?:pra|pro|para) /];
const OUT_WORD = set(
  'pague gaste compre mande envie preste perdi transferi deposite pagar ' +
  'paguei gastei comprei mandei enviei emprestei doei ' +
  'paye payee depense achete envoye prete perdu ' +
  'दिया दिए खर्च खर्चा खरीदा खरीदी खरीदे भेजा भेजे भेजी चुकाया भरा diya diye kharch kharcha kharida kharidi kharide bheja bheje bheji chukaya bhara ' +
  'دفعت صرفت اشتريت شريت حولت ارسلت بعثت اعطيت عطيت اديت سلفت خسرت تبرعت ' +
  'nimelipa nililipa nimenunua nilinunua nimetuma nilituma nimetumia nilitumia nimempa nilimpa nimemtumia nilimtumia nimemkopesha nimekopesha nimepoteza nimemlipa',
);
const IN_NOUN = set(
  'sueldo salario nomina quincena aguinaldo comision ventas beca mesada ' +
  'freela comissao vendas ' +
  'salaire paie prime bourse revenus allocation ' +
  'सैलरी तनख्वाह वेतन बोनस tankhwah tankha ' +
  'راتب الراتب مرتب المرتب معاش مكافأة عمولة ' +
  'mshahara faida mauzo bonasi',
);

const ZH_IN = /收到|收入|进账|進賬|到账|入账|赚|賺|卖了|卖出|卖掉|賣了|退款|退了|报销|報銷|收红包|给我(?![妈爸爷奶哥姐弟妹老儿女朋同家们])|給我(?![媽爸爺奶哥姐弟妹老兒女朋同家們])|转给我|轉給我|还我|還我|还了我|借给我|借我|中奖|中獎|赢了|贏了/u;
const ZH_OUT = /花了|买|買|付|交了|转给|转了|轉了|给了|給了|借给|借給|发红包|發紅包|充值|还了|还款|捐|丢了|亏了|输了/u;
const ZH_NOUN = /工资|工資|薪水|奖金|獎金|分红|利息|补贴|津贴|稿费|提成|报酬/u;
const JA_IN = /もらった|もらいました|もらえた|貰った|受け取|入った|入金|振り込まれ|振込まれ|売れた|売った|売りました|返金|返ってき|稼いだ|当たった|当選|払い戻し/u;
const JA_OUT = /払った|払いました|支払|買った|買いました|使った|送った|送金|あげた|貸した|チャージ|課金|寄付|なくした/u;
const JA_NOUN = /給料|給与|ボーナス|バイト代|お小遣い|収入|売上|利息|配当|賞与/u;
const KO_IN = /한테서|에게서|로부터|받았|받음|받아|들어왔|들어옴|입금|벌었|팔았|팔렸|환불|돌려받|당첨/u;
const KO_GIVE = /줬|주셨|보냈|보내줬|쐈|갚았|송금/u;
const KO_OUT = /썼|샀|냈|결제|충전|잃어|구매|지출/u;
const KO_NOUN = /월급|급여|보너스|알바비|용돈|수입|이자|배당|상여/u;
const KO_TO_ME = /(?:나|저|내|제)(?:한테|에게|게)(?!서)/u;
const KO_TO_OTHER = /(?:한테|에게|께)(?!서)/u;
const KO_OTHER_SUBJECT = /(?:^|\s)(?!내가\s|제가\s)[가-힣]+(?:이|가|께서)\s/u;

/** Which way, when the writing isn't English. Undefined means "no cue here": the English rules decide. */
export function tongueDir(seg: string): Dir | undefined {
  if (/^[\u0000-\u007f]*$/.test(seg) && !/[a-z]{4}/i.test(seg)) return undefined;
  if (/[぀-ヿ]/.test(seg)) { // kana: Japanese
    if (JA_IN.test(seg)) return 'in';
    if (JA_OUT.test(seg)) return 'out';
    if (JA_NOUN.test(seg)) return 'in';
  }
  if (/[가-힯]/.test(seg)) { // Korean leaves the subject out, so who gave whom is read from the particles
    if (KO_IN.test(seg)) return 'in';
    if (KO_GIVE.test(seg)) {
      if (KO_TO_ME.test(seg)) return 'in';
      if (KO_TO_OTHER.test(seg)) return 'out';
      return KO_OTHER_SUBJECT.test(seg) ? 'in' : 'out';
    }
    if (KO_OUT.test(seg)) return 'out';
    if (KO_NOUN.test(seg)) return 'in';
  }
  if (/[㐀-鿿]/.test(seg)) {
    if (ZH_IN.test(seg) || JA_IN.test(seg)) return 'in';
    if (ZH_OUT.test(seg) || JA_OUT.test(seg)) return 'out';
    if (ZH_NOUN.test(seg) || JA_NOUN.test(seg)) return 'in';
  }
  const flat = flatten(seg);
  if (IN_PHRASE.some((r) => r.test(flat))) return 'in';
  if (hasAny(flat, IN_WORD)) return 'in';
  if (OUT_PHRASE.some((r) => r.test(flat)) || hasAny(flat, OUT_WORD)) return 'out';
  if (hasAny(flat, IN_NOUN)) return 'in';
  return undefined;
}

/* ——— What it was for ——— */
const THINGS: [string, Dir, string][] = [
  ['dining', 'out', 'almuerzo comida cena desayuno cafe restaurante tacos cerveza dejeuner diner restaurant biere repas almoco jantar lanche cerveja 午饭 午餐 晚饭 晚餐 早饭 早餐 咖啡 奶茶 外卖 吃饭 火锅 ランチ 昼ごはん 夕飯 晩ごはん 朝ごはん コーヒー 飲み会 カフェ 弁当 ラーメン 外食 점심 저녁 아침 커피 치킨 김밥 카페 배달 식사 चाय खाना नाश्ता समोसा chai khana nashta samosa غداء عشاء فطور قهوة اكل مطعم chakula chapati'],
  ['groceries', 'out', 'supermercado mercado despensa pan super courses marche supermarche pain riz feira pao 买菜 超市 水果 スーパー コンビニ 마트 편의점 장보기 सब्ज़ी सब्जी राशन sabzi sabji ration kirana بقالة سوبرماركت خضار sokoni soko mboga unga kuku'],
  ['transport', 'out', 'taxi gasolina camion metro pasaje essence transport bus train onibus passagem 打车 地铁 公交 加油 油费 车费 滴滴 電車 タクシー バス ガソリン スイカ 定期 택시 택시비 버스 지하철 교통카드 주유 ऑटो पेट्रोल बस auto petrol تاكسي بنزين مواصلات اوبر nauli boda matatu mafuta daladala'],
  ['bills', 'out', 'luz agua internet recarga telefono facture electricite eau conta 水电 水电费 话费 电费 网费 充值 電気代 水道代 携帯代 ガス代 전기 수도 통신비 요금 रिचार्ज बिजली recharge bijli فاتورة كهرباء الكهرباء النت اشتراك umeme vocha maji bili'],
  ['rent', 'out', 'renta alquiler loyer aluguel 房租 家賃 월세 관리비 किराया kiraya ايجار الايجار kodi'],
  ['shopping', 'out', 'zapatos ropa chaussures vetements tenis roupa sapato 衣服 鞋 服 靴 옷 신발 कपड़े जूते kapde حذاء ملابس viatu nguo'],
  ['tech', 'out', 'celular telephone portable 手机 スマホ 폰 फोन موبايل simu'],
  ['fun', 'out', 'cine cinema 电影 电影票 映画 영화 फिल्म سينما'],
  ['education', 'out', 'escuela colegiatura ecole escola 学费 学費 학원 등록금 फीस مدرسة ada shule'],
  ['giving', 'out', 'mama papa regalo maman cadeau mae pai presente 妈 爸 红包 母 父 엄마 아빠 친구 मम्मी पापा mummy امي لامي ابي baba'],
  ['salary', 'in', 'sueldo salario nomina quincena pagaron pagaram salaire paie 工资 工資 薪水 給料 給与 バイト代 월급 급여 알바비 सैलरी तनख्वाह वेतन راتب الراتب مرتب المرتب معاش mshahara nimelipwa'],
  ['trade', 'in', 'vendi vendu ventas vendas 卖 賣 売 팔았 बेचा बेची becha bechi بعت nimeuza niliuza mauzo faida'],
  ['refund', 'in', 'reembolso devolvieron rembourse remboursement devolveram estorno 退款 报销 返金 환불 रिफंड رجعلي nimerudishiwa'],
  ['windfall', 'in', 'premio rifa prime loto bonus 奖金 獎金 中奖 ボーナス 보너스 당첨 बोनस مكافأة bonasi'],
  ['blessing', 'in', 'mando regalaron regalo envoye donne mandou deu 给我 給我 红包 もらった 용돈 줬 मुझे mujhe لي amenitumia amenipa'],
];
const THING_LIST = THINGS.map(([id, dir, list]) => ({ id, dir, list: deepFold(list).split(/\s+/).filter(Boolean) }));
const spaced = (w: string) => !/[぀-ヿ㐀-鿿가-힯]/.test(w);

export function tongueCategory(seg: string, dir: Dir): string | undefined {
  const flat = flatten(seg);
  let best: { id: string; score: number } | undefined;
  for (const c of THING_LIST) {
    if (c.dir !== dir) continue;
    let s = 0;
    for (const w of c.list) if (spaced(w) ? flat.includes(' ' + w + ' ') : flat.includes(w)) s += 1 + w.length / 8;
    if (s > (best?.score ?? 0)) best = { id: c.id, score: s };
  }
  return best?.id;
}

/** "Yesterday", in the same languages. */
export const YESTERDAY = /(?<![\p{L}])(?:ayer|anoche|hier|ontem)(?![\p{L}])|昨天|昨日|昨晚|어제|أمس|امبارح/iu;
