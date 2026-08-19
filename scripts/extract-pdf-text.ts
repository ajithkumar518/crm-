// @ts-nocheck
/**
 * Extract text from both PDFs for side-by-side comparison.
 */
import { PDFParse } from "pdf-parse";
import { readFileSync } from "fs";

async function main() {
  const files = [
    { label: "CURRENT (wrong) format", path: "C:\\Users\\ajithkumar\\Downloads\\QT-2026-00007-R1 (1).pdf" },
    { label: "REFERENCE (correct) format", path: "C:\\Users\\ajithkumar\\Downloads\\QT-2026-00007-R1.pdf" },
  ];

  for (const f of files) {
    console.log(`\n${"=".repeat(80)}`);
    console.log(`=== ${f.label}: ${f.path} ===`);
    console.log(`${"=".repeat(80)}`);
    try {
      const buf = readFileSync(f.path);
      const uint8 = new Uint8Array(buf);
      const parser = new PDFParse(uint8);
      const data = await parser.getText();
      console.log(`\n--- Extracted text (${data.length} chars) ---\n`);
      console.log(data);
    } catch (err: any) {
      console.log(`Error: ${err.message}`);
    }
  }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
