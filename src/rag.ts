import { config as dotenvConfig } from "dotenv";
import { OpenAI } from "openai";
import { Pinecone } from "@pinecone-database/pinecone";

dotenvConfig();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const pinecone = new Pinecone();
const index = pinecone.index(process.env.PINECONE_INDEX_NAME!);

const EMBEDDING_MODEL = "text-embedding-3-small";
const TOP_K = 5;

/**
 * Search for a query in a specific Pinecone namespace.
 * This function embeds the query using OpenAI's embedding model,
 * then queries Pinecone for the most relevant results.
 * It logs the results for debugging and returns the context.
 */
export async function search(query: string, namespace: string) {
  // 1. Embed the query
  const embeddingResponse = await openai.embeddings.create({
    input: query,
    model: EMBEDDING_MODEL,
  });

  const queryEmbedding = embeddingResponse.data[0].embedding;

  // 2. Query Pinecone
  const result = await index.namespace(namespace).query({
    vector: queryEmbedding,
    topK: TOP_K,
    includeMetadata: true,
  });

  // 3. Log results for debugging
  console.log(`\n🔎 Top ${TOP_K} results for query: "${query}"\n`);

  result.matches?.forEach((match, i) => {
    console.log(`--- Result ${i + 1} [Score: ${match.score?.toFixed(4)}] ---`);
    console.log(`Chunk Index: ${match.metadata?.chunkIndex}`);
    console.log(`Book: ${match.metadata?.book}`);
    console.log(
      `Content:\n${match.metadata?.content?.toString().slice(0, 1000)}\n`
    );
  });

  const context = result.matches
    ?.map((match) => match.metadata?.content)
    .join("\n\n");

  return context;
}

// CLI usage
if (require.main === module) {
  const [, , query, namespace] = process.argv;

  if (!query || !namespace) {
    console.error(
      'Usage: ts-node src/app/rag.ts "Your query here" "pinecone-index-namespace"'
    );
    process.exit(1);
  }

  search(query, namespace);
}
