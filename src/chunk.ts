import fs from "fs";
import path from "path";
import { encode } from "gpt-3-encoder";

interface Chunk {
  content: string;
  book: string;
  chunkIndex: number;
}

function cleanText(raw: string): string {
  return raw
    .replace(/-\n/g, "") // fix hyphenated words
    .replace(/\n+/g, " ") // merge line breaks
    .replace(/\s+/g, " ") // normalize whitespace
    .trim();
}

export function chunkText(
  text: string,
  book: string,
  maxTokens = 400
): Chunk[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const chunks: Chunk[] = [];

  let currentChunk = "";
  let tokenCount = 0;
  let chunkIndex = 0;

  for (const para of paragraphs) {
    const paraTokenCount = encode(para).length;

    if (tokenCount + paraTokenCount > maxTokens) {
      if (currentChunk) {
        chunks.push({ content: currentChunk.trim(), book, chunkIndex });
        chunkIndex++;
        currentChunk = "";
        tokenCount = 0;
      }

      if (paraTokenCount > maxTokens) {
        const sentences = para.split(/(?<=[.?!])\s+/);
        let sentenceChunk = "";
        let sentenceTokens = 0;

        for (const sentence of sentences) {
          const sentenceTokenCount = encode(sentence).length;

          if (sentenceTokens + sentenceTokenCount > maxTokens) {
            chunks.push({ content: sentenceChunk.trim(), book, chunkIndex });
            chunkIndex++;
            sentenceChunk = "";
            sentenceTokens = 0;
          }

          sentenceChunk += sentence + " ";
          sentenceTokens += sentenceTokenCount;
        }

        if (sentenceChunk.trim()) {
          chunks.push({ content: sentenceChunk.trim(), book, chunkIndex });
          chunkIndex++;
        }
      } else {
        currentChunk = para + " ";
        tokenCount = paraTokenCount;
      }
    } else {
      currentChunk += para + " ";
      tokenCount += paraTokenCount;
    }
  }

  if (currentChunk.trim()) {
    chunks.push({ content: currentChunk.trim(), book, chunkIndex });
  }

  return chunks;
}

async function main() {
  const [mode, inputPath, bookTitle] = process.argv.slice(2);

  if (!mode || !inputPath || !bookTitle) {
    console.error(
      'Usage: ts-node src/chunk.ts <chunk|test> "path/to/text.txt" "Book Title"'
    );
    process.exit(1);
  }

  const absPath = path.resolve(inputPath);
  if (!fs.existsSync(absPath)) {
    console.error(`File not found: ${absPath}`);
    process.exit(1);
  }

  let raw = fs.readFileSync(absPath, "utf-8");

  if (mode === "test") {
    raw = raw.slice(0, 15000);
  }

  const cleaned = cleanText(raw);
  const chunks = chunkText(cleaned, bookTitle);

  const outputDir = mode === "test" ? "./data/test_chunks" : "./data/chunks";
  fs.mkdirSync(outputDir, { recursive: true });

  const outputPath = path.join(
    outputDir,
    `${bookTitle.toLowerCase().replace(/\s+/g, "-")}_${mode}_chunks.json`
  );

  fs.writeFileSync(outputPath, JSON.stringify(chunks, null, 2));
  console.log(`Chunked ${chunks.length} passages. Saved to ${outputPath}`);
}

if (require.main === module) {
  main();
}
