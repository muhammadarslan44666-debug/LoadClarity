import app from './index.js';
import { config } from './config.js';

app.listen(config.port, () => {
  console.log(`LoadClarity server running at http://localhost:${config.port}`);
  if (!config.anthropicKey) console.log('Note: AI text reading is off (no ANTHROPIC_API_KEY). Everything else works.');
});
