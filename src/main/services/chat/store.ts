/** Reads and appends `chat.jsonl` for lessons. Append-only; damaged lines are skipped, never fatal. */
import { readFile } from 'node:fs/promises'
import { appendJsonl } from '../fsx'
import { parseChatRecord, type ChatRecord } from './records'

/** Where a message is stored: what Generation, Chat and Plugins write to. */
export interface ChatLog {
  append(lessonId: string, record: ChatRecord): Promise<void>
}

export class ChatStore implements ChatLog {
  /** `pathOf` gives the `chat.jsonl` path of a lesson. */
  constructor(private readonly pathOf: (lessonId: string) => string) {}

  append(lessonId: string, record: ChatRecord): Promise<void> {
    return appendJsonl(this.pathOf(lessonId), record)
  }

  /** Every readable record, oldest first. */
  async read(lessonId: string): Promise<ChatRecord[]> {
    let text: string
    try {
      text = await readFile(this.pathOf(lessonId), 'utf8')
    } catch {
      return []
    }
    const records: ChatRecord[] = []
    for (const line of text.split('\n')) {
      if (!line.trim()) continue
      try {
        const record = parseChatRecord(JSON.parse(line))
        if (record) records.push(record)
      } catch {
        // a half-written last line after a crash: skip it
      }
    }
    return records
  }

  /** The Claude conversation so far: every record's `api` messages, in order. */
  async apiHistory(lessonId: string): Promise<unknown[]> {
    return (await this.read(lessonId)).flatMap((record) => record.api)
  }
}
