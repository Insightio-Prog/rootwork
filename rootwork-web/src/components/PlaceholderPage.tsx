export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="placeholder-page">
      <div className="card elev-md placeholder-card">
        <div className="placeholder-kicker">Coming later</div>
        <h3>{title}</h3>
        <p>
          This view is not in this build. The Family Tree ancestor chart is the working
          screen.
        </p>
      </div>
    </div>
  );
}
