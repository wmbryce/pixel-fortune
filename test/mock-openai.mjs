// Mock OpenAI chat-completions endpoint for testing the fortune path without a key.
// Point the app at it with OPENAI_BASE_URL=http://localhost:3222/v1 (openai-node reads that env var).
//
//   MOCK_DELAY_MS=0    node test/mock-openai.mjs   # reading lands before the 2200ms reveal beat
//   MOCK_DELAY_MS=4000 node test/mock-openai.mjs   # realistic OpenAI latency
//   MOCK_MODE=error    node test/mock-openai.mjs   # 500, exercises the mutation error path
//   MOCK_MODE=long     node test/mock-openai.mjs   # paragraphs past 1000 chars, exercises TypingText
//   MOCK_MODE=cutoff   node test/mock-openai.mjs   # finish_reason=length, exercises the trim
import http from 'node:http';

const SHORT = `Past:\nThe cards show a romantic beginning. Mock paragraph one.\n\nPresent:\nUpheaval is marked here. Mock paragraph two.\n\nFuture:\nRenewal is promised. Mock paragraph three.`;

/** Each paragraph is past the 1000-character ceiling TypingText used to truncate at. */
const LONG = [1, 2, 3]
  .map(
    n =>
      `Paragraph ${n}. ` +
      Array.from(
        { length: 24 },
        (_, i) => `Sentence ${i} of a reading that runs long enough to matter.`
      ).join(' ')
  )
  .join('\n\n');

const MODE = process.env.MOCK_MODE ?? 'ok';
const READING =
  MODE === 'long'
    ? LONG
    : MODE === 'cutoff'
      ? `${SHORT}\n\nAnd a fourth paragraph that stops mid-sen`
      : SHORT;
const FINISH_REASON = MODE === 'cutoff' ? 'length' : 'stop';
const DELAY = Number(process.env.MOCK_DELAY_MS ?? 4000);
const PORT = Number(process.env.MOCK_PORT ?? 3222);

http
  .createServer((req, res) => {
    let body = '';
    req.on('data', c => (body += c));
    req.on('end', () => {
      console.log(
        'REQ',
        req.method,
        req.url,
        '| auth:',
        req.headers.authorization ? 'present' : 'MISSING'
      );
      setTimeout(() => {
        if (MODE === 'error') {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { message: 'mock failure' } }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            id: 'chatcmpl-mock',
            object: 'chat.completion',
            created: 1,
            model: 'gpt-4o-mini-2024-07-18',
            choices: [
              {
                index: 0,
                message: { role: 'assistant', content: READING },
                finish_reason: FINISH_REASON,
              },
            ],
            // Roughly what a real four-paragraph reading costs, so the spend
            // reported by /api/status is realistic against the mock too.
            usage: {
              prompt_tokens: 190,
              completion_tokens: 610,
              total_tokens: 800,
            },
          })
        );
      }, DELAY);
    });
  })
  .listen(PORT, () =>
    console.log(`mock openai on ${PORT}, mode=${MODE}, delay=${DELAY}`)
  );
