import { WebClient } from "@slack/web-api"
import { envVar } from "./EnvVarManager"
import readline from "readline"
;import { randomUUID } from "crypto";
import { explainUrl } from "./indexer/explainUrl";
import { QdrantClient } from "@qdrant/js-client-rest";
import { getEmbedding } from "./openai";

(async () => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })
  const qdrant = new QdrantClient({
    url: envVar.qdrantUrl()
  })
  const indexId = await new Promise<string>((resolve) => {
    rl.question("Index ID: ", function(input) {
      resolve(input)
    })
  })
  while (true) {
    const query = await new Promise<string>((resolve) => {
      rl.question("Query: ", function(input) {
        resolve(input)
      })
    })
    const { vector } = await getEmbedding(query)
    const results = await qdrant.search(indexId, {
      vector,
      limit: 5,
    })
    for (let i = 0; i < results.length; i++) {
      const res = results[i]
      const { url } = res.payload as { url: string }
      console.log(`${i}: ${url}`)
    }
    console.log("====================================")
  }
})()