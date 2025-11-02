# Transaction Simulator

Preview transaction outcomes before execution via x402 micropayments.

## Features

- **Multi-chain Support**: Ethereum, BSC, Polygon, Arbitrum, Optimism, Base, Avalanche
- **Gas Estimation**: Accurate gas cost predictions in native token and USD
- **Failure Prediction**: Detect transactions that will revert before execution
- **Asset Change Preview**: See predicted token transfers
- **Warning System**: Get alerts for high gas costs and potential issues
- **x402 Integration**: Paid via x402 protocol for agent-to-agent payments

## Tech Stack

- **Runtime**: Bun (preferred) or Node.js 20+
- **Framework**: @lucid-dreams/agent-kit + Hono
- **Web3**: viem for Ethereum interactions
- **Protocol**: x402 for micropayments

## Quick Start

### Prerequisites

- Bun or Node.js 20+
- Git

### Installation

```bash
# Clone repository
cd transaction-simulator

# Install dependencies
bun install
# or
npm install

# Copy environment variables
cp .env.example .env

# Start development server
bun run dev
# or
npm run dev
```

The service will start on http://localhost:3000

## API Endpoints

### Health Check

```bash
GET /health
```

Returns service status and supported chains.

### x402 Discovery Endpoint

```bash
POST /simulate-transaction-x402
```

Returns HTTP 402 when no payment is provided. This is the endpoint for x402scan registration.

### Agent-Kit Entrypoint

```bash
POST /entrypoints/simulate-transaction/invoke
```

Managed by @lucid-dreams/agent-kit with automatic payment verification.

## Usage Examples

### Test Transaction Simulation

```bash
curl -X POST http://localhost:3000/simulate-transaction-x402 \
  -H "Content-Type: application/json" \
  -d '{
    "chain_id": 1,
    "from_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "to_address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "value": "0x0",
    "data": "0x"
  }'
```

Without payment header, returns HTTP 402 with payment requirements.

### Response Format

```json
{
  "success": true,
  "gas_used": 21000,
  "gas_cost_eth": 0.00042,
  "gas_cost_usd": 1.26,
  "gas_price_gwei": 20.0,
  "error": null,
  "asset_changes": [],
  "warnings": ["ℹ️ No asset transfers detected"],
  "chain_id": 1,
  "simulation_method": "eth_call"
}
```

## Deployment

### Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Deploy
railway up
```

Railway will automatically detect the Bun/Node.js project using Nixpacks.

### Environment Variables on Railway

Set these in Railway dashboard:
- `FACILITATOR_URL`: https://facilitator.cdp.coinbase.com
- `ADDRESS`: Your wallet address for payments
- `NETWORK`: base
- `DEFAULT_PRICE`: $0.03

## Supported Chains

| Chain ID | Name | Native Token | RPC URL |
|----------|------|--------------|---------|
| 1 | Ethereum | ETH | https://eth.llamarpc.com |
| 56 | BSC | BNB | https://bsc-dataseed1.binance.org |
| 137 | Polygon | MATIC | https://polygon-rpc.com |
| 42161 | Arbitrum | ETH | https://arb1.arbitrum.io/rpc |
| 10 | Optimism | ETH | https://mainnet.optimism.io |
| 8453 | Base | ETH | https://mainnet.base.org |
| 43114 | Avalanche | AVAX | https://api.avax.network/ext/bc/C/rpc |

## x402 Protocol

This service implements the x402 protocol for micropayments:

- **Price**: $0.03 per simulation
- **Payment Network**: Base
- **Payment Token**: USDC (0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)
- **Facilitator**: Coinbase CDP x402 facilitator

### x402 Endpoints

- **Discovery**: `POST /simulate-transaction-x402` → Returns 402
- **.well-known/agent.json**: Agent metadata (managed by agent-kit)
- **.well-known/x402**: x402 metadata (managed by agent-kit)

### x402scan Validation

This agent passes all 5 x402scan validation checks:
- ✅ Returns 402 (GET and POST)
- ✅ x402 parses correctly
- ✅ Valid schema with input/output
- ✅ OG image metadata
- ✅ OG description metadata
- ✅ Favicon

**IMPORTANT**: Uses wrapper Hono app pattern to add OG metadata tags while maintaining agent-kit functionality. See `X402SCAN_VALIDATION.md` for implementation details and requirements for other agents.

## Testing

### Test Locally

```bash
# Health check
curl http://localhost:3000/health

# Test simulation (returns 402)
curl -X POST http://localhost:3000/simulate-transaction-x402 \
  -H "Content-Type: application/json" \
  -d '{"chain_id":1,"from_address":"0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb","to_address":"0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"}'
```

### Test Production

Replace `localhost:3000` with your deployed URL:

```bash
curl https://transaction-simulator-production.up.railway.app/health
```

## Architecture

```
index.ts
├── Environment Configuration
├── Chain Clients Setup (viem)
├── Simulation Engine
│   ├── Address validation
│   ├── eth_call simulation
│   ├── Gas estimation
│   ├── Asset change analysis
│   └── Warning generation
├── Agent App (agent-kit)
│   ├── Payment configuration
│   ├── Automatic x402 handling
│   └── Entrypoint registration
├── Wrapper App (for x402scan OG metadata)
│   ├── GET / → Custom HTML with OG tags
│   ├── GET /favicon.ico → Favicon
│   └── ALL other routes → Forward to agent-kit
└── Endpoints
    ├── /health
    ├── /og-image.png (OG image)
    ├── /simulate-transaction-x402 (custom x402)
    └── /entrypoints/simulate-transaction/invoke (agent-kit)
```

**Note**: The wrapper app pattern is required for x402scan validation. See `X402SCAN_VALIDATION.md` for details.

## License

MIT

## Built By

DeganAI - https://github.com/DeganAI
