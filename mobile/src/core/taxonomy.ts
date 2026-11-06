/**
 * The phone app's built-in categories.
 *
 * Every slug the backend knows (backend/src/enums/category.ts) is kept, so
 * saved entries, rules and the shared statement parser keep working; this
 * file only arranges them into a tree people recognise and adds the everyday
 * categories that were missing (bills, subscriptions, education, EMIs,
 * insurance, income). A test checks that no backend slug is dropped.
 *
 * kind decides where a category is offered: money out, money in, or moves
 * between your own accounts.
 */
export type CategoryKind = "expense" | "income" | "transfer";

export interface TaxonomyNode {
  slug: string;
  label: string;
  blurb: string;
  kind: CategoryKind;
  children?: { slug: string; label: string; blurb: string }[];
}

export const TAXONOMY: TaxonomyNode[] = [
  {
    slug: "food",
    label: "Food & dining",
    blurb: "Swiggy · Zomato · takeaway",
    kind: "expense",
    children: [
      { slug: "dinner", label: "Restaurants", blurb: "Eating out · bars" },
      { slug: "cafes", label: "Cafés & snacks", blurb: "Coffee · chai · bakeries" },
    ],
  },
  { slug: "grocery", label: "Groceries", blurb: "Blinkit · Zepto · BigBasket · kirana", kind: "expense" },
  {
    slug: "shopping",
    label: "Shopping",
    blurb: "Amazon · Flipkart · Myntra",
    kind: "expense",
    children: [
      { slug: "clothing", label: "Clothes & shoes", blurb: "Fashion · footwear" },
      { slug: "electronics", label: "Electronics", blurb: "Phones · gadgets · appliances" },
      { slug: "beauty", label: "Beauty", blurb: "Nykaa · skincare · makeup" },
    ],
  },
  {
    slug: "transport",
    label: "Transport",
    blurb: "Cabs · fuel · metro",
    kind: "expense",
    children: [
      { slug: "rides", label: "Cabs & autos", blurb: "Uber · Ola · Rapido" },
      { slug: "petrol", label: "Fuel", blurb: "Petrol · diesel · CNG" },
      { slug: "public-transport", label: "Metro & bus", blurb: "Metro cards · city buses" },
      { slug: "scooty-rental", label: "Vehicle rental", blurb: "Bikes · scooters · cars" },
      { slug: "parking", label: "Parking & tolls", blurb: "FASTag · parking" },
    ],
  },
  {
    slug: "travel",
    label: "Travel",
    blurb: "Flights · trains · hotels",
    kind: "expense",
    children: [
      { slug: "flights", label: "Flights", blurb: "IndiGo · Air India" },
      { slug: "trains", label: "Trains & buses", blurb: "IRCTC · redBus" },
      { slug: "stays", label: "Hotels & stays", blurb: "OYO · Airbnb" },
    ],
  },
  {
    slug: "bills",
    label: "Bills & utilities",
    blurb: "Electricity · phone · internet",
    kind: "expense",
    children: [
      { slug: "electricity", label: "Electricity", blurb: "Power bills" },
      { slug: "mobile-recharge", label: "Mobile", blurb: "Recharges · postpaid" },
      { slug: "internet", label: "Internet & TV", blurb: "Broadband · DTH" },
      { slug: "gas-water", label: "Gas & water", blurb: "LPG · piped gas · water" },
    ],
  },
  {
    slug: "household",
    label: "Home",
    blurb: "Rent · help · furniture",
    kind: "expense",
    children: [
      { slug: "rent", label: "Rent", blurb: "House rent" },
      { slug: "home-services", label: "Help & services", blurb: "Cook · maid · repairs" },
      { slug: "furniture", label: "Furniture & decor", blurb: "IKEA · Wakefit" },
      { slug: "brokerage", label: "Agent fees & deposits", blurb: "House brokers · security deposits" },
      { slug: "passed-on", label: "Paid for someone", blurb: "Someone else's money you passed on" },
    ],
  },
  { slug: "subscriptions", label: "Subscriptions", blurb: "Netflix · Spotify · apps", kind: "expense" },
  {
    slug: "outing",
    label: "Entertainment",
    blurb: "Movies · events · games",
    kind: "expense",
    children: [
      { slug: "fun-activity", label: "Movies & events", blurb: "BookMyShow · concerts" },
      { slug: "sports", label: "Sports & games", blurb: "Turf · games · play" },
    ],
  },
  {
    slug: "healthcare",
    label: "Health",
    blurb: "Doctors · medicines · gym",
    kind: "expense",
    children: [
      { slug: "pharmacy", label: "Medicines", blurb: "Chemist · PharmEasy · 1mg" },
      { slug: "doctor", label: "Doctors & tests", blurb: "Clinics · labs · hospitals" },
      { slug: "fitness", label: "Gym & fitness", blurb: "Cult · gym · yoga" },
    ],
  },
  {
    slug: "personal",
    label: "Personal care",
    blurb: "Salon · grooming",
    kind: "expense",
    children: [
      { slug: "salon", label: "Salon & grooming", blurb: "Haircut · parlour" },
      { slug: "random-expense", label: "Miscellaneous", blurb: "Unplanned personal spend" },
    ],
  },
  { slug: "education", label: "Education", blurb: "Fees · courses · books", kind: "expense" },
  {
    slug: "family",
    label: "Family & kids",
    blurb: "Parents · kids · pets",
    kind: "expense",
    children: [{ slug: "pets", label: "Pets", blurb: "Food · vet · grooming" }],
  },
  { slug: "gifts", label: "Gifts & donations", blurb: "Presents · charity", kind: "expense" },
  {
    slug: "vices",
    label: "Drinks & smokes",
    blurb: "Alcohol · cigarettes",
    kind: "expense",
    children: [
      { slug: "booze", label: "Drinks", blurb: "Alcohol" },
      { slug: "cigarettes", label: "Smokes", blurb: "Cigarettes" },
    ],
  },
  { slug: "emi", label: "Loans & EMI", blurb: "EMIs · loan repayments", kind: "expense" },
  { slug: "insurance", label: "Insurance", blurb: "Health · life · vehicle", kind: "expense" },
  { slug: "fees", label: "Taxes & fees", blurb: "Tax · government · charges", kind: "expense" },
  { slug: "investments", label: "Investments", blurb: "SIPs · stocks · mutual funds", kind: "transfer" },
  {
    slug: "transfers",
    label: "Transfers",
    blurb: "Between your own accounts",
    kind: "transfer",
    children: [
      { slug: "self-transfer", label: "Between my accounts", blurb: "Moving your own money" },
      { slug: "banks", label: "Card & bank payments", blurb: "Credit card bills · bank charges" },
      { slug: "cash", label: "Cash withdrawal", blurb: "ATM" },
    ],
  },
  {
    slug: "income",
    label: "Income",
    blurb: "Salary · refunds · interest",
    kind: "income",
    children: [
      { slug: "salary", label: "Salary", blurb: "Pay · stipend" },
      { slug: "from-home", label: "From family", blurb: "Money from home" },
      { slug: "refunds", label: "Refunds & cashback", blurb: "Returns · cashback" },
      { slug: "interest", label: "Interest & dividends", blurb: "Savings · FDs · stocks" },
      { slug: "other-income", label: "Other income", blurb: "Freelance · selling things" },
    ],
  },
  { slug: "other", label: "Other", blurb: "Anything else", kind: "expense" },
];

/**
 * Categories that move your own money rather than spend it. The shared totals
 * code already leaves out salary, bank and self-transfers; these new ones are
 * treated like a self-transfer before totals are worked out.
 */
export const NOT_SPENDING = new Set(["cash", "transfers"]);
