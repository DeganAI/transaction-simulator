import { createAgentApp } from '@lucid-dreams/agent-kit';
import { Hono } from 'hono';
import { createPublicClient, http, type Address, type Hash, type Hex, formatEther, parseGwei, formatGwei } from 'viem';
import { mainnet, bsc, polygon, arbitrum, optimism, base, avalanche } from 'viem/chains';

// ============================================
// STEP 1: Environment & Configuration
// ============================================
console.log('[STARTUP] ===== TRANSACTION SIMULATOR =====');
console.log('[STARTUP] Step 1: Loading environment variables...');

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = '0.0.0.0';
const FACILITATOR_URL = process.env.FACILITATOR_URL || 'https://facilitator.cdp.coinbase.com';
const WALLET_ADDRESS = process.env.ADDRESS || '0x01D11F7e1a46AbFC6092d7be484895D2d505095c';
const NETWORK = process.env.NETWORK || 'base';
const DEFAULT_PRICE = process.env.DEFAULT_PRICE || '$0.03';

console.log('[CONFIG] Runtime: Bun/Node');
console.log('[CONFIG] Port:', PORT);
console.log('[CONFIG] Host:', HOST);
console.log('[CONFIG] Facilitator URL:', FACILITATOR_URL ? 'Set ✓' : 'Not set ✗');
console.log('[CONFIG] Wallet Address:', WALLET_ADDRESS ? 'Set ✓' : 'Not set ✗');
console.log('[CONFIG] Network:', NETWORK);
console.log('[CONFIG] Default Price:', DEFAULT_PRICE);

// ============================================
// STEP 2: Chain Configuration & Simulation Engine
// ============================================
console.log('[STARTUP] Step 2: Configuring blockchain clients...');

const CHAIN_CONFIGS = {
  1: {
    chain: mainnet,
    name: 'Ethereum',
    nativeSymbol: 'ETH',
    rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com',
    estimatedPrice: 3000, // USD
  },
  56: {
    chain: bsc,
    name: 'BSC',
    nativeSymbol: 'BNB',
    rpcUrl: process.env.BSC_RPC_URL || 'https://bsc-dataseed1.binance.org',
    estimatedPrice: 600,
  },
  137: {
    chain: polygon,
    name: 'Polygon',
    nativeSymbol: 'MATIC',
    rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
    estimatedPrice: 1.0,
  },
  42161: {
    chain: arbitrum,
    name: 'Arbitrum',
    nativeSymbol: 'ETH',
    rpcUrl: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
    estimatedPrice: 3000,
  },
  10: {
    chain: optimism,
    name: 'Optimism',
    nativeSymbol: 'ETH',
    rpcUrl: process.env.OPTIMISM_RPC_URL || 'https://mainnet.optimism.io',
    estimatedPrice: 3000,
  },
  8453: {
    chain: base,
    name: 'Base',
    nativeSymbol: 'ETH',
    rpcUrl: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
    estimatedPrice: 3000,
  },
  43114: {
    chain: avalanche,
    name: 'Avalanche',
    nativeSymbol: 'AVAX',
    rpcUrl: process.env.AVALANCHE_RPC_URL || 'https://api.avax.network/ext/bc/C/rpc',
    estimatedPrice: 40,
  },
} as const;

// Initialize public clients for each chain
const clients: Record<number, ReturnType<typeof createPublicClient>> = {};
const supportedChainIds: number[] = [];

for (const [chainIdStr, config] of Object.entries(CHAIN_CONFIGS)) {
  const chainId = parseInt(chainIdStr);
  try {
    clients[chainId] = createPublicClient({
      chain: config.chain,
      transport: http(config.rpcUrl),
    });
    supportedChainIds.push(chainId);
    console.log(`[CONFIG] ✓ ${config.name} (Chain ${chainId})`);
  } catch (error) {
    console.error(`[CONFIG] ✗ Failed to initialize ${config.name}: ${error}`);
  }
}

console.log(`[CONFIG] Initialized ${supportedChainIds.length} chains`);

interface SimulationRequest {
  chain_id: number;
  from_address: string;
  to_address: string;
  value?: string;
  data?: string;
  gas?: string;
  gas_price?: string;
}

interface AssetChange {
  asset_type: string;
  change_type: string;
  from: string;
  to: string;
  amount_wei: string;
  amount_eth: number;
  symbol: string;
}

interface SimulationResult {
  success: boolean;
  gas_used: number;
  gas_cost_eth: number;
  gas_cost_usd: number;
  gas_price_gwei: number;
  error: string | null;
  asset_changes: AssetChange[];
  warnings: string[];
  chain_id: number;
  simulation_method: string;
}

function validateAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

function hexToNumber(hex: string | number): bigint {
  if (typeof hex === 'number') return BigInt(hex);
  if (!hex) return 0n;
  if (hex.startsWith('0x')) {
    return BigInt(hex);
  }
  return BigInt(`0x${hex}`);
}

async function simulateTransaction(request: SimulationRequest): Promise<SimulationResult> {
  console.log(`[SIMULATION] Starting simulation on chain ${request.chain_id}`);

  const chainConfig = CHAIN_CONFIGS[request.chain_id as keyof typeof CHAIN_CONFIGS];
  const client = clients[request.chain_id];

  if (!chainConfig || !client) {
    console.error(`[SIMULATION] Chain ${request.chain_id} not supported`);
    return {
      success: false,
      gas_used: 0,
      gas_cost_eth: 0,
      gas_cost_usd: 0,
      gas_price_gwei: 0,
      error: `Chain ${request.chain_id} not supported`,
      asset_changes: [],
      warnings: ['Chain not supported'],
      chain_id: request.chain_id,
      simulation_method: 'none',
    };
  }

  // Validate addresses
  if (!validateAddress(request.from_address)) {
    return {
      success: false,
      gas_used: 0,
      gas_cost_eth: 0,
      gas_cost_usd: 0,
      gas_price_gwei: 0,
      error: `Invalid from_address: ${request.from_address}`,
      asset_changes: [],
      warnings: ['Invalid address format'],
      chain_id: request.chain_id,
      simulation_method: 'validation',
    };
  }

  if (!validateAddress(request.to_address)) {
    return {
      success: false,
      gas_used: 0,
      gas_cost_eth: 0,
      gas_cost_usd: 0,
      gas_price_gwei: 0,
      error: `Invalid to_address: ${request.to_address}`,
      asset_changes: [],
      warnings: ['Invalid address format'],
      chain_id: request.chain_id,
      simulation_method: 'validation',
    };
  }

  const fromAddress = request.from_address as Address;
  const toAddress = request.to_address as Address;
  const value = request.value ? hexToNumber(request.value) : 0n;
  const data = (request.data || '0x') as Hex;

  try {
    // Test transaction with eth_call to check for reverts
    let simulationSuccess = true;
    let errorMsg: string | null = null;

    try {
      await client.call({
        account: fromAddress,
        to: toAddress,
        value: value,
        data: data,
      });
      console.log('[SIMULATION] eth_call succeeded - transaction should succeed');
    } catch (callError: any) {
      simulationSuccess = false;
      errorMsg = callError.message || String(callError);
      console.warn(`[SIMULATION] eth_call failed: ${errorMsg}`);
    }

    // Estimate gas
    let gasEstimate = 21000n; // Default minimum
    try {
      gasEstimate = await client.estimateGas({
        account: fromAddress,
        to: toAddress,
        value: value,
        data: data,
      });
      console.log(`[SIMULATION] Gas estimate: ${gasEstimate.toString()}`);
    } catch (gasError: any) {
      console.warn(`[SIMULATION] Gas estimation failed: ${gasError.message}`);
      if (!errorMsg) {
        errorMsg = `Gas estimation failed: ${gasError.message}`;
      }
    }

    // Get current gas price
    let currentGasPrice = parseGwei('20'); // Fallback
    try {
      currentGasPrice = await client.getGasPrice();
      console.log(`[SIMULATION] Current gas price: ${formatGwei(currentGasPrice)} gwei`);
    } catch (priceError) {
      console.warn('[SIMULATION] Failed to fetch gas price, using fallback');
    }

    // Calculate costs
    const gasCostWei = gasEstimate * currentGasPrice;
    const gasCostEth = parseFloat(formatEther(gasCostWei));
    const gasCostUsd = gasCostEth * chainConfig.estimatedPrice;

    // Analyze asset changes
    const assetChanges: AssetChange[] = [];
    if (value > 0n) {
      assetChanges.push({
        asset_type: 'NATIVE',
        change_type: 'TRANSFER',
        from: fromAddress,
        to: toAddress,
        amount_wei: value.toString(),
        amount_eth: parseFloat(formatEther(value)),
        symbol: chainConfig.nativeSymbol,
      });
    }

    // Generate warnings
    const warnings: string[] = [];
    if (!simulationSuccess) {
      warnings.push('⚠️ Transaction will likely FAIL - Do not execute');
    }
    if (gasEstimate > 1000000n) {
      warnings.push(`⚠️ Very high gas usage: ${gasEstimate.toString()} gas`);
    }
    if (gasCostUsd > 10) {
      warnings.push(`⚠️ High gas cost: $${gasCostUsd.toFixed(2)}`);
    }
    if (gasCostUsd > 50) {
      warnings.push('🚫 EXTREMELY HIGH GAS COST - Verify transaction details');
    }
    if (assetChanges.length === 0) {
      warnings.push('ℹ️ No asset transfers detected');
    }

    return {
      success: simulationSuccess,
      gas_used: Number(gasEstimate),
      gas_cost_eth: gasCostEth,
      gas_cost_usd: parseFloat(gasCostUsd.toFixed(4)),
      gas_price_gwei: parseFloat(formatGwei(currentGasPrice)),
      error: errorMsg,
      asset_changes: assetChanges,
      warnings: warnings,
      chain_id: request.chain_id,
      simulation_method: 'eth_call',
    };
  } catch (error: any) {
    console.error(`[SIMULATION] Unexpected error: ${error.message}`);
    return {
      success: false,
      gas_used: 0,
      gas_cost_eth: 0,
      gas_cost_usd: 0,
      gas_price_gwei: 0,
      error: `Simulation failed: ${error.message}`,
      asset_changes: [],
      warnings: ['Unexpected simulation error'],
      chain_id: request.chain_id,
      simulation_method: 'error',
    };
  }
}

console.log('[STARTUP] Chain configuration and simulation engine ready ✓');

// ============================================
// STEP 3: Create Agent App
// ============================================
console.log('[STARTUP] Step 3: Creating agent app...');

const app = createAgentApp({
  name: 'Transaction Simulator',
  description: 'Preview transaction outcomes before execution - gas costs, asset changes, and failure prediction',
  version: '1.0.0',
  paymentsConfig: {
    facilitatorUrl: FACILITATOR_URL,
    address: WALLET_ADDRESS as `0x${string}`,
    network: NETWORK,
    defaultPrice: DEFAULT_PRICE,
  },
});

console.log('[STARTUP] Agent app created ✓');

// Access the underlying Hono app for registration
const honoApp = app.app;

// ============================================
// STEP 4: Define Entrypoints
// ============================================
console.log('[STARTUP] Step 4: Defining entrypoints...');

// Health check
honoApp.get('/health', (c) => {
  console.log('[HEALTH] Health check requested');
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Transaction Simulator',
    version: '1.0.0',
    runtime: typeof Bun !== 'undefined' ? 'Bun' : 'Node.js'
  });
});

// SEPARATE x402 endpoint for x402scan registration (bypasses agent-kit)
honoApp.post('/simulate-transaction-x402', async (c) => {
  const paymentHeader = c.req.header('X-PAYMENT');

  if (!paymentHeader) {
    // Return 402 with x402scan-compliant schema
    console.log('[402] x402scan endpoint - returning 402');
    return c.json(
      {
        x402Version: 1,
        accepts: [
          {
            scheme: 'exact',
            network: 'base',
            maxAmountRequired: '30000', // 0.03 USDC
            resource: 'https://transaction-simulator-production.up.railway.app/simulate-transaction-x402',
            description:
              'Simulate transactions before execution to preview outcomes and estimate gas',
            mimeType: 'application/json',
            payTo: WALLET_ADDRESS,
            maxTimeoutSeconds: 300,
            asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
            outputSchema: {
              input: {
                type: 'http',
                method: 'POST',
                discoverable: true,
                bodyType: 'json',
                bodyFields: {
                  chain_id: {
                    type: 'number',
                    required: true,
                    description: 'Blockchain chain ID',
                    examples: [1, 56, 137, 42161, 10, 8453, 43114]
                  },
                  from_address: {
                    type: 'string',
                    required: true,
                    description: 'Transaction sender address',
                    pattern: '^0x[a-fA-F0-9]{40}$'
                  },
                  to_address: {
                    type: 'string',
                    required: true,
                    description: 'Transaction recipient or contract address',
                    pattern: '^0x[a-fA-F0-9]{40}$'
                  },
                  value: {
                    type: 'string',
                    required: false,
                    description: 'Value to send in hex',
                    default: '0x0'
                  },
                  data: {
                    type: 'string',
                    required: false,
                    description: 'Transaction data payload in hex',
                    default: '0x'
                  }
                }
              },
              output: {
                type: 'object',
                required: ['success', 'gas_used', 'gas_cost_eth', 'gas_cost_usd', 'chain_id'],
                properties: {
                  success: {
                    type: 'boolean',
                    description: 'Whether simulation succeeded'
                  },
                  gas_used: {
                    type: 'integer',
                    description: 'Estimated gas units'
                  },
                  gas_cost_eth: {
                    type: 'number',
                    description: 'Gas cost in ETH'
                  },
                  gas_cost_usd: {
                    type: 'number',
                    description: 'Gas cost in USD'
                  },
                  gas_price_gwei: {
                    type: 'number',
                    description: 'Current gas price in gwei'
                  },
                  error: {
                    type: ['string', 'null'],
                    description: 'Error message if failed'
                  },
                  asset_changes: {
                    type: 'array',
                    description: 'Detected asset transfers'
                  },
                  warnings: {
                    type: 'array',
                    description: 'Warnings about the transaction'
                  },
                  chain_id: {
                    type: 'integer',
                    description: 'Chain ID of simulation'
                  }
                }
              }
            },
          },
        ],
      },
      402
    );
  }

  // With payment - process simulation
  try {
    const body = await c.req.json();
    const result = await simulateTransaction(body as SimulationRequest);
    return c.json(result);
  } catch (error: any) {
    console.error('[ERROR] Simulation failed:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Middleware to intercept and enhance 402 responses - MUST be registered BEFORE entrypoint
honoApp.use('/entrypoints/simulate-transaction/invoke', async (c, next) => {
  console.log('[MIDDLEWARE] Intercepting invoke endpoint');

  const paymentHeader = c.req.header('X-PAYMENT');

  // If payment present, let agent-kit handle the request
  if (paymentHeader) {
    return await next();
  }

  // No payment - return our custom 402 with complete outputSchema
  console.log('[MIDDLEWARE] Returning custom 402 with output schema');
  return c.json(
      {
        x402Version: 1,
        accepts: [
          {
            scheme: 'exact',
            network: NETWORK,
            maxAmountRequired: '30000', // $0.03 in USDC (6 decimals)
            resource: `https://transaction-simulator-production.up.railway.app/entrypoints/simulate-transaction/invoke`,
            description: 'Simulate a transaction to preview outcomes before execution - gas costs, asset changes, and failure prediction',
            mimeType: 'application/json',
            payTo: WALLET_ADDRESS,
            maxTimeoutSeconds: 300,
            asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
            outputSchema: {
              input: {
                type: 'http',
                method: 'POST',
                discoverable: true,
                bodyType: 'json',
                bodyFields: {
                  chain_id: {
                    type: 'integer',
                    required: true,
                    description: 'Chain ID (1=Ethereum, 56=BSC, 137=Polygon, 42161=Arbitrum, 10=Optimism, 8453=Base, 43114=Avalanche)'
                  },
                  from_address: {
                    type: 'string',
                    required: true,
                    description: 'Sender address (0x...)'
                  },
                  to_address: {
                    type: 'string',
                    required: true,
                    description: 'Recipient/contract address (0x...)'
                  },
                  value: {
                    type: 'string',
                    required: false,
                    description: 'Value to send in hex wei (e.g. 0x0 for no value)'
                  },
                  data: {
                    type: 'string',
                    required: false,
                    description: 'Transaction data (0x... for contract calls)'
                  }
                }
              },
              output: {
                type: 'object',
                description: 'Transaction simulation results with gas estimates and asset changes',
                required: ['success', 'gas_used', 'gas_cost_eth', 'gas_cost_usd', 'chain_id'],
                properties: {
                  success: {
                    type: 'boolean',
                    description: 'Whether the transaction is expected to succeed'
                  },
                  gas_used: {
                    type: 'integer',
                    description: 'Estimated gas units consumed'
                  },
                  gas_cost_eth: {
                    type: 'number',
                    description: 'Gas cost in ETH/native currency'
                  },
                  gas_cost_usd: {
                    type: 'number',
                    description: 'Gas cost in USD'
                  },
                  gas_price_gwei: {
                    type: 'number',
                    description: 'Current gas price in gwei'
                  },
                  error: {
                    type: ['string', 'null'],
                    description: 'Error message if simulation failed'
                  },
                  asset_changes: {
                    type: 'array',
                    description: 'Detected asset transfers',
                    items: {
                      type: 'object',
                      properties: {
                        asset_type: { type: 'string', description: 'NATIVE, ERC20, or ERC721' },
                        change_type: { type: 'string', description: 'TRANSFER, MINT, BURN' },
                        from: { type: 'string', description: 'Source address' },
                        to: { type: 'string', description: 'Destination address' },
                        amount_wei: { type: 'string', description: 'Amount in wei' },
                        amount_eth: { type: 'number', description: 'Amount in ETH' },
                        symbol: { type: 'string', description: 'Token symbol' }
                      }
                    }
                  },
                  warnings: {
                    type: 'array',
                    description: 'Warnings about the transaction',
                    items: { type: 'string' }
                  },
                  chain_id: {
                    type: 'integer',
                    description: 'Chain ID where simulation was performed'
                  },
                  simulation_method: {
                    type: 'string',
                    description: 'Method used: eth_call, tenderly, or error'
                  }
                }
              }
            }
          }
        ]
      },
      402
    );
});

console.log('[STARTUP] Middleware to override outputSchema registered ✓');

// Register agent-kit entrypoint with outputSchema
app.addEntrypoint({
  key: 'simulate-transaction',
  name: 'Simulate Transaction',
  description: 'Simulate a transaction to preview outcomes before execution - gas costs, asset changes, and failure prediction',
  price: '$0.03',
  metadata: {
    'og:title': 'Transaction Simulator - x402 Agent',
    'og:description': 'Preview transaction outcomes before execution - gas costs, asset changes, and failure prediction across 7 EVM chains',
    'og:image': 'https://transaction-simulator-production.up.railway.app/og-image.png',
    'og:url': 'https://transaction-simulator-production.up.railway.app/entrypoints/simulate-transaction/invoke'
  } as any,
  outputSchema: {
    input: {
      type: 'http',
      method: 'POST',
      discoverable: true,
      bodyType: 'json',
      bodyFields: {
        chain_id: {
          type: 'integer',
          required: true,
          description: 'Chain ID (1=Ethereum, 56=BSC, 137=Polygon, 42161=Arbitrum, 10=Optimism, 8453=Base, 43114=Avalanche)'
        },
        from_address: {
          type: 'string',
          required: true,
          description: 'Sender address (0x...)'
        },
        to_address: {
          type: 'string',
          required: true,
          description: 'Recipient/contract address (0x...)'
        },
        value: {
          type: 'string',
          required: false,
          description: 'Value to send in hex wei (e.g. 0x0 for no value)'
        },
        data: {
          type: 'string',
          required: false,
          description: 'Transaction data (0x... for contract calls)'
        }
      }
    },
    output: {
      type: 'object',
      description: 'Transaction simulation results with gas estimates and asset changes',
      required: ['success', 'gas_used', 'gas_cost_eth', 'gas_cost_usd', 'chain_id'],
      properties: {
        success: { type: 'boolean', description: 'Whether the transaction is expected to succeed' },
        gas_used: { type: 'integer', description: 'Estimated gas units consumed' },
        gas_cost_eth: { type: 'number', description: 'Gas cost in ETH/native currency' },
        gas_cost_usd: { type: 'number', description: 'Gas cost in USD' },
        gas_price_gwei: { type: 'number', description: 'Current gas price in gwei' },
        error: { type: ['string', 'null'], description: 'Error message if simulation failed' },
        asset_changes: {
          type: 'array',
          description: 'Detected asset transfers',
          items: {
            type: 'object',
            properties: {
              asset_type: { type: 'string', description: 'NATIVE, ERC20, or ERC721' },
              change_type: { type: 'string', description: 'TRANSFER, MINT, BURN' },
              from: { type: 'string', description: 'Source address' },
              to: { type: 'string', description: 'Destination address' },
              amount_wei: { type: 'string', description: 'Amount in wei' },
              amount_eth: { type: 'number', description: 'Amount in ETH' },
              symbol: { type: 'string', description: 'Token symbol' }
            }
          }
        },
        warnings: {
          type: 'array',
          description: 'Warnings about the transaction',
          items: { type: 'string' }
        },
        chain_id: { type: 'integer', description: 'Chain ID where simulation was performed' },
        simulation_method: { type: 'string', description: 'Method used: eth_call, tenderly, or error' }
      }
    }
  } as any,
  handler: async (ctx) => {
    console.log('[AGENT-KIT] simulate-transaction handler called');
    const input = ctx.input as SimulationRequest;
    const result = await simulateTransaction(input);
    return result;
  },
});

console.log('[STARTUP] Agent-kit entrypoint registered ✓');

// OG Image endpoint (simple SVG) - register early
honoApp.get('/og-image.png', (c) => {
  const svg = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#0c2713"/>
  <text x="600" y="280" font-family="Arial" font-size="60" fill="#6de8a5" text-anchor="middle" font-weight="bold">Transaction Simulator</text>
  <text x="600" y="350" font-family="Arial" font-size="32" fill="#e6f4ea" text-anchor="middle">Preview tx outcomes before execution</text>
  <text x="600" y="420" font-family="Arial" font-size="24" fill="#76ad8b" text-anchor="middle">Gas costs · Asset changes · Failure prediction</text>
  <text x="600" y="500" font-family="Arial" font-size="20" fill="#76ad8b" text-anchor="middle">7 EVM Chains · x402 Payment Protocol</text>
</svg>`;
  c.header('Content-Type', 'image/svg+xml');
  return c.body(svg);
});

// ============================================
// STEP 5: Create Wrapper App for Custom Root HTML
// ============================================
console.log('[STARTUP] Step 5: Creating wrapper app with custom root HTML...');

// Create wrapper Hono app that intercepts root route BEFORE agent-kit
const wrapperApp = new Hono();

// Favicon endpoint
wrapperApp.get('/favicon.ico', (c) => {
  console.log('[WRAPPER] ✓ Serving favicon');
  // Simple SVG favicon (green transaction icon)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <rect width="100" height="100" fill="#10b981"/>
    <path d="M50 20 L80 50 L50 80 L20 50 Z" fill="#ffffff" stroke="#059669" stroke-width="3"/>
    <circle cx="50" cy="50" r="8" fill="#059669"/>
  </svg>`;
  c.header('Content-Type', 'image/svg+xml');
  return c.body(svg);
});

// Handle root route with custom HTML and OG metadata tags
wrapperApp.get('/', (c) => {
  console.log('[WRAPPER] ✓ Serving custom root HTML with OG tags');
  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Transaction Simulator - x402 Agent</title>
  <meta name="description" content="Preview transaction outcomes before execution - gas costs, asset changes, and failure prediction across 7 EVM chains">
  <link rel="icon" type="image/svg+xml" href="/favicon.ico">

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://transaction-simulator-production.up.railway.app/">
  <meta property="og:title" content="Transaction Simulator - x402 Agent">
  <meta property="og:description" content="Preview transaction outcomes before execution - gas costs, asset changes, and failure prediction across 7 EVM chains">
  <meta property="og:image" content="https://transaction-simulator-production.up.railway.app/og-image.png">

  <!-- Twitter -->
  <meta property="twitter:card" content="summary_large_image">
  <meta property="twitter:url" content="https://transaction-simulator-production.up.railway.app/">
  <meta property="twitter:title" content="Transaction Simulator - x402 Agent">
  <meta property="twitter:description" content="Preview transaction outcomes before execution - gas costs, asset changes, and failure prediction across 7 EVM chains">
  <meta property="twitter:image" content="https://transaction-simulator-production.up.railway.app/og-image.png">

  <style>
    body { font-family: system-ui; max-width: 800px; margin: 40px auto; padding: 20px; }
    h1 { color: #2563eb; }
    .endpoint { background: #f3f4f6; padding: 10px; border-radius: 8px; margin: 10px 0; }
    code { background: #e5e7eb; padding: 2px 6px; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>Transaction Simulator</h1>
  <p>Preview transaction outcomes before execution - gas costs, asset changes, and failure prediction</p>

  <h2>x402 Agent Endpoints</h2>
  <div class="endpoint">
    <strong>Invoke:</strong> <code>POST /entrypoints/simulate-transaction/invoke</code>
  </div>
  <div class="endpoint">
    <strong>Agent Discovery:</strong> <code>GET /.well-known/agent.json</code>
  </div>
  <div class="endpoint">
    <strong>Health:</strong> <code>GET /health</code>
  </div>

  <h2>Supported Chains</h2>
  <p>Ethereum, BSC, Polygon, Arbitrum, Optimism, Base, Avalanche</p>

  <p><small>Powered by agent-kit + viem</small></p>
</body>
</html>`);
});

// Forward ALL other requests to agent-kit's Hono app
wrapperApp.all('*', async (c) => {
  console.log(`[WRAPPER] Forwarding ${c.req.method} ${c.req.path} to agent-kit`);
  return honoApp.fetch(c.req.raw);
});

console.log('[STARTUP] Wrapper app created - will intercept root route with OG metadata ✓');

// ============================================
// STEP 6: Start Server (Auto-detect runtime)
// ============================================
console.log('[STARTUP] Step 6: Starting server...');

// Check if running in Bun
const isBun = typeof Bun !== 'undefined';
console.log(`[CONFIG] Detected runtime: ${isBun ? 'Bun' : 'Node.js'}`);

if (isBun) {
  // Use Bun's native server with wrapper app
  const server = Bun.serve({
    port: PORT,
    hostname: HOST,
    fetch: wrapperApp.fetch,
  });

  console.log(`[SUCCESS] ✓ Server running at http://${HOST}:${PORT} (Bun)`);
} else {
  // Use Node.js with @hono/node-server with wrapper app
  const { serve } = await import('@hono/node-server');

  const server = serve({
    fetch: wrapperApp.fetch,
    port: PORT,
    hostname: HOST,
  }, (info) => {
    console.log(`[SUCCESS] ✓ Server running at http://${info.address}:${info.port} (Node.js)`);
  });

  // Graceful shutdown for Node
  const shutdown = () => {
    console.log('[SHUTDOWN] Received shutdown signal');
    server.close(() => {
      console.log('[SHUTDOWN] Server stopped gracefully');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

console.log(`[SUCCESS] ✓ Health check: http://${HOST}:${PORT}/health`);
console.log(`[SUCCESS] ✓ Entrypoints: http://${HOST}:${PORT}/entrypoints`);
console.log('[SUCCESS] ===== READY TO ACCEPT REQUESTS =====');

// Keep-alive logging
setInterval(() => {
  console.log('[KEEPALIVE] Server is running...');
}, 30000);
