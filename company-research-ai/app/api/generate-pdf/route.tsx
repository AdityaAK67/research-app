import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer";
import { NextRequest, NextResponse } from "next/server";

interface Competitor {
  name: string;
  website: string;
}

interface ResearchResult {
  companyName: string;
  website: string;
  summary: string;
  products: string[];
  painPoints: string[];
  competitors: Competitor[];
}

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 12,
    fontFamily: "Helvetica",
  },

  title: {
    fontSize: 24,
    marginBottom: 20,
    fontWeight: "bold",
  },

  heading: {
    fontSize: 16,
    marginTop: 15,
    marginBottom: 8,
    fontWeight: "bold",
  },

  text: {
    marginBottom: 6,
    lineHeight: 1.6,
  },

  item: {
    marginLeft: 12,
    marginBottom: 4,
  },

  competitor: {
    marginBottom: 8,
  },

  website: {
    color: "#2563eb",
    marginBottom: 8,
  },
});

export async function POST(req: NextRequest) {
  try {
    const data: ResearchResult = await req.json();

    if (
      !data ||
      !data.companyName ||
      !data.summary ||
      !data.website
    ) {
      return NextResponse.json(
        {
          error: "Invalid research data supplied.",
        },
        {
          status: 400,
        }
      );
    }

    const document = (
      <Document>
        <Page size="A4" style={styles.page}>

          <Text style={styles.title}>
            {data.companyName} Research Report
          </Text>

          <Text style={styles.heading}>
            Website
          </Text>

          <Text style={styles.website}>
            {data.website}
          </Text>

          <Text style={styles.heading}>
            Executive Summary
          </Text>

          <Text style={styles.text}>
            {data.summary}
          </Text>

          <Text style={styles.heading}>
            Products & Services
          </Text>

          {data.products.map((product, index) => (
            <Text
              key={index}
              style={styles.item}
            >
              • {product}
            </Text>
          ))}

          <Text style={styles.heading}>
            Pain Points
          </Text>

          {data.painPoints.map((point, index) => (
            <Text
              key={index}
              style={styles.item}
            >
              • {point}
            </Text>
          ))}

          <Text style={styles.heading}>
            Competitors
          </Text>

          {data.competitors.map((competitor, index) => (
            <View
              key={index}
              style={styles.competitor}
            >
              <Text>
                {competitor.name}
              </Text>

              <Text style={styles.website}>
                {competitor.website}
              </Text>
            </View>
          ))}

        </Page>
      </Document>
    );

    const blob = await pdf(document).toBlob();

    const buffer = Buffer.from(
      await blob.arrayBuffer()
    );

    return new Response(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${data.companyName.replace(
          /\s+/g,
          "_"
        )}_Research_Report.pdf"`,
      },
    });
  } catch (error) {
    console.error("PDF Generation Error:", error);

    return NextResponse.json(
      {
        error: "Failed to generate PDF.",
      },
      {
        status: 500,
      }
    );
  }
}