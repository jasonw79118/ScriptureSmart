// Operator-only: retrieves public WEB text and makes one paid/live inference request.
import { getPlatformProxy } from 'wrangler';
import { generateWithBinding } from '../server/ai/provider.ts';
import { retrievePassages } from '../server/ai/scripture.ts';
import { suggestedReferences } from '../src/domain/bible.ts';
const prompt =
  'Compare Adoption in Ephesians 1 to other areas that Paul discussed Adoption, is the adoption process really what is predetermined here?';
const sources = await retrievePassages(suggestedReferences(prompt));
console.log(
  'Retrieved:',
  sources.map((p) => `${p.reference} (${p.translation})`).join('; '),
);
const platform = await getPlatformProxy({
  configPath: 'wrangler.jsonc',
  persist: false,
});
const started = Date.now();
try {
  const result = await generateWithBinding(
    platform.env.AI,
    platform.env,
    { taskType: 'general', prompt },
    sources,
  );
  console.log(
    JSON.stringify({
      elapsedSeconds: (Date.now() - started) / 1000,
      answer: result.text,
      passages: result.scriptureSources?.map((p) => p.reference),
    }),
  );
} finally {
  await platform.dispose();
}
