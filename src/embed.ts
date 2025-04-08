import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";
import { config as dotenvConfig } from "dotenv";
import { Pinecone } from "@pinecone-database/pinecone";
import { OpenAI } from "openai";

dotenvConfig();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const pinecone = new Pinecone();
const index = pinecone.Index(process.env.PINECONE_INDEX_NAME!);

type Chunk = {
  content: string;
  book: string;
  chunkIndex: number;
};

const EMBEDDING_MODEL = "text-embedding-3-small";
const BATCH_SIZE = 100;
const PROGRESS_FILE = "progress.json";
const RETRY_DELAY_MS = 1000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function retry<T>(fn: () => Promise<T>, retries = 5): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      console.log(" err:", err);

      attempt++;
      if (attempt >= retries) throw err;
      const delay = RETRY_DELAY_MS * 2 ** (attempt - 1);
      console.warn(`Retrying after ${delay}ms (attempt ${attempt})...`);
      await sleep(delay);
    }
  }
}

async function embedChunks(filePath: string) {
  const absolutePath = path.resolve(filePath);
  const raw = readFileSync(absolutePath, "utf-8");
  const chunks: Chunk[] = JSON.parse(raw);

  const namespace = chunks[0]?.book
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]/g, "");

  console.log(`Uploading ${chunks.length} chunks to namespace: ${namespace}`);

  let uploadedCount = 0;
  if (existsSync(PROGRESS_FILE)) {
    const progress = JSON.parse(readFileSync(PROGRESS_FILE, "utf-8"));
    uploadedCount = progress[namespace] || 0;
    console.log(`Resuming from batch ${uploadedCount / BATCH_SIZE + 1}`);
  }

  for (let i = uploadedCount; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);

    const embeddings = await retry(() =>
      openai.embeddings.create({
        input: batch.map((c) => c.content),
        model: EMBEDDING_MODEL,
      })
    );

    const vectors = batch.map((chunk, j) => ({
      id: `${namespace}-chunk-${chunk.chunkIndex}`,
      values: embeddings.data[j].embedding,
      metadata: {
        book: chunk.book,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
      },
    }));

    await retry(() => index.namespace(namespace).upsert(vectors));

    const newProgress = { [namespace]: i + BATCH_SIZE };
    writeFileSync(PROGRESS_FILE, JSON.stringify(newProgress, null, 2));

    console.log(`✅ Uploaded batch ${i / BATCH_SIZE + 1}`);
  }

  console.log("🎉 All chunks embedded and uploaded to Pinecone.");
}

// CLI usage
const [, , inputFile] = process.argv;
if (!inputFile) {
  console.error("Usage: ts-node src/embed.ts path/to/chunks.json");
  process.exit(1);
}

embedChunks(inputFile);
