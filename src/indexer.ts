import { WebClient } from "@slack/web-api"
import { envVar } from "./EnvVarManager"

;(async () => {
  const client = new WebClient(envVar.slackBotToken())

  const channelId = "C05C3PSPR7S"

  let cursor: string | null = null
  let hasMore = true

  while (hasMore) {
    const result = await client.conversations.history({
      channel: channelId,
      cursor: cursor || undefined,
    });
    const { messages: msgs , has_more, response_metadata } = result
    if (response_metadata === undefined) {
      throw new Error("response_metadata is undefined")
    }
    if (msgs === undefined) {
      continue
    }
    const filtered = msgs.filter((msg) => {
      return msg.type === "message" && msg.subtype === undefined
    })
    hasMore = false
    cursor = response_metadata.next_cursor || null
    for (const msg of msgs) {
      if (msg.ts) {
        console.log("message")
        console.log(msg)
        await fetchReplies(channelId, msg.ts)
      }
    }
  }
})()


async function fetchReplies(channelId: string, ts: string) {
  const client = new WebClient(envVar.slackBotToken())
  let hasMore = true;
  let cursor: string | null = null;
  while (hasMore) {
    const result = await client.conversations.replies({
      channel: channelId,
      ts: ts,
    })
    const { messages: msgs, has_more, response_metadata } = result
    if (response_metadata === undefined) {
      throw new Error("response_metadata is undefined")
    }
    if (msgs === undefined) {
      continue
    }
    const filtered = msgs.filter((msg) => {
      return msg.type === "message"
    })
    console.log("replies")
    console.log(filtered)
    hasMore = false
    cursor = response_metadata.next_cursor || null
  }
}