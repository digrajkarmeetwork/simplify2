import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { MonthMatrix } from "@/lib/sales-shared";
import { monthLabel } from "@/lib/export/monthLabel";
import { money2 } from "@/lib/format";
import { weekdayShort } from "@/lib/dates";

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 9, fontFamily: "Helvetica" },
  title: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  subtitle: { fontSize: 11, color: "#666", marginBottom: 12 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: "#ddd" },
  head: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#333",
    fontFamily: "Helvetica-Bold",
  },
  totalRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderColor: "#333",
    fontFamily: "Helvetica-Bold",
  },
  cDay: { width: "15%", padding: 4 },
  cNum: { width: "17%", padding: 4, textAlign: "right" },
  cTot: { width: "17%", padding: 4, textAlign: "right" },
  closed: { color: "#999" },
});

function num(closed: boolean, v: number | null): string {
  if (closed) return "closed";
  return v === null ? "—" : money2(v);
}

function ReportDoc({
  matrix,
  businessName,
}: {
  matrix: MonthMatrix;
  businessName: string;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{businessName}</Text>
        <Text style={styles.subtitle}>
          {monthLabel(matrix.year, matrix.month)} — Daily Sales
        </Text>

        <View style={styles.head}>
          <Text style={styles.cDay}>Day</Text>
          <Text style={styles.cNum}>In-store</Text>
          <Text style={styles.cNum}>Call-center</Text>
          <Text style={styles.cNum}>Uber Eats</Text>
          <Text style={styles.cNum}>Skip</Text>
          <Text style={styles.cTot}>Total</Text>
        </View>

        {matrix.rows.map((r) => (
          <View style={styles.row} key={r.date}>
            <Text style={styles.cDay}>
              {weekdayShort(r.date)} {r.day}
            </Text>
            <Text style={r.isClosed ? [styles.cNum, styles.closed] : styles.cNum}>
              {num(r.isClosed, r.in_store)}
            </Text>
            <Text style={r.isClosed ? [styles.cNum, styles.closed] : styles.cNum}>
              {num(r.isClosed, r.call_center)}
            </Text>
            <Text style={styles.cNum}>{r.uber_eats === null ? "—" : money2(r.uber_eats)}</Text>
            <Text style={styles.cNum}>{r.skip_dishes === null ? "—" : money2(r.skip_dishes)}</Text>
            <Text style={styles.cTot}>{r.total ? money2(r.total) : ""}</Text>
          </View>
        ))}

        <View style={styles.totalRow}>
          <Text style={styles.cDay}>Total</Text>
          <Text style={styles.cNum}>{money2(matrix.totals.in_store)}</Text>
          <Text style={styles.cNum}>{money2(matrix.totals.call_center)}</Text>
          <Text style={styles.cNum}>{money2(matrix.totals.uber_eats)}</Text>
          <Text style={styles.cNum}>{money2(matrix.totals.skip_dishes)}</Text>
          <Text style={styles.cTot}>{money2(matrix.totals.total)}</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function buildPdf(
  matrix: MonthMatrix,
  businessName: string,
): Promise<Buffer> {
  return renderToBuffer(<ReportDoc matrix={matrix} businessName={businessName} />);
}
