# x402scan Validation - Quick Reference

## ⚠️ MANDATORY: Use @lucid-dreams/agent-kit ⚠️

**NO EXCEPTIONS. ALL agents MUST use agent-kit for x402 protocol.**

The wrapper pattern below works **WITH** agent-kit, not instead of it.
- Agent-kit does ALL x402 work
- Wrapper ONLY adds OG metadata to root HTML

## Copy this to every agent repository!

See `transaction-simulator/X402SCAN_VALIDATION.md` for complete guide.

## Required Validations (ALL 5)

1. ✅ Returns 402 (GET and POST)
2. ✅ x402 parses correctly
3. ✅ Valid schema (input + output)
4. ✅ OG image metadata tag
5. ✅ OG description metadata tag
6. ✅ Favicon link tag

## Quick Implementation

```typescript
import { createAgentApp } from '@lucid-dreams/agent-kit';
import { Hono } from 'hono';

// 1. Create agent-kit app
const app = createAgentApp({ ... });
const honoApp = app.app;

// Register your entrypoints, health, etc
app.addEntrypoint({ ... });

// 2. Create wrapper app
const wrapperApp = new Hono();

// 3. Add favicon
wrapperApp.get('/favicon.ico', (c) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <rect width="100" height="100" fill="#10b981"/>
    <circle cx="50" cy="50" r="30" fill="#ffffff"/>
  </svg>`;
  c.header('Content-Type', 'image/svg+xml');
  return c.body(svg);
});

// 4. Add root with OG tags
wrapperApp.get('/', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Your Agent - x402 Agent</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.ico">

  <!-- REQUIRED FOR x402scan -->
  <meta property="og:title" content="Your Agent - x402 Agent">
  <meta property="og:description" content="Your agent description">
  <meta property="og:image" content="https://your-domain.com/og-image.png">
</head>
<body>
  <h1>Your Agent</h1>
  <p>Your description</p>
</body>
</html>`);
});

// 5. Forward to agent-kit
wrapperApp.all('*', async (c) => {
  return honoApp.fetch(c.req.raw);
});

// 6. Start with WRAPPER (not honoApp!)
Bun.serve({
  fetch: wrapperApp.fetch,  // ← Use wrapper!
});
```

## Common Mistakes

❌ Using `honoApp.fetch` instead of `wrapperApp.fetch`
❌ Missing `<link rel="icon">` tag
❌ Missing wrapper app entirely
❌ Testing before 5-minute Railway deployment completes

## Testing

```bash
# After deployment (wait 5 minutes!)
curl https://your-agent.com/ | grep "og:"

# Validate at:
https://www.x402scan.com/developer
```

## Full Documentation

**Complete guide**: `transaction-simulator/X402SCAN_VALIDATION.md`

Copy that file to your agent repo or reference it for implementation details.
