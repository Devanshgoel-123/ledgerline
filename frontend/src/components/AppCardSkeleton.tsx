export function AppCardSkeleton() {
  return (
    <article className="app-card" aria-busy="true">
      <div className="app-card-head">
        <div className="skeleton" style={{ width: "2.5rem", height: "2.5rem", borderRadius: "6px" }} />
        <div className="app-card-id" style={{ flex: 1 }}>
          <div className="skeleton" style={{ width: "70%", height: "0.9rem", marginBottom: "0.35rem" }} />
          <div className="skeleton" style={{ width: "90%", height: "0.65rem" }} />
        </div>
      </div>
      <div className="skeleton" style={{ width: "100%", height: "2rem" }} />
      <div>
        <div className="skeleton" style={{ width: "3.5rem", height: "0.6rem", marginBottom: "0.4rem" }} />
        <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ width: "5rem", height: "1.15rem", borderRadius: "999px" }} />
          ))}
        </div>
      </div>
    </article>
  );
}
