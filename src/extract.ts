import fs from "fs";
import path from "path";
import pdfParse from "pdf-parse";

export async function extractTextFromPDF(
  pdfPath: string,
  maxPages?: number
): Promise<string> {
  const buffer = fs.readFileSync(pdfPath);
  const data = await pdfParse(buffer);

  if (!maxPages) return data.text;

  const pages = data.text.split("\n\n");
  return pages.slice(0, maxPages).join("\n\n");
}

async function main() {
  const [mode, filePath, bookTitle] = process.argv.slice(2);

  if (!mode || !filePath || !bookTitle) {
    console.error(
      'Usage:\n  ts-node src/extract.ts <extract|test> "path/to/pdf.pdf" "Book Title"'
    );
    process.exit(1);
  }

  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) {
    console.error(`File not found: ${absPath}`);
    process.exit(1);
  }

  const isTest = mode === "test";
  const maxPages = isTest ? 50 : undefined;
  const extractedText = await extractTextFromPDF(absPath, maxPages);

  console.log(`\n📘 Book: ${bookTitle}`);
  console.log(`📄 Extraction mode: ${mode}\n`);

  if (isTest) {
    const testOutputDir = "./data/test_extractions";
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }

    const outputPath = path.join(
      testOutputDir,
      `sample_${bookTitle.toLowerCase().replace(/\s+/g, "-")}_${new Date()
        .toISOString()
        .replace(/[:.]/g, "-")}.txt`
    );

    fs.writeFileSync(outputPath, extractedText);
    console.log(`✅ Test extraction saved to: ${outputPath}`);
  } else {
    const outputDir = "./data/extractions";

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, `${bookTitle}.txt`);

    fs.writeFileSync(outputPath, extractedText);
  }
}

if (require.main === module) {
  main();
}
