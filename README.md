This repository is used to:

1. Extract the PDF book into text.
2. Turn the text into text chunks for batching the embeddings and uploads.
3. Embed these chunks with OpenAI's `text-embedding-3-small` model and upload them to a Pinecone index in batches, with retry functionality. The pinecone upload will contain metadata such as the chunkIndex, the book name and the chunk's text content.
4. Test the RAG search functionality

## Commands:

Extract PDF to text:

```bash
npx ts-node extract.ts <test|extract> path/to/file.pdf "Name of the book"
```

- The name of the book will be used as metadata when inserting into the Pinecone database.
- Use `test` to only extract a fraction of the PDF into text.
- All commands will output to the `data` directory.

Turn text into chunks:

```bash
npx ts-node src/chunk.ts <test|chunk> path/to/file.txt "Name of the book"
```

- The name of the book is used as metadata later.
- Use `test` to test by chunking just a fraction of the full text file.

Embed all chunks with the OpenAI API and upload to Pinecone:

```bash
npx ts-node src/embed.ts path/to/chunks.json
```

To test the embedding process beforehand:

```bash
npx ts-node src/embed.test.ts path/to/chunks.json
```

RAG Search:

```bash
npx ts-node src/rag.ts "Your query here" "pinecone-index-namespace"
```
