/** Silueta de una lista mientras cargan los datos locales; ocupa lo mismo que las filas reales. */
export function Skeleton({ rows }: { rows: number }) {
  return (
    <div className="list skeleton" aria-busy="true" aria-label="Cargando">
      {Array.from({ length: rows }, (_, i) => (
        <div className="row" key={i}>
          <span className="sk" style={{ width: 40, height: 14 }} />
          <span className="sk" style={{ width: 40, height: 40, borderRadius: 12 }} />
          <span className="row-body" style={{ gap: 8 }}>
            <span className="sk" style={{ width: '55%', height: 14 }} />
            <span className="sk" style={{ width: '35%', height: 12 }} />
          </span>
        </div>
      ))}
    </div>
  );
}
