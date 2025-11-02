import { createAgentApp } from '@lucid-dreams/agent-kit';
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
// STEP 2: Chain Configuration
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

// ============================================
// STEP 3: Simulation Engine
// ============================================
console.log('[STARTUP] Step 3: Setting up simulation engine...');

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

console.log('[STARTUP] Simulation engine ready ✓');

// ============================================
// STEP 4: Create Agent App
// ============================================
console.log('[STARTUP] Step 4: Creating agent app...');

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

// Access the underlying Hono app
const honoApp = app.app;

// ============================================
// STEP 5: Define Entrypoints
// ============================================
console.log('[STARTUP] Step 5: Defining entrypoints...');

// Health check
honoApp.get('/health', (c) => {
  console.log('[HEALTH] Health check requested');
  return c.json({
    ok: true,
    version: '1.0.0',
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
                bodyType: 'json',
                bodyFields: {
                  chain_id: {
                    type: 'number',
                    required: true,
                    description: 'Blockchain ID (1=Ethereum, 56=BSC, etc.)',
                  },
                  from_address: {
                    type: 'string',
                    required: true,
                    description: 'Sender address',
                  },
                  to_address: {
                    type: 'string',
                    required: true,
                    description: 'Recipient or contract address',
                  },
                  value: {
                    type: 'string',
                    required: false,
                    description: 'ETH value in hex (default: 0x0)',
                  },
                  data: {
                    type: 'string',
                    required: false,
                    description: 'Transaction data in hex (default: 0x)',
                  },
                },
              },
              output: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', description: 'Simulation success' },
                  gas_used: { type: 'integer', description: 'Estimated gas' },
                  gas_cost_eth: { type: 'number', description: 'Cost in ETH' },
                  gas_cost_usd: { type: 'number', description: 'Cost in USD' },
                  warnings: { type: 'array', description: 'Potential issues' },
                },
              },
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

// Agent-kit entrypoint for discovery
app.addEntrypoint({
  key: 'simulate-transaction',
  name: 'Simulate Transaction',
  description:
    'Simulate a transaction to preview outcomes before execution - gas costs, asset changes, and failure prediction',
  price: '$0.03',
  handler: async (ctx) => {
    console.log('[AGENT-KIT] simulate-transaction called');

    const input = ctx.input as SimulationRequest;
    const result = await simulateTransaction(input);

    return result;
  },
});

console.log('[STARTUP] Entrypoints defined ✓');

// Manual .well-known/x402 endpoint (add AFTER entrypoints to avoid route conflicts)
honoApp.get('/.well-known/x402', (c) => {
  console.log('[402] .well-known/x402 endpoint requested');
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
        },
      ],
    },
    402
  );
});

console.log('[STARTUP] .well-known/x402 endpoint registered ✓');

// ============================================
// STEP 6: Start Server (Auto-detect runtime)
// ============================================
console.log('[STARTUP] Step 6: Starting server...');

// Check if running in Bun
const isBun = typeof Bun !== 'undefined';
console.log(`[CONFIG] Detected runtime: ${isBun ? 'Bun' : 'Node.js'}`);

if (isBun) {
  // Use Bun's native server
  const server = Bun.serve({
    port: PORT,
    hostname: HOST,
    fetch: honoApp.fetch,
  });

  console.log(`[SUCCESS] ✓ Server running at http://${HOST}:${PORT} (Bun)`);
} else {
  // Use Node.js with @hono/node-server
  const { serve } = await import('@hono/node-server');

  const server = serve(
    {
      fetch: honoApp.fetch,
      port: PORT,
      hostname: HOST,
    },
    (info) => {
      console.log(`[SUCCESS] ✓ Server running at http://${info.address}:${info.port} (Node.js)`);
    }
  );

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
console.log(`[SUCCESS] ✓ x402 endpoint: http://${HOST}:${PORT}/simulate-transaction-x402`);
console.log('[SUCCESS] ===== READY TO ACCEPT REQUESTS =====');

// Keep-alive logging
setInterval(() => {
  console.log('[KEEPALIVE] Server is running...');
}, 30000);
