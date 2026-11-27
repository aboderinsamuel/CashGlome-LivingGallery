import type { Dir, Nature } from './types';

export interface Category {
  id: string;
  name: string;
  short: string;
  color: string; // block colour
  ink: string; // text colour on the block
  dir: Dir;
  nature: Nature;
  sticker: string;
  words: string[];
  /** Made by the person, not shipped with the app. */
  custom?: boolean;
  /** Hidden from pickers and from reading new lines; old entries keep it. */
  hidden?: boolean;
}

export const CATEGORIES: Category[] = [
  { id: 'dining', name: 'Eating out', short: 'Food out', color: '#D9472B', ink: '#FFF6EA', dir: 'out', nature: 'want', sticker: 'bowl',
    words: ['suya','shawarma','kfc','chicken','pizza','burger','restaurant','eat','ate','lunch','dinner','breakfast','snack','snacks','coffee','starbucks','latte','drinks','drink','bar','beer','wine','jollof','small chops','chops','puff','ice cream','dessert','takeout','takeaway','food','chowdeck','glovo','ubereats','uber eats','doordash','bole','amala','noodles','sushi','cafe','boba','mcdonald','mcdonalds','domino','dominos','chicken republic','cake','smoothie','juice','pepper soup','asun','zobo','chapman'] },
  { id: 'groceries', name: 'Groceries', short: 'Groceries', color: '#A3AC7E', ink: '#1E1B16', dir: 'out', nature: 'need', sticker: 'basket',
    words: ['groceries','grocery','market','supermarket','shoprite','foodstuff','rice','beans','yam','garri','bread','eggs','milk','oil','tomatoes','pepper','onions','vegetables','fruits','meat','fish','provisions','spar','walmart','costco','aldi','tesco','lidl','whole foods','trader joe','indomie','cereal'] },
  { id: 'transport', name: 'Getting around', short: 'Transport', color: '#E9C75B', ink: '#1E1B16', dir: 'out', nature: 'need', sticker: 'taxi',
    words: ['uber','bolt','taxi','cab','bus','brt','danfo','keke','okada','fuel','petrol','gas station','diesel','train','metro','subway','transport','fare','ride','lyft','parking','toll','car wash','mechanic','car repair','indrive','tube','ferry'] },
  { id: 'travel', name: 'Travel', short: 'Travel', color: '#98AADE', ink: '#1E1B16', dir: 'out', nature: 'want', sticker: 'plane',
    words: ['flight','airline','plane ticket','hotel','airbnb','vacation','holiday','trip','visa','passport','resort','booking','travel'] },
  { id: 'bills', name: 'Bills & utilities', short: 'Bills', color: '#E8DCC0', ink: '#1E1B16', dir: 'out', nature: 'need', sticker: 'bulb',
    words: ['electricity','nepa','phcn','prepaid','light bill','power','water bill','water','internet','wifi','data','airtime','recharge','phone bill','utility','utilities','bill','bills','gas bill','waste','trash','tv license','cable','router','mtn','glo','airtel','9mobile','spectranet','starlink'] },
  { id: 'rent', name: 'Home & rent', short: 'Home', color: '#E2B2A2', ink: '#1E1B16', dir: 'out', nature: 'need', sticker: 'house',
    words: ['rent','landlord','apartment','house rent','mortgage','service charge','caution fee','agent fee','furniture','home','repairs','plumber','electrician','cleaning','maid','housekeeping','decor'] },
  { id: 'subscriptions', name: 'Subscriptions', short: 'Subscriptions', color: '#B9505C', ink: '#FFF6EA', dir: 'out', nature: 'want', sticker: 'tv',
    words: ['netflix','spotify','apple music','youtube premium','chatgpt','claude','icloud','prime','amazon prime','subscription','showmax','dstv','gotv','hulu','disney','hbo','max','canva','adobe','notion','figma','patreon','onlyfans','xbox game pass','playstation plus','ps plus','audible','duolingo','gym membership','membership','renewal','premium'] },
  { id: 'shopping', name: 'Shopping', short: 'Shopping', color: '#8E2A2E', ink: '#FFF6EA', dir: 'out', nature: 'want', sticker: 'bag',
    words: ['clothes','clothing','shoes','sneakers','bag','dress','shirt','jeans','trousers','outfit','watch','jewelry','jewellery','amazon','jumia','shein','temu','zara','h&m','nike','adidas','perfume','cologne','fashion','aso ebi','ankara','agbada','hoodie','cap','shopping','mall','asos','etsy'] },
  { id: 'tech', name: 'Gadgets', short: 'Gadgets', color: '#2A2620', ink: '#FFF6EA', dir: 'out', nature: 'want', sticker: 'phone',
    words: ['phone','iphone','samsung','laptop','macbook','airpods','headphones','earbuds','charger','gadget','ipad','tablet','camera','mic','microphone','ring light','keyboard','mouse','monitor','console','ps5','xbox','switch','software','app','power bank','screen','cable','gpu'] },
  { id: 'fun', name: 'Going out', short: 'Going out', color: '#D98BA0', ink: '#1E1B16', dir: 'out', nature: 'want', sticker: 'ticket',
    words: ['movie','movies','cinema','party','club','clubbing','concert','show','event','ticket','tickets','games','game','bowling','arcade','festival','outing','hangout','vibes','karaoke','museum','beach','owambe','turn up','lounge','hookah','shisha'] },
  { id: 'betting', name: 'Betting', short: 'Betting', color: '#1E1B16', ink: '#FFF6EA', dir: 'out', nature: 'want', sticker: 'dice',
    words: ['bet','betting','sportybet','bet9ja','1xbet','betway','betking','casino','lottery','lotto','slots','stake','poker','gamble','aviator','parlay'] },
  { id: 'health', name: 'Health', short: 'Health', color: '#A9CDA0', ink: '#1E1B16', dir: 'out', nature: 'need', sticker: 'pill',
    words: ['hospital','doctor','clinic','drugs','medicine','pharmacy','malaria','test','lab','dentist','dental','glasses','therapy','therapist','health','insurance','hmo','vitamins','checkup','surgery','prescription'] },
  { id: 'selfcare', name: 'Self-care', short: 'Self-care', color: '#EBC3B0', ink: '#1E1B16', dir: 'out', nature: 'want', sticker: 'polish',
    words: ['salon','hair','barber','haircut','braids','wig','nails','makeup','skincare','lashes','spa','massage','gym','fitness','pedicure','manicure','facial','lotion','cream','fragrance','grooming'] },
  { id: 'education', name: 'Learning', short: 'Learning', color: '#3E8C86', ink: '#FFF6EA', dir: 'out', nature: 'need', sticker: 'books',
    words: ['school','fees','school fees','tuition','course','courses','book','books','udemy','coursera','class','exam','jamb','waec','training','bootcamp','certification','workshop fee','lesson','tutor','masterclass'] },
  { id: 'giving', name: 'Family & giving', short: 'Giving', color: '#C99A3E', ink: '#1E1B16', dir: 'out', nature: 'give', sticker: 'gift',
    words: ['gift','gifts','gave','mum','mom','mother','dad','father','family','sister','brother','sibling','church','tithe','offering','donation','donate','charity','mosque','zakat','friend','birthday gift','wedding gift','sent to','support','help','girlfriend','boyfriend','wife','husband','baby','kids','children','aunty','uncle','cousin','grandma','granny'] },
  { id: 'savings', name: 'Savings & investing', short: 'Savings', color: '#2F6B4A', ink: '#FFF6EA', dir: 'out', nature: 'save', sticker: 'piggy',
    words: ['saved','save','savings','invest','invested','investment','stocks','stock','shares','crypto','bitcoin','btc','eth','usdt','piggyvest','cowrywise','risevest','bamboo','trove','emergency fund','fixed deposit','mutual fund','etf','index fund','robinhood','vanguard','pension','retirement','401k','isa','put aside','set aside','kolo','ajo','esusu','thrift'] },
  { id: 'debt', name: 'Debt repayment', short: 'Debt', color: '#7C7468', ink: '#FFF6EA', dir: 'out', nature: 'need', sticker: 'card',
    words: ['loan','repay','repayment','debt','credit card','owe','owed','paid back','installment','instalment','klarna','afterpay','carbon','fairmoney','palmcredit','return','pay back','paying back'] },
  { id: 'lent', name: 'Lent out', short: 'Lent', color: '#B08A5A', ink: '#1E1B16', dir: 'out', nature: 'save', sticker: 'coin',
    words: ['lent','lend','lending','loaned','loan to','borrowed','borrow','lent my','lend my','loaned my','borrowed my','borrow my','borrowed a','loaned a','lent a'] },
  { id: 'business', name: 'Business costs', short: 'Business', color: '#D7B98C', ink: '#1E1B16', dir: 'out', nature: 'need', sticker: 'box',
    words: ['inventory','stock up','supplies','materials','ads','advertising','facebook ads','instagram ads','printing','packaging','logistics','delivery fee','dispatch','shipping','domain','hosting','server','contractor','staff','salary to','wages to','tools'] },
  { id: 'other', name: 'Everything else', short: 'Other', color: '#DCD4C2', ink: '#1E1B16', dir: 'out', nature: 'want', sticker: 'star',
    words: [] },
  { id: 'salary', name: 'Salary', short: 'Salary', color: '#2B3FA8', ink: '#FFF6EA', dir: 'in', nature: 'income', sticker: 'briefcase',
    words: ['salary','paycheck','pay check','wages','wage','payday','pay day','monthly pay','stipend','payroll'] },
  { id: 'trade', name: 'Sales', short: 'Sales', color: '#3F8F64', ink: '#FFF6EA', dir: 'in', nature: 'income', sticker: 'shop',
    words: ['sold','sale','sales','customer','customers','profit','revenue','order','orders','business','shop','store','market sales','pos','invoice paid'] },
  { id: 'craft', name: 'Freelance & creator', short: 'Freelance', color: '#D9472B', ink: '#FFF6EA', dir: 'in', nature: 'income', sticker: 'palette',
    words: ['freelance','gig','client','brand deal','sponsorship','sponsor','youtube','adsense','tiktok','creator fund','commission','contract','upwork','fiverr','design job','project payment','consulting','royalties','affiliate','ugc','logo','design','designs','website','photoshoot','shoot','editing','video edit','tutoring','lesson','lessons','side hustle','hustle','article','writing','job','jobs','session','sessions'] },
  { id: 'blessing', name: 'Gifts received', short: 'Gifts', color: '#D98BA0', ink: '#1E1B16', dir: 'in', nature: 'income', sticker: 'heart',
    words: ['gift','gifted','dashed','gave me','sent me','birthday money','allowance','pocket money','blessing','dash','spraying','sprayed','from mom','from dad','from mum'] },
  { id: 'harvest', name: 'Returns & interest', short: 'Returns', color: '#B8B05A', ink: '#1E1B16', dir: 'in', nature: 'income', sticker: 'sprout',
    words: ['interest','dividend','dividends','returns','roi','yield','matured','staking','profit from investment'] },
  { id: 'refund', name: 'Refunds', short: 'Refunds', color: '#98AADE', ink: '#1E1B16', dir: 'in', nature: 'income', sticker: 'coin',
    words: ['refund','refunded','reversal','reversed','cashback','cash back','returned'] },
  { id: 'windfall', name: 'Other income', short: 'Windfall', color: '#E9C75B', ink: '#1E1B16', dir: 'in', nature: 'income', sticker: 'clover',
    words: ['won','winnings','bonus','prize','found','jackpot','lottery win','payout','grant','scholarship','award'] },
];

export const CAT: Record<string, Category> = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));
export const cat = (id: string): Category => CAT[id] ?? CAT.other;

/** Pigments a person can give their own categories: the colours of the paintings. */
export const PIGMENTS: { name: string; color: string; ink: string }[] = [
  { name: 'Ochre', color: '#C9962E', ink: '#1E1B16' },
  { name: 'Umber', color: '#7A5534', ink: '#FFF6EA' },
  { name: 'Lapis', color: '#2B3FA8', ink: '#FFF6EA' },
  { name: 'Vermilion', color: '#C8402A', ink: '#FFF6EA' },
  { name: 'Verdigris', color: '#3E8C86', ink: '#FFF6EA' },
  { name: 'Madder', color: '#A3384F', ink: '#FFF6EA' },
  { name: 'Lead white', color: '#E8DCC0', ink: '#1E1B16' },
  { name: 'Gold leaf', color: '#E2C27A', ink: '#1E1B16' },
];

const BUILT_IN = CATEGORIES.slice();
/** The same categories in Sugar & Velvet: each pigment turned up to candy, keeping its hue, ink chosen for contrast. */
const D = '#2A1330', W = '#FFFFFF';
const SUGAR: Record<string, [string, string]> = {
  dining: ['#FF7A59', D], groceries: ['#8FD694', D], transport: ['#FFD15C', D], travel: ['#8EC5FF', D],
  bills: ['#FFE3B3', D], rent: ['#FFB4A2', D], subscriptions: ['#C66BFF', D], shopping: ['#FF5CA8', D],
  tech: ['#5B5BD6', W], fun: ['#FF9ECF', D], betting: ['#2A1330', W], health: ['#7FE3C4', D],
  selfcare: ['#FFC2D9', D], education: ['#4FB8C9', D], giving: ['#FFB347', D], savings: ['#34B38A', D],
  lent: ['#F2B880', D], debt: ['#B9A9CC', D], business: ['#E8C28E', D], other: ['#E9DDE6', D],
  salary: ['#6C5CE7', W], trade: ['#2EC4A0', D], craft: ['#FF7A59', D], blessing: ['#FF9ECF', D],
  harvest: ['#C8E06B', D], refund: ['#8EC5FF', D], windfall: ['#FFD15C', D],
};
let tone: 'sugar' | 'classic' = 'classic';
let applied = '';
/** Sets which palette the built-in categories are painted in. Call before drawing; cheap when unchanged. */
export function tintCategories(p: 'sugar' | 'classic') {
  if (p === tone) return;
  tone = p;
  const key = applied; applied = '';
  const [custom, hidden] = key ? (JSON.parse(key) as [Category[], string[]]) : [[], []];
  applyCategories(custom, hidden);
}
/** Brings the person's own categories and hidden ones into the shared list, in place, so every reader sees them. */
export function applyCategories(custom: Category[] = [], hidden: string[] = []) {
  const key = JSON.stringify([custom, hidden]);
  if (key === applied) return;
  applied = key;
  const hide = new Set(hidden);
  const tinted = (c: Category): Category => (tone === 'sugar' && SUGAR[c.id] ? { ...c, color: SUGAR[c.id][0], ink: SUGAR[c.id][1] } : c);
  const next = [...BUILT_IN.map((c) => ({ ...tinted(c), hidden: hide.has(c.id) || undefined })), ...custom.map((c) => ({ ...c, custom: true, hidden: hide.has(c.id) || undefined }))];
  // Within each direction: your own first, then the built-in ones, and the catch-alls
  // ("Everything else", "Other income") last.
  const rank = (c: Category) => (c.id === 'other' || c.id === 'windfall' ? 2 : c.custom ? 0 : 1);
  const ordered = (['out', 'in'] as const).flatMap((d) => next.filter((c) => c.dir === d).map((c, i) => ({ c, i })).sort((a, b) => rank(a.c) - rank(b.c) || a.i - b.i).map((x) => x.c));
  CATEGORIES.splice(0, CATEGORIES.length, ...ordered);
  for (const k of Object.keys(CAT)) delete CAT[k];
  for (const c of CATEGORIES) CAT[c.id] = c;
}
/** Categories offered when choosing one: not hidden. */
export const choosable = (dir?: 'in' | 'out') => CATEGORIES.filter((c) => !c.hidden && (!dir || c.dir === dir));
