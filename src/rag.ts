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

async function search(query: string, namespace: string) {
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

  // 3. Display results
  console.log(`\n🔎 Top ${TOP_K} results for query: "${query}"\n`);

  result.matches?.forEach((match, i) => {
    console.log(`--- Result ${i + 1} [Score: ${match.score?.toFixed(4)}] ---`);
    console.log(`Chunk Index: ${match.metadata?.chunkIndex}`);
    console.log(`Book: ${match.metadata?.book}`);
    console.log(
      `Content:\n${match.metadata?.content?.toString().slice(0, 1000)}\n`
    );
  });

  const systemPrompt = `
  You are a helpful medical assistant. Answer the question below using only the provided context.
  If the context does not contain the answer, say "I couldn't find that in the book."
  `;

  const context = result.matches
    ?.map((match) => match.metadata?.content)
    .join("\n\n");

  // 4. Get Chat GPT response based on the context above:
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Context:\n${context}\n\nQuestion: ${query}` },
    ],
  });

  console.log("\n🧠 GPT Answer:\n");
  console.log(completion.choices[0].message.content);
}

// CLI usage
const [, , ...cliArgs] = process.argv;

if (cliArgs.length === 0) {
  console.error('Usage: ts-node src/rag.ts "Your medical query here"');
  process.exit(1);
}

const query = cliArgs.join(" ");
const namespace = "current-medical-diagnosis-and-treatment-2025";

search(query, namespace);
