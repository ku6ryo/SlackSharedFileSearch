import { ChatCompletionFunctions } from "openai"
import { getChatCompletionWithFuncs } from "../openai"
import { Validator } from "jsonschema"

const parameterObjectDef = {
  type: "object",
  properties: {
    category: {
      type: "string",
      description: "Category of the file.",
      enum: ["web_page", "image", "video", "audio", "slide", "spreadsheet", "document", "unknown"],
    },
    content: {
      type: "string",
      description: "What the file contains. What is in the image, what is the video about, etc. e.g. financial report. If it includes time, please change it to ISO 8601 format.",
    },
    sharedAt: {
      type: "object",
      description: "Time range when the file was shared. Please note that this is not the time that the file is for. e.g. a file about 2020 financial report can be shared in 2021. In that case, the time range is 2021. If the range is unclear, please leave it blank.",
      properties: {
        from: {
          type: "string",
          description: "ISO 8601 format. e.g. 2021-01-01T00:00:00.000Z",
        },
        to: {
          type: "string",
          description: "ISO 8601 format. e.g. 2021-01-01T00:00:00.000Z",
        },
      }
    },
    sharedBy: {
      type: "string",
      description: "Who shared the file.",
    },
  },
}

export const functions: ChatCompletionFunctions[] = [
  {
    name: "search-files-urls",
    description: "Searches files shared on text chat and returns URLs of the files.",
    parameters: parameterObjectDef,
  },
]

function isFunctionArgs(args: any): args is { category?: string, content?: string, sharedAt?: { from: string, to: string }, sharedBy?: string } {
  const v = new Validator()
  const r = v.validate(args, parameterObjectDef)
  return r.valid
}

export async function textToSearchParameters(text: string) {
  const result = await getChatCompletionWithFuncs([{
    role: "assistant",
    content: `You are a assistant who search files and web pages. Current time is ${new Date().toISOString()}}`,
  }, {
    role: "user",
    content: text,
  }], functions)
  if (!result.functionCall) {
    return null
  }
  const { arguments: argsStr, name } = result.functionCall
  if (name !== "search-files-urls") {
    return null
  }
  if (!argsStr) {
    return null
  }
  const args = JSON.parse(argsStr)
  if (!isFunctionArgs(args)) {
    return null
  }
  return args
}