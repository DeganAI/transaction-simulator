# x402scan Validation Requirements

## Overview

x402scan (https://www.x402scan.com/developer) validates x402 agents against 5 critical checks. **ALL 5 MUST PASS** for proper agent registration and discovery.

## The 5 Required Validations

| Check | GET | POST | Description |
|-------|-----|------|-------------|
| **Returns 402** | ✅ | ✅ | Both GET and POST to root/endpoints must return HTTP 402 status |
| **x402 parses** | ✅ | ✅ | Response body must contain valid x402 metadata (accepts array, etc.) |
| **Valid schema** | ✅ | ✅ | Must include `outputSchema` with both `input` and `output` fields |
| **OG image** | ✅ | ✅ | HTML `<head>` must contain `<meta property="og:image">` tag |
| **OG description** | ✅ | ✅ | HTML `<head>` must contain `<meta property="og:description">` tag |
| **Favicon** | ✅ | ✅ | HTML `<head>` must contain `<link rel="icon">` tag |

## The Problem with agent-kit

**Critical Issue**: `@lucid-dreams/agent-kit` automatically generates the root HTML page but does **NOT** support customizing Open Graph (OG) metadata tags.

### What agent-kit Controls

- Root route (`GET /`) - auto-generated landing page
- x402 protocol endpoints (`.well-known/agent.json`, `.well-known/x402`)
- Payment verification and handling
- Entrypoint registration

### What agent-kit Does NOT Support

- ❌ Adding OG metadata tags to root HTML
- ❌ Adding favicon links to root HTML
- ❌ Customizing root HTML `<head>` section
- ❌ Intercepting root route with middleware

### Failed Approaches (Do NOT Attempt)

```typescript
// ❌ DOES NOT WORK: Adding metadata to addEntrypoint
app.addEntrypoint({
  key: 'my-agent',
  metadata: {
    'og:title': '...',  // ❌ Agent-kit ignores this
  }
});

// ❌ DOES NOT WORK: Middleware interception
honoApp.use('*', async (c, next) => {
  if (c.req.path === '/') {
    return c.html('...');  // ❌ Never called - agent-kit routes take priority
  }
  await next();
});

// ❌ DOES NOT WORK: Direct route override
honoApp.get('/', (c) => {
  return c.html('...');  // ❌ Agent-kit ignores this - already registered
});
```

All of these approaches fail because agent-kit internally registers its routes and they take priority over any custom handlers.

## The Solution: Wrapper Hono App

**The ONLY working solution** is to create a wrapper Hono app that intercepts requests BEFORE they reach agent-kit.

### Architecture

```
Request Flow:
┌─────────────┐
│   Request   │
└─────┬───────┘
      │
      ▼
┌─────────────────────┐
│   Wrapper App       │
│  (Custom Hono)      │
└─────┬───────────────┘
      │
      ├─ GET / → Custom HTML with OG tags
      ├─ GET /favicon.ico → Custom favicon
      │
      └─ ALL other routes → Forward to agent-kit app
                              └─ agent-kit handles x402 protocol
                              └─ Payment verification
                              └─ Entrypoint execution
```

### Implementation Pattern

```typescript
import { createAgentApp } from '@lucid-dreams/agent-kit';
import { Hono } from 'hono';

// 1. Create agent-kit app as normal
const app = createAgentApp({
  name: 'Your Agent Name',
  description: 'Your agent description',
  paymentsConfig: { ... },
});

// Get underlying Hono app
const honoApp = app.app;

// Register entrypoints, health checks, etc on honoApp
app.addEntrypoint({ ... });
honoApp.get('/health', ...);

// 2. Create wrapper app that intercepts root route
const wrapperApp = new Hono();

// 3. Handle favicon
wrapperApp.get('/favicon.ico', (c) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <rect width="100" height="100" fill="#10b981"/>
    <circle cx="50" cy="50" r="30" fill="#ffffff"/>
  </svg>`;
  c.header('Content-Type', 'image/svg+xml');
  return c.body(svg);
});

// 4. Handle root route with OG metadata
wrapperApp.get('/', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Agent - x402 Agent</title>
  <meta name="description" content="Your agent description here">
  <link rel="icon" type="image/svg+xml" href="/favicon.ico">

  <!-- CRITICAL: Open Graph tags for x402scan validation -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://your-agent-production.up.railway.app/">
  <meta property="og:title" content="Your Agent - x402 Agent">
  <meta property="og:description" content="Your agent description here">
  <meta property="og:image" content="https://your-agent-production.up.railway.app/og-image.png">

  <!-- Twitter tags (optional but recommended) -->
  <meta property="twitter:card" content="summary_large_image">
  <meta property="twitter:url" content="https://your-agent-production.up.railway.app/">
  <meta property="twitter:title" content="Your Agent - x402 Agent">
  <meta property="twitter:description" content="Your agent description here">
  <meta property="twitter:image" content="https://your-agent-production.up.railway.app/og-image.png">

  <style>
    body { font-family: system-ui; max-width: 800px; margin: 40px auto; padding: 20px; }
    h1 { color: #2563eb; }
  </style>
</head>
<body>
  <h1>Your Agent</h1>
  <p>Your agent description</p>

  <h2>x402 Agent Endpoints</h2>
  <div><code>POST /entrypoints/your-agent/invoke</code></div>
  <div><code>GET /.well-known/agent.json</code></div>
  <div><code>GET /health</code></div>

  <p><small>Powered by agent-kit</small></p>
</body>
</html>`);
});

// 5. Forward ALL other requests to agent-kit
wrapperApp.all('*', async (c) => {
  return honoApp.fetch(c.req.raw);
});

// 6. Start server with WRAPPER APP (not agent-kit app)
if (typeof Bun !== 'undefined') {
  Bun.serve({
    port: PORT,
    hostname: HOST,
    fetch: wrapperApp.fetch,  // ← Use wrapper, not honoApp!
  });
} else {
  const { serve } = await import('@hono/node-server');
  serve({
    fetch: wrapperApp.fetch,  // ← Use wrapper, not honoApp!
    port: PORT,
    hostname: HOST,
  });
}
```

## Required OG Tags

### Minimum Required Tags

```html
<meta property="og:title" content="Your Agent Name - x402 Agent">
<meta property="og:description" content="Brief description of your agent (1-2 sentences)">
<meta property="og:image" content="https://your-domain.com/og-image.png">
```

### Recommended Additional Tags

```html
<meta property="og:type" content="website">
<meta property="og:url" content="https://your-domain.com/">
<meta property="twitter:card" content="summary_large_image">
<meta property="twitter:url" content="https://your-domain.com/">
<meta property="twitter:title" content="Your Agent Name - x402 Agent">
<meta property="twitter:description" content="Brief description">
<meta property="twitter:image" content="https://your-domain.com/og-image.png">
```

### Favicon Tag

```html
<link rel="icon" type="image/svg+xml" href="/favicon.ico">
```

## Creating OG Image

x402scan expects an `og:image` URL. You can create a simple endpoint:

```typescript
honoApp.get('/og-image.png', (c) => {
  const svg = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
    <rect width="1200" height="630" fill="#0c2713"/>
    <text x="600" y="280" font-family="Arial" font-size="60" fill="#6de8a5"
          text-anchor="middle" font-weight="bold">Your Agent Name</text>
    <text x="600" y="350" font-family="Arial" font-size="32" fill="#e6f4ea"
          text-anchor="middle">Your agent tagline</text>
    <text x="600" y="420" font-family="Arial" font-size="24" fill="#76ad8b"
          text-anchor="middle">Feature 1 · Feature 2 · Feature 3</text>
  </svg>`;
  c.header('Content-Type', 'image/svg+xml');
  return c.body(svg);
});
```

Register this BEFORE creating the wrapper app, so it's available on the `honoApp` that gets forwarded to.

## Validation Checklist

Before deploying, verify:

- [ ] Import `Hono` from 'hono' package
- [ ] Create wrapper app: `const wrapperApp = new Hono();`
- [ ] Add favicon endpoint to wrapper app
- [ ] Add root route with OG tags to wrapper app
- [ ] Include `<link rel="icon">` tag in HTML head
- [ ] Include all 3 required OG tags (title, description, image)
- [ ] Forward all other routes with `wrapperApp.all('*', ...)`
- [ ] Start server with `wrapperApp.fetch` (not `honoApp.fetch`)
- [ ] Test root route returns custom HTML with OG tags
- [ ] Test x402 endpoints still work (agent-kit functionality preserved)
- [ ] Validate with x402scan: https://www.x402scan.com/developer

## Testing x402scan Validation

```bash
# 1. Deploy to Railway
git push origin main

# 2. Wait 5 minutes for deployment

# 3. Test root HTML has OG tags
curl https://your-agent-production.up.railway.app/ | grep "og:"

# Expected output:
# <meta property="og:title" content="...">
# <meta property="og:description" content="...">
# <meta property="og:image" content="...">

# 4. Validate with x402scan
# Go to: https://www.x402scan.com/developer
# Enter endpoint URL: https://your-agent-production.up.railway.app/entrypoints/your-agent/invoke
# Click "Test Endpoint"
# Verify all 5 checks pass (green checkmarks):
#   ✅ Returns 402 (GET)
#   ✅ Returns 402 (POST)
#   ✅ x402 parses
#   ✅ Valid schema
#   ✅ OG image
#   ✅ OG description
#   ✅ Favicon
```

## Common Mistakes to Avoid

### 1. Using honoApp.fetch instead of wrapperApp.fetch
```typescript
// ❌ WRONG - bypasses wrapper
Bun.serve({
  fetch: honoApp.fetch,  // ❌ Wrong!
});

// ✅ CORRECT - uses wrapper
Bun.serve({
  fetch: wrapperApp.fetch,  // ✅ Correct!
});
```

### 2. Forgetting to import Hono
```typescript
// ❌ WRONG - missing import
const wrapperApp = new Hono();  // ❌ Error: Hono is not defined

// ✅ CORRECT
import { Hono } from 'hono';
const wrapperApp = new Hono();
```

### 3. Not including favicon link tag
```html
<!-- ❌ WRONG - missing favicon link -->
<head>
  <meta property="og:title" content="...">
</head>

<!-- ✅ CORRECT - includes favicon link -->
<head>
  <link rel="icon" type="image/svg+xml" href="/favicon.ico">
  <meta property="og:title" content="...">
</head>
```

### 4. Testing immediately after deployment
```bash
# ❌ WRONG - Railway takes ~5 minutes to deploy
git push origin main
curl https://your-agent.up.railway.app/  # ❌ Tests old version!

# ✅ CORRECT - wait for deployment
git push origin main
sleep 300  # Wait 5 minutes
curl https://your-agent.up.railway.app/
```

### 5. OG image URL points to non-existent endpoint
```html
<!-- ❌ WRONG - endpoint doesn't exist -->
<meta property="og:image" content="https://your-agent.com/image.png">

<!-- ✅ CORRECT - endpoint exists and returns image -->
<meta property="og:image" content="https://your-agent.com/og-image.png">
```

And ensure the endpoint exists:
```typescript
honoApp.get('/og-image.png', (c) => {
  const svg = `<svg>...</svg>`;
  c.header('Content-Type', 'image/svg+xml');
  return c.body(svg);
});
```

## Why This Pattern Works

1. **Wrapper intercepts first**: Request hits wrapper app before agent-kit sees it
2. **Custom HTML for root**: Wrapper serves GET / with OG tags
3. **Agent-kit preserved**: All other routes forwarded to agent-kit unchanged
4. **x402 functionality intact**: Payment verification, entrypoints, all work normally
5. **x402scan validation passes**: OG tags present in HTML, 402 responses work

## Reference Implementation

See `index.ts` in this repository for a complete working example.

## Summary

**Problem**: agent-kit doesn't support OG metadata customization

**Solution**: Wrapper Hono app pattern
- Create wrapper app with Hono
- Intercept GET / and /favicon.ico
- Forward everything else to agent-kit
- Serve wrapper app instead of agent-kit app

**Result**: All 5 x402scan validations pass while maintaining full agent-kit functionality

---

**Last Updated**: November 2, 2025
**Status**: ✅ Working solution verified with x402scan
