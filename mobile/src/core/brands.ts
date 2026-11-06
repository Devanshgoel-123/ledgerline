/**
 * Shops, apps and billers the phone app recognises, on top of the backend's
 * catalog (catalog.generated.json).
 *
 * - BRAND_OVERRIDES: for brands the backend already knows, the website (used
 *   only at build time to fetch the logo bundled with the app), a better
 *   category in the phone app's tree, and extra names to match.
 * - EXTRA_BRANDS: everyday Indian merchants and billers the backend doesn't
 *   list yet: subscriptions, phone and power bills, fuel, insurance, EMIs.
 *
 * Matching is the shared parser's: a name or alias as a whole word in the
 * narration, or squashed inside the UPI id (4+ letters). Keep aliases
 * specific; a short common word would tag unrelated payments.
 */
export interface BrandOverride {
  domain?: string;
  category?: string;
  aliases?: string[];
  upi?: string[];
}

export interface Brand {
  name: string;
  domain: string;
  category: string;
  aliases?: string[];
  upi?: string[];
}

export const BRAND_OVERRIDES: Record<string, BrandOverride> = {
  Adidas: { domain: "adidas.co.in", category: "clothing" },
  Airbnb: { domain: "airbnb.co.in" },
  "Airtel Payments": { domain: "airtel.in", category: "mobile-recharge" },
  Ajio: { domain: "ajio.com", category: "clothing" },
  "Allen Solly": { domain: "allensolly.com", category: "clothing" },
  Amazon: { domain: "amazon.in" },
  "Angel One": { domain: "angelone.in" },
  "Apollo Hospital": { domain: "apollohospitals.com", category: "doctor" },
  Apple: { domain: "apple.com", category: "electronics" },
  "Axis Bank": { domain: "axisbank.com" },
  Bata: { domain: "bata.com", category: "clothing" },
  Bewakoof: { domain: "bewakoof.com", category: "clothing" },
  Biba: { domain: "biba.in", category: "clothing" },
  BigBasket: { domain: "bigbasket.com" },
  Blinkit: { domain: "blinkit.com", category: "grocery" },
  "Burger King": { domain: "burgerking.in" },
  Chaayos: { domain: "chaayos.com", category: "cafes" },
  Croma: { domain: "croma.com", category: "electronics" },
  "Cult.fit": { domain: "cult.fit", category: "fitness" },
  DMart: { domain: "dmart.in" },
  Decathlon: { domain: "decathlon.in" },
  District: { domain: "district.in", category: "fun-activity" },
  Dominos: { domain: "dominos.co.in" },
  "ET Money": { domain: "etmoney.com" },
  EatSure: { domain: "eatsure.com" },
  Fabindia: { domain: "fabindia.com", category: "clothing" },
  FirstCry: { domain: "firstcry.com" },
  Flipkart: { domain: "flipkart.com" },
  Furlenco: { domain: "furlenco.com", category: "furniture" },
  Goibibo: { domain: "goibibo.com" },
  Groww: { domain: "groww.in" },
  "H&M": { domain: "hm.com", category: "clothing" },
  "HDFC Bank": { domain: "hdfcbank.com" },
  "ICICI Bank": { domain: "icicibank.com" },
  IKEA: { domain: "ikea.com", category: "furniture" },
  INDmoney: { domain: "indmoney.com" },
  IRCTC: { domain: "irctc.co.in", category: "trains" },
  IndiGo: { domain: "goindigo.in", category: "flights" },
  Instamart: { domain: "swiggy.com", category: "grocery" },
  "Jio WiFi": { domain: "jio.com", category: "internet" },
  JioMart: { domain: "jiomart.com" },
  KFC: { domain: "kfc.co.in" },
  Kuvera: { domain: "kuvera.in" },
  Lapinoz: { domain: "lapinozpizza.in" },
  Lenskart: { domain: "lenskart.com" },
  "Levi's": { domain: "levi.in", category: "clothing" },
  Lifestyle: { domain: "lifestylestores.com", category: "clothing" },
  "Louis Philippe": { domain: "louisphilippe.com", category: "clothing" },
  MakeMyTrip: { domain: "makemytrip.com", category: "travel" },
  Mamaearth: { domain: "mamaearth.in", category: "beauty" },
  "Marks & Spencer": { domain: "marksandspencer.in", category: "clothing" },
  "Max Fashion": { domain: "maxfashion.in", category: "clothing" },
  "McDonald's": { domain: "mcdonaldsindia.com" },
  Meesho: { domain: "meesho.com" },
  "Metro Shoes": { domain: "metroshoes.com", category: "clothing" },
  Myntra: { domain: "myntra.com", category: "clothing" },
  "Namma Yatri": { domain: "nammayatri.in" },
  Netmeds: { domain: "netmeds.com" },
  Nike: { domain: "nike.com", category: "clothing" },
  Nykaa: { domain: "nykaa.com", category: "beauty" },
  OYO: { domain: "oyorooms.com" },
  Ola: { domain: "olacabs.com" },
  Pantaloons: { domain: "pantaloons.com", category: "clothing" },
  "Paytm Money": { domain: "paytmmoney.com" },
  "Peter England": { domain: "peterengland.com", category: "clothing" },
  PharmEasy: { domain: "pharmeasy.in" },
  "Pizza Hut": { domain: "pizzahut.co.in" },
  Pronto: { category: "home-services" },
  Puma: { domain: "puma.com", category: "clothing" },
  Purplle: { domain: "purplle.com", category: "beauty" },
  Rapido: { domain: "rapido.bike" },
  "Reliance Digital": { domain: "reliancedigital.in", category: "electronics" },
  "Reliance Fresh": { domain: "relianceretail.com" },
  "Reliance Retail": { domain: "relianceretail.com" },
  "Reliance Trends": { domain: "reliancetrends.com", category: "clothing" },
  SBI: { domain: "sbi.co.in" },
  "Shoppers Stop": { domain: "shoppersstop.com", category: "clothing" },
  Skechers: { domain: "skechers.in", category: "clothing" },
  Snitch: { domain: "snitch.co.in", category: "clothing" },
  Starbucks: { domain: "starbucks.in", category: "cafes" },
  "Sugar Cosmetics": { domain: "sugarcosmetics.com", category: "beauty" },
  Swiggy: { domain: "swiggy.com" },
  Tanishq: { domain: "tanishq.co.in" },
  "Tata 1mg": { domain: "1mg.com" },
  "Tata CLiQ": { domain: "tatacliq.com" },
  "The Souled Store": { domain: "thesouledstore.com", category: "clothing" },
  Titan: { domain: "titan.co.in" },
  Uber: { domain: "uber.com" },
  Uniqlo: { domain: "uniqlo.com", category: "clothing" },
  Upstox: { domain: "upstox.com" },
  "Urban Company": { domain: "urbancompany.com", category: "home-services" },
  "Van Heusen": { domain: "vanheusenindia.com", category: "clothing" },
  "W for Woman": { domain: "wforwoman.com", category: "clothing" },
  Wakefit: { domain: "wakefit.co", category: "furniture" },
  Westside: { domain: "westside.com", category: "clothing" },
  Woodland: { domain: "woodlandworldwide.com", category: "clothing" },
  Zara: { domain: "zara.com", category: "clothing" },
  Zepto: { domain: "zeptonow.com", category: "grocery" },
  Zerodha: { domain: "zerodha.com" },
  Zomato: { domain: "zomato.com" },
  boAt: { domain: "boat-lifestyle.com", category: "electronics" },
  smallcase: { domain: "smallcase.com" },
};

const b = (name: string, domain: string, category: string, aliases?: string[], upi?: string[]): Brand => ({
  name,
  domain,
  category,
  ...(aliases ? { aliases } : {}),
  ...(upi ? { upi } : {}),
});

export const EXTRA_BRANDS: Brand[] = [
  // Subscriptions
  b("Netflix", "netflix.com", "subscriptions"),
  b("Spotify", "spotify.com", "subscriptions"),
  b("Prime Video", "primevideo.com", "subscriptions", ["amazon prime", "prime membership"]),
  b("JioHotstar", "hotstar.com", "subscriptions", ["hotstar", "disney hotstar", "novi digital"]),
  b("YouTube Premium", "youtube.com", "subscriptions", ["youtube", "youtubepremium"]),
  b("Google Play", "play.google.com", "subscriptions", ["play store", "google play", "googleplay"]),
  b("Google One", "one.google.com", "subscriptions", ["googleone"]),
  b("Apple Services", "apple.com", "subscriptions", ["apple services", "apple media services", "itunes", "apple com bill"]),
  b("SonyLIV", "sonyliv.com", "subscriptions", ["sony liv"]),
  b("ZEE5", "zee5.com", "subscriptions"),
  b("ChatGPT", "chatgpt.com", "subscriptions", ["openai"]),
  b("Microsoft", "microsoft.com", "subscriptions", ["microsoft 365", "xbox"]),
  b("Audible", "audible.in", "subscriptions"),
  b("LinkedIn", "linkedin.com", "subscriptions"),

  // Phone, internet, power, gas
  b("Airtel", "airtel.in", "mobile-recharge", ["bharti airtel", "airtel prepaid", "airtel postpaid", "airtel xstream"]),
  b("Jio", "jio.com", "mobile-recharge", ["jio prepaid", "jio postpaid", "reliance jio", "jio recharge"]),
  b("Vodafone Idea", "myvi.in", "mobile-recharge", ["vodafone", "vi prepaid", "vi postpaid", "vodafone idea"]),
  b("BSNL", "bsnl.co.in", "mobile-recharge"),
  b("ACT Fibernet", "actcorp.in", "internet", ["act fibernet", "atria convergence"]),
  b("Hathway", "hathway.com", "internet"),
  b("Tata Play", "tataplay.com", "internet", ["tata sky", "tataplay"]),
  b("Excitel", "excitel.com", "internet"),
  b("BESCOM", "bescom.karnataka.gov.in", "electricity"),
  b("Tata Power", "tatapower.com", "electricity", ["tata power ddl"]),
  b("Adani Electricity", "adanielectricity.com", "electricity", ["adani electricity mumbai"]),
  b("MSEDCL", "mahadiscom.in", "electricity", ["mahavitaran", "mahadiscom"]),
  b("BSES", "bsesdelhi.com", "electricity", ["bses rajdhani", "bses yamuna"]),
  b("Torrent Power", "torrentpower.com", "electricity"),
  b("TNEB", "tnebltd.gov.in", "electricity", ["tangedco", "tneb"]),
  b("Indane", "indane.co.in", "gas-water", ["indane gas"]),
  b("HP Gas", "myhpgas.in", "gas-water", ["hp gas"]),
  b("Bharatgas", "ebharatgas.com", "gas-water", ["bharat gas"]),
  b("Mahanagar Gas", "mahanagargas.com", "gas-water"),
  b("Indraprastha Gas", "iglonline.net", "gas-water", ["igl"]),

  // Fuel, metro, rentals, tolls
  b("Indian Oil", "iocl.com", "petrol", ["indianoil", "iocl", "indian oil"]),
  b("HP Petrol", "hindustanpetroleum.com", "petrol", ["hpcl", "hindustan petroleum"]),
  b("Bharat Petroleum", "bharatpetroleum.in", "petrol", ["bpcl"]),
  b("Shell", "shell.in", "petrol", ["shell india", "shell petrol"]),
  b("Jio-bp", "jiobp.com", "petrol", ["jio bp", "jiobp", "reliance bp"]),
  b("Delhi Metro", "delhimetrorail.com", "public-transport", ["dmrc"]),
  b("Namma Metro", "bmrc.co.in", "public-transport", ["bmrcl", "namma metro"]),
  b("Mumbai Metro", "mmmocl.co.in", "public-transport", ["mumbai metro", "mmrda"]),
  b("BluSmart", "blu-smart.com", "rides", ["blusmart"]),
  b("Yulu", "yulu.bike", "scooty-rental"),
  b("Royal Brothers", "royalbrothers.com", "scooty-rental"),
  b("Zoomcar", "zoomcar.com", "scooty-rental"),
  b("FASTag", "npci.org.in", "parking", ["fastag", "netc fastag"]),

  // Travel
  b("Air India", "airindia.com", "flights", ["airindia", "air india express"]),
  b("Akasa Air", "akasaair.com", "flights", ["akasa"]),
  b("SpiceJet", "spicejet.com", "flights"),
  b("redBus", "redbus.in", "trains"),
  b("Cleartrip", "cleartrip.com", "travel"),
  b("Yatra", "yatra.com", "travel"),
  b("EaseMyTrip", "easemytrip.com", "travel"),
  b("ixigo", "ixigo.com", "travel"),
  b("Booking.com", "booking.com", "stays", ["booking com"]),
  b("Agoda", "agoda.com", "stays"),
  b("Treebo", "treebo.com", "stays"),
  b("FabHotels", "fabhotels.com", "stays"),
  b("Zostel", "zostel.com", "stays"),

  // Food, cafés, groceries
  b("Subway", "subway.com", "food"),
  b("Haldiram's", "haldirams.com", "food", ["haldirams", "haldiram"]),
  b("Wow! Momo", "wowmomo.com", "food", ["wow momo", "wowmomo"]),
  b("Behrouz Biryani", "behrouzbiryani.com", "food", ["behrouz"]),
  b("Faasos", "faasos.com", "food"),
  b("Box8", "box8.in", "food"),
  b("magicpin", "magicpin.in", "food"),
  b("EatClub", "eatclub.in", "food"),
  b("Taco Bell", "tacobell.co.in", "food"),
  b("Theobroma", "theobroma.in", "cafes"),
  b("Third Wave Coffee", "thirdwavecoffee.in", "cafes", ["third wave"]),
  b("Blue Tokai", "bluetokaicoffee.com", "cafes"),
  b("Barista", "barista.co.in", "cafes"),
  b("Café Coffee Day", "cafecoffeeday.com", "cafes", ["cafe coffee day", "coffee day", "ccd"]),
  b("Costa Coffee", "costacoffee.in", "cafes"),
  b("Tim Hortons", "timhortonsindia.com", "cafes"),
  b("Dunkin'", "dunkinindia.com", "cafes", ["dunkin"]),
  b("Baskin Robbins", "baskinrobbinsindia.com", "cafes"),
  b("Licious", "licious.in", "grocery"),
  b("FreshToHome", "freshtohome.com", "grocery"),
  b("Country Delight", "countrydelight.in", "grocery"),
  b("More Retail", "moreretail.in", "grocery", ["more supermarket", "more retail", "more megastore"]),
  b("Spencer's", "spencers.in", "grocery", ["spencers"]),
  b("Nature's Basket", "naturesbasket.co.in", "grocery", ["natures basket"]),
  b("Flipkart Minutes", "flipkart.com", "grocery"),

  // Shopping
  b("Pepperfry", "pepperfry.com", "furniture"),
  b("Urban Ladder", "urbanladder.com", "furniture"),
  b("Home Centre", "homecentre.in", "furniture"),
  b("Vijay Sales", "vijaysales.com", "electronics"),
  b("Samsung", "samsung.com", "electronics"),
  b("OnePlus", "oneplus.in", "electronics"),
  b("Xiaomi", "mi.com", "electronics", ["mi store", "xiaomi"]),
  b("Snapdeal", "snapdeal.com", "shopping"),
  b("Tira", "tirabeauty.com", "beauty", ["tira beauty"]),
  b("Plum", "plumgoodness.com", "beauty", ["plum goodness"]),
  b("Minimalist", "beminimalist.co", "beauty", ["be minimalist"]),
  b("The Man Company", "themancompany.com", "beauty"),
  b("Crossword", "crossword.in", "shopping"),

  // Health and fitness
  b("Apollo Pharmacy", "apollopharmacy.in", "pharmacy", ["apollo pharmacy", "apollo 24 7", "apollo247"]),
  b("MedPlus", "medplusmart.com", "pharmacy"),
  b("Truemeds", "truemeds.in", "pharmacy"),
  b("Practo", "practo.com", "doctor"),
  b("Dr Lal PathLabs", "lalpathlabs.com", "doctor", ["lal pathlabs", "lalpathlabs", "lal path labs"]),
  b("Thyrocare", "thyrocare.com", "doctor"),
  b("Healthians", "healthians.com", "doctor"),
  b("Max Healthcare", "maxhealthcare.in", "doctor", ["max hospital"]),
  b("Fortis", "fortishealthcare.com", "doctor", ["fortis hospital"]),
  b("Manipal Hospitals", "manipalhospitals.com", "doctor"),
  b("HealthifyMe", "healthifyme.com", "fitness"),
  b("Anytime Fitness", "anytimefitness.co.in", "fitness"),

  // Entertainment
  b("BookMyShow", "bookmyshow.com", "fun-activity", ["bigtree entertainment", "book my show"]),
  b("PVR INOX", "pvrcinemas.com", "fun-activity", ["pvr", "inox", "pvr inox"]),
  b("Cinépolis", "cinepolisindia.com", "fun-activity", ["cinepolis"]),
  b("Playo", "playo.co", "sports"),
  b("Steam", "steampowered.com", "sports", ["steam games", "valve"]),

  // Education
  b("Unacademy", "unacademy.com", "education"),
  b("BYJU'S", "byjus.com", "education", ["byjus", "think and learn"]),
  b("Physics Wallah", "pw.live", "education", ["physicswallah", "physics wallah"]),
  b("Udemy", "udemy.com", "education"),
  b("Coursera", "coursera.org", "education"),
  b("upGrad", "upgrad.com", "education"),
  b("Scaler", "scaler.com", "education", ["interviewbit"]),
  b("Duolingo", "duolingo.com", "education"),

  // Insurance
  b("LIC", "licindia.in", "insurance", ["life insurance corporation", "lic of india"]),
  b("Policybazaar", "policybazaar.com", "insurance", ["policy bazaar"]),
  b("ACKO", "acko.com", "insurance"),
  b("Digit Insurance", "godigit.com", "insurance", ["go digit", "godigit"]),
  b("HDFC Life", "hdfclife.com", "insurance"),
  b("HDFC ERGO", "hdfcergo.com", "insurance"),
  b("ICICI Prudential", "iciciprulife.com", "insurance", ["icici pru"]),
  b("ICICI Lombard", "icicilombard.com", "insurance"),
  b("Star Health", "starhealth.in", "insurance"),
  b("Niva Bupa", "nivabupa.com", "insurance", ["max bupa"]),
  b("Tata AIG", "tataaig.com", "insurance"),
  b("SBI Life", "sbilife.co.in", "insurance"),
  b("Axis Max Life", "axismaxlife.com", "insurance", ["max life"]),
  b("Care Health", "careinsurance.com", "insurance", ["care health insurance"]),

  // Loans, EMIs, cards
  b("Bajaj Finserv", "bajajfinserv.in", "emi", ["bajaj finance"]),
  b("Home Credit", "homecredit.co.in", "emi"),
  b("Tata Capital", "tatacapital.com", "emi"),
  b("Simpl", "getsimpl.com", "emi"),
  b("LazyPay", "lazypay.in", "emi"),
  b("KreditBee", "kreditbee.in", "emi"),
  b("CRED", "cred.club", "banks", ["cred club", "dreamplug"]),
  b("OneCard", "getonecard.app", "banks", ["one card"]),

  // Investments
  b("Dhan", "dhan.co", "investments", ["raise securities"]),
  b("Fyers", "fyers.in", "investments"),
  b("Jar", "myjar.app", "investments", ["jar app", "changejar"]),
  b("CAMS", "camsonline.com", "investments", ["computer age management"]),
  b("KFintech", "kfintech.com", "investments", ["kfin technologies", "karvy"]),
  b("NPS", "npstrust.org.in", "investments", ["nps trust", "national pension"]),
  b("Indian Clearing Corp", "indianclearingcorp.com", "investments", ["indian clearing corporation", "iccl"]),

  // Taxes and government
  b("Income Tax", "incometax.gov.in", "fees", ["income tax", "cbdt", "oltas", "tin nsdl"]),
  b("Parivahan", "parivahan.gov.in", "fees", ["e challan", "echallan"]),
  b("Passport Seva", "passportindia.gov.in", "fees", ["passport seva"]),

  // Gifts and donations
  b("Ferns N Petals", "fnp.com", "gifts", ["ferns n petals", "fnp"]),
  b("IGP", "igp.com", "gifts"),
  b("GiveIndia", "giveindia.org", "gifts", ["give india"]),
  b("Ketto", "ketto.org", "gifts"),
  b("Milaap", "milaap.org", "gifts"),

  // Pets
  b("Supertails", "supertails.com", "pets"),
  b("Heads Up For Tails", "headsupfortails.com", "pets", ["huft"]),

  // Homes
  b("NoBroker", "nobroker.in", "brokerage"),
  b("Housing.com", "housing.com", "brokerage"),
  b("MagicBricks", "magicbricks.com", "brokerage"),
];
