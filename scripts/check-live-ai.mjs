// Operator-only diagnostic: one live request through the application's model adapter.
import { getPlatformProxy } from 'wrangler';
import { generateWithBinding } from '../server/ai/provider.ts';
const platform = await getPlatformProxy({
  configPath: 'wrangler.jsonc',
  persist: false,
});
const started = Date.now();
try {
  const result = await generateWithBinding(platform.env.AI, platform.env, {
    taskType: 'general',
    prompt:
      'Explain the main themes of John 1 and suggest three discussion questions. Do not quote sources.',
  });
  console.log(
    JSON.stringify({
      elapsedSeconds: (Date.now() - started) / 1000,
      model: result.model,
      answer: result.text,
      kind: result.kind,
    }),
  );
} catch (error) {
  console.error(
    JSON.stringify({
      name: error.name,
      code: error.code,
      message: error.message,
    }),
  );
  process.exitCode = 1;
} finally {
  await platform.dispose();
}
