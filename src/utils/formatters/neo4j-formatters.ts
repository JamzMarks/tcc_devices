export function mapNode(node: any): any {
  const props = node.properties;

  const mapped = {
    id: "",
  };

  for (const key of Object.keys(props)) {
    const value = props[key];

    // DateTime
    if (value.constructor?.name === "DateTime") {
      mapped[key] = neo4jDateTimeToISO(value);
    }
    // Integer
    else if (value.low !== undefined && value.high !== undefined) {
      mapped[key] = value.toNumber();
    }
    // Outros tipos (string, boolean)
    else {
      mapped[key] = value;
    }
  }

  // Adicionar id único do Neo4j
  mapped.id = node.elementId;

  return mapped;
}

export function neo4jDateTimeToISO(dt): string | null {
  if (!dt) return null;

  const y = dt.year.toNumber();
  const m = dt.month.toNumber();
  const d = dt.day.toNumber();
  const h = dt.hour.toNumber();
  const min = dt.minute.toNumber();
  const s = dt.second.toNumber();

  return new Date(Date.UTC(y, m - 1, d, h, min, s)).toISOString();
}
