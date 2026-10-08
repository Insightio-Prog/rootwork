/** Countries and nationalities Rootwork can show a flag for. Flag images live in public/flags/<code>.svg. */
type Country = { code: string; name: string; also: string[] };

const COUNTRIES: Country[] = [
  { code: "gb-eng", name: "England", also: ["English"] },
  { code: "gb-wls", name: "Wales", also: ["Welsh", "Cymru"] },
  { code: "gb-sct", name: "Scotland", also: ["Scottish", "Scots", "Scot"] },
  { code: "gb-nir", name: "Northern Ireland", also: ["Northern Irish"] },
  { code: "gb", name: "United Kingdom", also: ["British", "UK", "Great Britain", "Britain", "GB"] },
  { code: "ie", name: "Ireland", also: ["Irish", "Republic of Ireland", "Eire"] },
  { code: "us", name: "United States", also: ["American", "USA", "US", "America", "United States of America"] },
  { code: "ca", name: "Canada", also: ["Canadian"] },
  { code: "au", name: "Australia", also: ["Australian"] },
  { code: "nz", name: "New Zealand", also: ["New Zealander", "Kiwi"] },
  { code: "za", name: "South Africa", also: ["South African"] },
  { code: "fr", name: "France", also: ["French"] },
  { code: "de", name: "Germany", also: ["German"] },
  { code: "it", name: "Italy", also: ["Italian"] },
  { code: "es", name: "Spain", also: ["Spanish"] },
  { code: "pt", name: "Portugal", also: ["Portuguese"] },
  { code: "nl", name: "Netherlands", also: ["Dutch", "Holland", "The Netherlands"] },
  { code: "be", name: "Belgium", also: ["Belgian"] },
  { code: "lu", name: "Luxembourg", also: ["Luxembourger"] },
  { code: "ch", name: "Switzerland", also: ["Swiss"] },
  { code: "at", name: "Austria", also: ["Austrian"] },
  { code: "pl", name: "Poland", also: ["Polish"] },
  { code: "cz", name: "Czechia", also: ["Czech", "Czech Republic", "Bohemia", "Bohemian"] },
  { code: "sk", name: "Slovakia", also: ["Slovak"] },
  { code: "hu", name: "Hungary", also: ["Hungarian"] },
  { code: "ro", name: "Romania", also: ["Romanian"] },
  { code: "bg", name: "Bulgaria", also: ["Bulgarian"] },
  { code: "gr", name: "Greece", also: ["Greek"] },
  { code: "ru", name: "Russia", also: ["Russian"] },
  { code: "ua", name: "Ukraine", also: ["Ukrainian"] },
  { code: "by", name: "Belarus", also: ["Belarusian"] },
  { code: "lt", name: "Lithuania", also: ["Lithuanian"] },
  { code: "lv", name: "Latvia", also: ["Latvian"] },
  { code: "ee", name: "Estonia", also: ["Estonian"] },
  { code: "se", name: "Sweden", also: ["Swedish"] },
  { code: "no", name: "Norway", also: ["Norwegian"] },
  { code: "dk", name: "Denmark", also: ["Danish"] },
  { code: "fi", name: "Finland", also: ["Finnish"] },
  { code: "is", name: "Iceland", also: ["Icelandic"] },
  { code: "hr", name: "Croatia", also: ["Croatian"] },
  { code: "rs", name: "Serbia", also: ["Serbian"] },
  { code: "si", name: "Slovenia", also: ["Slovenian"] },
  { code: "al", name: "Albania", also: ["Albanian"] },
  { code: "mt", name: "Malta", also: ["Maltese"] },
  { code: "cy", name: "Cyprus", also: ["Cypriot"] },
  { code: "tr", name: "Turkey", also: ["Turkish", "Türkiye"] },
  { code: "il", name: "Israel", also: ["Israeli"] },
  { code: "eg", name: "Egypt", also: ["Egyptian"] },
  { code: "ng", name: "Nigeria", also: ["Nigerian"] },
  { code: "gh", name: "Ghana", also: ["Ghanaian"] },
  { code: "ke", name: "Kenya", also: ["Kenyan"] },
  { code: "zw", name: "Zimbabwe", also: ["Zimbabwean", "Rhodesia", "Rhodesian"] },
  { code: "in", name: "India", also: ["Indian"] },
  { code: "pk", name: "Pakistan", also: ["Pakistani"] },
  { code: "bd", name: "Bangladesh", also: ["Bangladeshi"] },
  { code: "lk", name: "Sri Lanka", also: ["Sri Lankan", "Ceylon"] },
  { code: "cn", name: "China", also: ["Chinese"] },
  { code: "hk", name: "Hong Kong", also: ["Hong Konger"] },
  { code: "jp", name: "Japan", also: ["Japanese"] },
  { code: "kr", name: "South Korea", also: ["Korean", "South Korean"] },
  { code: "ph", name: "Philippines", also: ["Filipino", "Philippine"] },
  { code: "sg", name: "Singapore", also: ["Singaporean"] },
  { code: "my", name: "Malaysia", also: ["Malaysian"] },
  { code: "th", name: "Thailand", also: ["Thai"] },
  { code: "vn", name: "Vietnam", also: ["Vietnamese"] },
  { code: "id", name: "Indonesia", also: ["Indonesian"] },
  { code: "jm", name: "Jamaica", also: ["Jamaican"] },
  { code: "bb", name: "Barbados", also: ["Barbadian"] },
  { code: "tt", name: "Trinidad and Tobago", also: ["Trinidadian", "Trinidad"] },
  { code: "cu", name: "Cuba", also: ["Cuban"] },
  { code: "mx", name: "Mexico", also: ["Mexican"] },
  { code: "br", name: "Brazil", also: ["Brazilian"] },
  { code: "ar", name: "Argentina", also: ["Argentine", "Argentinian"] },
  { code: "cl", name: "Chile", also: ["Chilean"] },
  { code: "pe", name: "Peru", also: ["Peruvian"] },
  { code: "co", name: "Colombia", also: ["Colombian"] },
  { code: "ve", name: "Venezuela", also: ["Venezuelan"] },
];

function key(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z]/g, "");
}

const BY_KEY = new Map<string, Country>();
for (const country of COUNTRIES) {
  for (const label of [country.name, ...country.also]) BY_KEY.set(key(label), country);
}

export const COUNTRY_NAMES: string[] = COUNTRIES.map((country) => country.name);

/** The flag code for what someone typed ("Welsh", "wales", "USA"), or null when we have no flag for it. */
export function flagCodeFor(nationality: string | undefined | null): string | null {
  if (!nationality) return null;
  const direct = BY_KEY.get(key(nationality));
  if (direct) return direct.code;
  // "Welsh-born", "English / Irish": use the first word that we know.
  for (const part of nationality.split(/[\/,&;]|\band\b|\s+-\s+|-/i)) {
    const found = BY_KEY.get(key(part));
    if (found) return found.code;
  }
  return null;
}

// Places that name no country on their own. Anything not listed here can be given a nationality by hand.
const PLACE_HINTS: Record<string, string[]> = {
  "gb-wls": [
    "glamorgan", "glamorganshire", "monmouthshire", "pembrokeshire", "carmarthenshire", "cardiganshire", "ceredigion",
    "breconshire", "brecknockshire", "radnorshire", "montgomeryshire", "merionethshire", "denbighshire", "flintshire",
    "caernarfonshire", "caernarvonshire", "anglesey", "cardiff", "swansea", "newport", "rhondda", "pontypridd", "merthyr tydfil",
    "wrexham", "rhyl", "bangor", "gwynedd", "powys", "clwyd", "dyfed",
  ],
  "gb-sct": [
    "aberdeenshire", "ayrshire", "lanarkshire", "fife", "perthshire", "argyll", "midlothian", "lothian", "edinburgh",
    "glasgow", "aberdeen", "dundee", "inverness", "stirling", "highland", "dumfriesshire", "renfrewshire",
  ],
  "ie": ["dublin", "cork", "galway", "limerick", "kerry", "mayo", "sligo", "tipperary", "wexford", "waterford", "kildare", "meath", "clare", "donegal", "leinster", "munster", "connacht"],
  "gb-nir": ["antrim", "belfast", "londonderry", "derry", "armagh", "tyrone", "fermanagh"],
  "gb-eng": [
    "wiltshire", "somerset", "staffordshire", "lancashire", "cheshire", "yorkshire", "devon", "cornwall", "dorset", "hampshire",
    "kent", "sussex", "surrey", "essex", "norfolk", "suffolk", "cumberland", "cumbria", "northumberland", "durham", "derbyshire",
    "nottinghamshire", "leicestershire", "lincolnshire", "gloucestershire", "oxfordshire", "berkshire", "middlesex", "london",
    "shropshire", "herefordshire", "worcestershire", "warwickshire", "northamptonshire", "bedfordshire", "hertfordshire",
    "cambridgeshire", "buckinghamshire", "huntingdonshire", "rutland", "westmorland", "manchester", "liverpool", "birmingham",
    "wigan", "leeds", "sheffield", "bristol",
  ],
};

const HINT_TO_CODE = new Map<string, string>();
for (const [code, words] of Object.entries(PLACE_HINTS)) for (const word of words) HINT_TO_CODE.set(key(word), code);

/** The country a birthplace like "Chippenham, Wiltshire, England" points to, or null when it names none we know. */
export function flagCodeFromPlace(place: string | undefined | null): string | null {
  if (!place) return null;
  const parts = place
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  // Country names first (read from the end), then county/city hints, then single words ("West Monkton Somerset England").
  for (const part of [...parts].reverse()) {
    const found = BY_KEY.get(key(part));
    if (found) return found.code;
  }
  for (const part of [...parts].reverse()) {
    const hint = HINT_TO_CODE.get(key(part));
    if (hint) return hint;
  }
  const words = place.split(/[\s,]+/).filter(Boolean).reverse();
  for (const word of words) {
    const found = BY_KEY.get(key(word));
    if (found) return found.code;
  }
  for (const word of words) {
    const hint = HINT_TO_CODE.get(key(word));
    if (hint) return hint;
  }
  return null;
}

export function countryNameFor(code: string | null): string {
  return COUNTRIES.find((country) => country.code === code)?.name ?? "";
}

export function flagUrl(code: string): string {
  // A saved .html file has no /flags folder next to it, so it borrows the flags from the live site.
  const base = typeof location !== "undefined" && location.protocol === "file:" ? "https://rootwork.insightio.co.uk" : "";
  return `${base}/flags/${code}.svg`;
}
