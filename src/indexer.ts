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
  const indexId = randomUUID()
  console.log(`Index ID: ${indexId}`)
  const qdrant = new QdrantClient({
    url: envVar.qdrantUrl()
  })
  await qdrant.createCollection(indexId, {
    vectors: {
      size: 1536,
      distance: "Cosine",
    }
  })
  await qdrant.createPayloadIndex(indexId, {
    field_name: "url",
    field_schema: "keyword",
    wait: true,
  })
  const channelId = await new Promise<string>((resolve) => {
    rl.question("Channel ID: ", function(input) {
      resolve(input)
    })
  })
  const slack = new WebClient(envVar.slackBotToken())

  let cursor: string | null = null
  let hasMore = true

  while (hasMore) {
    const result = await slack.conversations.history({
      channel: channelId,
      cursor: cursor || undefined,
    });
    const { messages, has_more, response_metadata } = result
    if (response_metadata === undefined) {
      throw new Error("response_metadata is undefined")
    }
    if (messages === undefined) {
      continue
    }
    const filtered = messages.filter((msg) => {
      return msg.type === "message" && msg.subtype === undefined
    })
    hasMore = false
    cursor = response_metadata.next_cursor || null
    for (const msg of filtered) {
      if (msg.ts) {
        const results = await fetchReplies(channelId, msg.ts)
        for (const r of results) {
          const { url, explanations } = r
          for (const explanation of explanations) {
            const { vector } = await getEmbedding(explanation)
            await qdrant.upsert(indexId, {
              wait: true,
              points: [
                {
                  id: randomUUID(),
                  vector,
                  payload: {
                    url,
                  },
                },
              ],
            })
          }
        }
      }
    }
  }
  console.log("Index ID: ", indexId)
  process.exit(0)
})()


async function fetchReplies(channelId: string, ts: string) {
  const client = new WebClient(envVar.slackBotToken())
  let cursor: string | null = null;
  let hasMore = true
  const totalResults: { url: string, explanations: string[], id: string }[] = []
  while (hasMore) {
    const result = await client.conversations.replies({
      channel: channelId,
      ts: ts,
    })
    const { messages, has_more, response_metadata } = result
    if (response_metadata === undefined) {
      throw new Error("response_metadata is undefined")
    }
    if (messages === undefined) {
      throw new Error("messages is undefined")
    }
    const filtered = messages.filter((msg) => {
      return msg.type === "message"
    })
    for (const msg of filtered) {
      const { text, ts, user, thread_ts, team } = msg
      if (text === undefined || ts === undefined || user === undefined) {
        console.log("skipping because of undefined properties")
        // console.log(text, ts, user, team)
        continue
      }
      const match = text.match(/<(https?:\/\/[^>]+)>/g)
      if (!match) {
        continue
      }
      const urls = match.map((m) => m.replace(/[<>]/g, "").split("|")[0])
      const id = `${team}:${channelId}:${ts}${thread_ts ? `:${thread_ts}` : ""}`
      const results: { url: string, explanations: string[], id: string }[] = []
      for (const url of urls) {
        const args = await explainUrl(url, text)
        console.log("+++++++++++++++++")
        console.log("+++++++++++++++++")
        if (args) {
          results.push({
            id,
            url,
            explanations: args.explanations,
          })
        }
      }
      totalResults.push(...results)
    }
    hasMore = !!has_more
    cursor = response_metadata.next_cursor || null
  }
  return totalResults
}