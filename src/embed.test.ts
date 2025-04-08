import { readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";
import { config as dotenvConfig } from "dotenv";
import { OpenAI } from "openai";

dotenvConfig();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

type Chunk = {
  content: string;
  book: string;
  chunkIndex: number;
};

const EMBEDDING_MODEL = "text-embedding-3-small";
const BATCH_SIZE = 100;

async function embedChunksForTest(filePath: string) {
  const absolutePath = path.resolve(filePath);
  const raw = readFileSync(absolutePath, "utf-8");
  const chunks: Chunk[] = JSON.parse(raw);

  const namespace = chunks[0]?.book
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]/g, "");

  const results: any[] = [];

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);

    const embeddings = await openai.embeddings.create({
      input: batch.map((c) => c.content),
      model: EMBEDDING_MODEL,
    });

    const vectors = batch.map((chunk, j) => ({
      id: `${namespace}-chunk-${chunk.chunkIndex}`,
      values: embeddings.data[j].embedding,
      metadata: {
        book: chunk.book,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
      },
    }));

    results.push(...vectors);
    console.log(`Processed batch ${i / BATCH_SIZE + 1}`);
  }

  const outDir = path.resolve("data/test_embeddings");
  mkdirSync(outDir, { recursive: true });

  const outPath = path.join(outDir, `${namespace}-embeddings.json`);
  writeFileSync(outPath, JSON.stringify(results, null, 2));

  console.log(`✅ Embedding test output written to: ${outPath}`);
}

// CLI usage
const [, , inputFile] = process.argv;
if (!inputFile) {
  console.error("Usage: ts-node src/embed.test.ts path/to/chunks.json");
  process.exit(1);
}

embedChunksForTest(inputFile);
