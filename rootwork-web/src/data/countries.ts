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

export function flagUrl(code: string): string {
  return `/flags/${code}.svg`;
}
