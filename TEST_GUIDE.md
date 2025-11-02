# Testing Guide for Transaction Simulator

## Local Testing

### Prerequisites

Fix npm cache permissions if needed:
```bash
sudo chown -R $(whoami) ~/.npm
```

Or use Bun (recommended):
```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Install dependencies with Bun
bun install

# Run with Bun
bun run dev
```

### Installation and Startup

```bash
# Navigate to project
cd /Users/kellyborsuk/Documents/gas/files-2/transaction-simulator

# Install dependencies
npm install
# or
bun install

# Start server
npm run dev
# or
bun run dev
```

### Test Endpoints

Once running on http://localhost:3000:

#### 1. Health Check
```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "transaction-simulator",
  "version": "1.0.0",
  "runtime": "Node.js",
  "free_mode": false,
  "supported_chains": 7,
  "chain_ids": [1, 56, 137, 42161, 10, 8453, 43114],
  "timestamp": "2025-11-02T..."
}
```

#### 2. x402 Discovery Endpoint (Should return 402)
```bash
curl -i -X POST http://localhost:3000/simulate-transaction-x402 \
  -H "Content-Type: application/json" \
  -d '{
    "chain_id": 1,
    "from_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "to_address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "value": "0x0",
    "data": "0x"
  }'
```

Expected response: **HTTP 402** with x402 payment metadata

#### 3. Agent-Kit Entrypoints (Should return 402)
```bash
curl -i -X POST http://localhost:3000/entrypoints/simulate-transaction/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "chain_id": 1,
    "from_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "to_address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "value": "0x0",
    "data": "0x"
  }'
```

Expected response: **HTTP 402** (payment required)

#### 4. Agent Metadata
```bash
curl http://localhost:3000/.well-known/agent.json
```

Expected: JSON with agent metadata (managed by agent-kit)

#### 5. x402 Metadata
```bash
curl -i http://localhost:3000/.well-known/x402
```

Expected: **HTTP 402** with x402 protocol metadata

## Production Testing

Once deployed to Railway:

```bash
# Set your deployed URL
PROD_URL="https://transaction-simulator-production.up.railway.app"

# Health check
curl $PROD_URL/health

# Test x402 endpoint (should return 402)
curl -i -X POST $PROD_URL/simulate-transaction-x402 \
  -H "Content-Type: application/json" \
  -d '{"chain_id":1,"from_address":"0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb","to_address":"0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"}'

# Check x402 metadata (should return 402)
curl -i $PROD_URL/.well-known/x402

# Check agent metadata
curl $PROD_URL/.well-known/agent.json
```

## Expected Behaviors

### ✅ Correct Responses

1. **Health endpoint**: HTTP 200 with service status
2. **x402 discovery**: HTTP 402 with payment requirements
3. **Agent metadata**: HTTP 200 with agent info
4. **x402 metadata**: HTTP 402 with x402 protocol details
5. **All entrypoints without payment**: HTTP 402

### ❌ Incorrect Responses (Fixed in this version)

1. ~~x402 endpoint returns HTTP 200~~ → Now returns 402 ✓
2. ~~Missing x402scan-compliant schema~~ → Now included ✓
3. ~~Custom middleware approach~~ → Now using agent-kit ✓

## Verification Checklist

- [ ] Server starts without errors
- [ ] Health check returns 200
- [ ] x402 endpoint returns 402 (not 200)
- [ ] Agent metadata accessible
- [ ] x402 metadata returns 402 status
- [ ] All supported chains listed in health response
- [ ] Simulation logic executes without errors

## Troubleshooting

### npm cache permission errors

```bash
# Fix cache permissions
sudo chown -R $(whoami) ~/.npm

# Or use Bun instead
curl -fsSL https://bun.sh/install | bash
bun install
```

### Port already in use

```bash
# Find process on port 3000
lsof -i :3000

# Kill process
kill -9 <PID>
```

### Missing dependencies

```bash
# Clear and reinstall
rm -rf node_modules package-lock.json
npm install
```

### TypeScript errors

```bash
# Check for syntax errors
npx tsc --noEmit
```

## Deployment to Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize (if not already)
railway init

# Deploy
railway up
```

Railway will automatically:
1. Detect Bun/Node.js project via Nixpacks.TOML
2. Run `bun install` or `npm install`
3. Start with `bun run index.ts`
4. Set up environment variables from Railway dashboard

## Environment Variables for Railway

Set in Railway dashboard:

| Variable | Value | Description |
|----------|-------|-------------|
| `FACILITATOR_URL` | `https://facilitator.cdp.coinbase.com` | x402 facilitator |
| `ADDRESS` | `0x01D11F7e1a46AbFC6092d7be484895D2d505095c` | Payment address |
| `NETWORK` | `base` | Payment network |
| `DEFAULT_PRICE` | `$0.03` | Price per simulation |

RPC URLs are optional (defaults provided in code).

## Success Criteria

The transaction-simulator is working correctly when:

1. ✅ `.well-known/x402` returns **HTTP 402** (not 200)
2. ✅ `/simulate-transaction-x402` returns **HTTP 402** without payment
3. ✅ All endpoints properly implement x402 protocol
4. ✅ Agent-kit manages payment verification automatically
5. ✅ Simulation engine correctly estimates gas and detects failures
6. ✅ Multi-chain support operational (7 chains)
7. ✅ x402scan can discover and register the service

## Comparison with Previous Version

| Aspect | Old (Python + FastAPI) | New (TypeScript + agent-kit) |
|--------|------------------------|------------------------------|
| Framework | Custom FastAPI + middleware | agent-kit (x402-native) |
| x402 endpoint | Returns 200 ❌ | Returns 402 ✓ |
| Payment handling | Custom middleware | Agent-kit automatic |
| Web3 library | web3.py | viem |
| Runtime | Python | Bun/Node.js |
| x402 integration | Manual | Framework-native |

The new version follows the proven pattern from the working LP Impermanent Loss Estimator.
