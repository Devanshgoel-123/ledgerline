const LINES = [
  {
    raw: "UPI-SWIGGY-swiggy@ybl-YESB0000001-402981734512-UPI",
    name: "Swiggy",
    category: "Food",
    amount: "₹349",
  },
  {
    raw: "UPI-RAPIDO-rapido.bike@axisbank-UTIB0000100-402981739021-UPI",
    name: "Rapido",
    category: "Rides",
    amount: "₹86",
  },
  {
    raw: "UPI-NIKHIL SHARMA-nikhil.s@oksbi-SBIN0001234-402981740115-UPI",
    name: "Nikhil Sharma",
    category: "People",
    amount: "₹500",
  },
];

/** The hero: lines as a bank prints them, and the ledger lines Ledgerline makes of them. */
export function LedgerSpecimen() {
  return (
    <figure className="specimen">
      <ol className="specimen-list">
        {LINES.map((line, index) => (
          <li key={line.raw} className="specimen-row" style={{ ["--i" as string]: index }}>
            <code className="specimen-raw">{line.raw}</code>
            <div className="specimen-parsed">
              <span className="specimen-name">{line.name}</span>
              <span className="specimen-category">{line.category}</span>
              <span className="specimen-amount">{line.amount}</span>
            </div>
          </li>
        ))}
      </ol>
      <figcaption className="site-small site-muted">
        Statement lines as your bank prints them, and what Ledgerline makes of them. Made-up
        examples.
      </figcaption>
    </figure>
  );
}
