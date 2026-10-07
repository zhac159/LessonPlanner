/**
 * What the fake AI answers to `structured()` when the caller (a test) did not set `structuredReply`: the first
 * canned reply that the request's own schema accepts. Plugins ask for their own schemas, so matching by schema
 * (not by prompt) keeps this honest: a request nothing here fits still fails as "the demo AI cannot fill this schema".
 */
import type { StructuredRequest } from '@shared/ai/types'

type Request = Pick<StructuredRequest<unknown>, 'schema'>

const question = (type: 'mcq' | 'tf', n: number) =>
  type === 'mcq'
    ? {
        type,
        question: `Which of these does a plant need for photosynthesis? (question ${n})`,
        options: ['Light', 'Plastic', 'Sand', 'Sound'],
        answer: 'Light',
        explanation: 'Plants use light energy to make food.'
      }
    : {
        type,
        question: `Plants take in carbon dioxide from the air. (statement ${n})`,
        options: [],
        answer: 'True',
        explanation: 'Carbon dioxide enters through the stomata.'
      }

/** Ten quick-check questions (five multiple choice, five true or false) for the Quiz plugin's schema. */
const QUIZ_REPLY = {
  questions: Array.from({ length: 10 }, (_, i) => question(i % 2 === 0 ? 'mcq' : 'tf', i + 1))
}

const CANNED: readonly unknown[] = [QUIZ_REPLY]

/** The first canned reply the schema accepts, or `{}` (which most schemas reject, so the call fails clearly). */
export function fakeStructuredReply(request: Request): unknown {
  return CANNED.find((reply) => request.schema.safeParse(reply).success) ?? {}
}
