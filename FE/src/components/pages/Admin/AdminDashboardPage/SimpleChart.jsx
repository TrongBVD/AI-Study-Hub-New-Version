const COLORS = ["#7857d8", "#33a7a0", "#e6a23c", "#db5d77"];

function normalizeSeries(series) {
  return (series || []).map((item, index) => ({
    name: item?.name || `Series ${index + 1}`,
    data: Array.isArray(item?.data)
      ? item.data.map((value) => Number(value) || 0)
      : [Number(item) || 0],
  }));
}

function BarChart({ series, categories, height }) {
  const normalized = normalizeSeries(series);
  const maxValue = Math.max(
    1,
    ...normalized.flatMap((item) => item.data),
  );
  const itemCount = Math.max(
    categories.length,
    ...normalized.map((item) => item.data.length),
  );

  return (
    <div
      role="img"
      aria-label="Bar chart"
      style={{ height, display: "flex", alignItems: "end", gap: 12 }}
    >
      {Array.from({ length: itemCount }, (_, itemIndex) => (
        <div
          key={categories[itemIndex] || itemIndex}
          style={{
            flex: 1,
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "end",
            gap: 6,
            minWidth: 0,
          }}
        >
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "end",
              justifyContent: "center",
              gap: 4,
            }}
          >
            {normalized.map((item, seriesIndex) => (
              <div
                key={item.name}
                title={`${item.name}: ${item.data[itemIndex] || 0}`}
                style={{
                  width: `${Math.max(18, 70 / normalized.length)}%`,
                  minHeight: 2,
                  height: `${((item.data[itemIndex] || 0) / maxValue) * 100}%`,
                  borderRadius: "5px 5px 2px 2px",
                  background: COLORS[seriesIndex % COLORS.length],
                }}
              />
            ))}
          </div>
          <small style={{ textAlign: "center", overflow: "hidden" }}>
            {categories[itemIndex] || ""}
          </small>
        </div>
      ))}
    </div>
  );
}

function LineChart({ series, categories, height }) {
  const normalized = normalizeSeries(series);
  const values = normalized.flatMap((item) => item.data);
  const maxValue = Math.max(1, ...values);
  const pointCount = Math.max(2, ...normalized.map((item) => item.data.length));

  return (
    <div role="img" aria-label="Line chart" style={{ height }}>
      <svg viewBox="0 0 100 60" width="100%" height="90%" preserveAspectRatio="none">
        {[15, 30, 45].map((y) => (
          <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="#e9e2d9" strokeWidth="0.5" />
        ))}
        {normalized.map((item, seriesIndex) => {
          const points = item.data
            .map((value, index) => {
              const x = (index / (pointCount - 1)) * 100;
              const y = 56 - (value / maxValue) * 50;
              return `${x},${y}`;
            })
            .join(" ");
          return (
            <polyline
              key={item.name}
              points={points}
              fill="none"
              stroke={COLORS[seriesIndex % COLORS.length]}
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        {categories.map((category) => <small key={category}>{category}</small>)}
      </div>
    </div>
  );
}

function DonutChart({ series, height }) {
  const values = (series || []).map((value) => Number(value) || 0);
  const total = Math.max(1, values.reduce((sum, value) => sum + value, 0));
  const stops = values.reduce(
    (result, value, index) => {
      const end = result.cursor + (value / total) * 360;
      return {
        cursor: end,
        values: [
          ...result.values,
          `${COLORS[index % COLORS.length]} ${result.cursor}deg ${end}deg`,
        ],
      };
    },
    { cursor: 0, values: [] },
  ).values;

  return (
    <div
      role="img"
      aria-label="Donut chart"
      style={{ height, display: "grid", placeItems: "center" }}
    >
      <div
        style={{
          width: Math.min(height - 24, 190),
          aspectRatio: "1",
          borderRadius: "50%",
          background: `conic-gradient(${stops.join(", ")})`,
          display: "grid",
          placeItems: "center",
        }}
      >
        <strong
          style={{
            width: "62%",
            aspectRatio: "1",
            borderRadius: "50%",
            background: "#fff",
            display: "grid",
            placeItems: "center",
            fontSize: 24,
          }}
        >
          {values.reduce((sum, value) => sum + value, 0)}
        </strong>
      </div>
    </div>
  );
}

export default function SimpleChart({
  options = {},
  series = [],
  type = "bar",
  height = 260,
}) {
  const categories = options?.xaxis?.categories || [];

  if (type === "donut") {
    return <DonutChart series={series} height={height} />;
  }
  if (type === "line") {
    return <LineChart series={series} categories={categories} height={height} />;
  }
  return <BarChart series={series} categories={categories} height={height} />;
}
