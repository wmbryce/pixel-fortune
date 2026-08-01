// Mock OpenAI chat-completions endpoint for testing the fortune path without a key.
// Point the app at it with OPENAI_BASE_URL=http://localhost:3222/v1 (openai-node reads that env var).
//
//   MOCK_DELAY_MS=0    node test/mock-openai.mjs   # fast return — exercises the DialogBox race
//   MOCK_DELAY_MS=4000 node test/mock-openai.mjs   # realistic OpenAI latency
//   MOCK_MODE=error    node test/mock-openai.mjs   # 500, exercises the mutation error path
import http from 'node:http';

const READING = `Past:\nThe cards show a romantic beginning. Mock paragraph one.\n\nPresent:\nUpheaval is marked here. Mock paragraph two.\n\nFuture:\nRenewal is promised. Mock paragraph three.`;
const DELAY = Number(process.env.MOCK_DELAY_MS ?? 4000);
const MODE = process.env.MOCK_MODE ?? 'ok';
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
            model: 'gpt-3.5-turbo-16k',
            choices: [
              {
                index: 0,
                message: { role: 'assistant', content: READING },
                finish_reason: 'stop',
              },
            ],
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
          })
        );
      }, DELAY);
    });
  })
  .listen(PORT, () =>
    console.log(`mock openai on ${PORT}, mode=${MODE}, delay=${DELAY}`)
  );
