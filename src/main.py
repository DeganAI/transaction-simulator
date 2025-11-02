"""
Transaction Simulator - Preview transaction outcomes before execution

x402-enabled microservice for simulating Ethereum transactions
"""
import logging
import os
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, Response
from pydantic import BaseModel, Field
from dotenv import load_dotenv

from .simulation_engine import SimulationEngine
from .x402_middleware_dual import X402Middleware

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI
app = FastAPI(
    title="Transaction Simulator",
    description="Preview transaction outcomes before execution - gas costs, asset changes, and failure prediction",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
FREE_MODE = os.getenv("FREE_MODE", "true").lower() == "true"
PAYMENT_ADDRESS = os.getenv("PAYMENT_ADDRESS", "0x01D11F7e1a46AbFC6092d7be484895D2d505095c")
PORT = int(os.getenv("PORT", "8000"))
BASE_URL = os.getenv("BASE_URL", f"http://localhost:{PORT}")

# RPC URLs
RPC_URLS = {
    1: os.getenv("ETHEREUM_RPC_URL", "https://eth.llamarpc.com"),
    56: os.getenv("BSC_RPC_URL", "https://bsc-dataseed1.binance.org"),
    137: os.getenv("POLYGON_RPC_URL", "https://polygon-rpc.com"),
    42161: os.getenv("ARBITRUM_RPC_URL", "https://arb1.arbitrum.io/rpc"),
    10: os.getenv("OPTIMISM_RPC_URL", "https://mainnet.optimism.io"),
    8453: os.getenv("BASE_RPC_URL", "https://mainnet.base.org"),
    43114: os.getenv("AVALANCHE_RPC_URL", "https://api.avax.network/ext/bc/C/rpc"),
}

# Initialize simulation engine
simulation_engine = SimulationEngine(RPC_URLS)
supported_chains = [chain_id for chain_id, url in RPC_URLS.items() if url]

if FREE_MODE:
    logger.warning("Running in FREE MODE - no payment verification")
else:
    logger.info("x402 payment verification enabled with dual facilitators")

logger.info(f"Simulation engine initialized with {len(supported_chains)} chains")

# x402 Payment Middleware
payment_address = PAYMENT_ADDRESS
base_url = BASE_URL.rstrip('/')

app.add_middleware(
    X402Middleware,
    payment_address=payment_address,
    base_url=base_url,
    facilitator_urls=[
        "https://facilitator.daydreams.systems",
        "https://api.cdp.coinbase.com/platform/v2/x402/facilitator"
    ],
    free_mode=FREE_MODE,
)


# Request/Response Models
class SimulationRequest(BaseModel):
    """Transaction simulation request"""
    chain_id: int = Field(..., description="Blockchain ID (1=Ethereum, 56=BSC, etc.)")
    from_address: str = Field(..., description="Sender address")
    to_address: str = Field(..., description="Recipient or contract address")
    value: str = Field(default="0x0", description="ETH value in hex (default: 0x0)")
    data: str = Field(default="0x", description="Transaction data in hex (default: 0x)")
    gas: Optional[str] = Field(default=None, description="Gas limit in hex (optional)")
    gas_price: Optional[str] = Field(default=None, description="Gas price in hex (optional)")

    class Config:
        json_schema_extra = {
            "example": {
                "chain_id": 1,
                "from_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
                "to_address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
                "value": "0x0",
                "data": "0xa9059cbb000000000000000000000000742d35cc6634c0532925a3b844bc9e7595f0beb0000000000000000000000000000000000000000000000000000000000989680"
            }
        }


class SimulationResponse(BaseModel):
    """Transaction simulation results"""
    success: bool = Field(..., description="Whether simulation succeeded")
    gas_used: int = Field(default=0, description="Estimated gas usage")
    gas_cost_eth: float = Field(default=0.0, description="Gas cost in ETH")
    gas_cost_usd: float = Field(default=0.0, description="Gas cost in USD (estimated)")
    gas_price_gwei: float = Field(default=0.0, description="Current gas price in gwei")
    error: Optional[str] = Field(None, description="Error message if failed")
    asset_changes: list = Field(default_factory=list, description="Predicted asset transfers")
    warnings: list = Field(default_factory=list, description="Potential issues or concerns")
    chain_id: int = Field(..., description="Blockchain ID")
    simulation_method: str = Field(default="unknown", description="Simulation method used")
    timestamp: str = Field(..., description="Simulation timestamp")


# API Endpoints
@app.get("/", response_class=HTMLResponse)
async def landing_page():
    """Landing page with metadata"""
    html_content = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Transaction Simulator</title>
    <meta property="og:title" content="Transaction Simulator">
    <meta property="og:description" content="Simulate transactions before execution via x402 micropayments">
    <meta property="og:image" content="https://transaction-simulator-production.up.railway.app/favicon.ico">
    <link rel="icon" href="/favicon.ico" type="image/svg+xml">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
            line-height: 1.6;
            color: #333;
        }
        h1 { color: #2c3e50; }
        .endpoint {
            background: #f5f5f5;
            padding: 10px;
            margin: 10px 0;
            border-radius: 5px;
            font-family: monospace;
        }
        .links { margin-top: 30px; }
        .links a {
            display: inline-block;
            margin: 5px 10px 5px 0;
            color: #3498db;
            text-decoration: none;
        }
        .links a:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <h1>🎮 Transaction Simulator</h1>
    <p>Preview transaction outcomes before execution - gas costs, asset changes, and failure prediction via x402 micropayments.</p>

    <h2>Features</h2>
    <ul>
        <li>Multi-chain transaction simulation</li>
        <li>Gas cost estimation</li>
        <li>Failure prediction</li>
        <li>Asset change preview</li>
        <li>x402 micropayment enabled</li>
    </ul>

    <h2>Endpoints</h2>
    <div class="endpoint">POST /entrypoints/transaction-simulator/invoke</div>
    <div class="endpoint">GET /.well-known/agent.json</div>
    <div class="endpoint">GET /.well-known/x402</div>

    <div class="links">
        <a href="/docs">API Documentation</a>
        <a href="/.well-known/agent.json">Agent Metadata</a>
        <a href="/.well-known/x402">x402 Metadata</a>
    </div>
</body>
</html>
    """
    return HTMLResponse(content=html_content)


@app.get("/favicon.ico")
async def favicon():
    """Return SVG favicon with game controller emoji"""
    svg_content = """
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <text y="80" font-size="80">🎮</text>
</svg>
    """
    return Response(content=svg_content, media_type="image/svg+xml")


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "transaction-simulator",
        "version": "1.0.0",
        "free_mode": FREE_MODE,
        "supported_chains": len(supported_chains),
        "chain_ids": supported_chains
    }


@app.get("/entrypoints/transaction-simulator/invoke")
@app.head("/entrypoints/transaction-simulator/invoke")
async def get_transaction_simulator_metadata():
    """Return x402 payment metadata for transaction simulator endpoint"""
    from fastapi.responses import JSONResponse

    metadata = {
        "x402Version": 1,
        "accepts": [
            {
                "scheme": "exact",
                "network": "base",
                "maxAmountRequired": "30000",  # 0.03 USDC
                "resource": f"{base_url}/entrypoints/transaction-simulator/invoke",
                "description": "Simulate transactions before execution to preview outcomes and estimate gas",
                "mimeType": "application/json",
                "payTo": payment_address,
                "maxTimeoutSeconds": 30,
                "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",  # USDC on Base
                "outputSchema": {
                    "input": {
                        "type": "http",
                        "method": "POST",
                        "bodyType": "json",
                        "bodyFields": {
                            "chain_id": {
                                "type": "number",
                                "required": True,
                                "description": "Blockchain ID (1=Ethereum, 56=BSC, etc.)"
                            },
                            "from_address": {
                                "type": "string",
                                "required": True,
                                "description": "Sender address"
                            },
                            "to_address": {
                                "type": "string",
                                "required": True,
                                "description": "Recipient or contract address"
                            },
                            "value": {
                                "type": "string",
                                "required": False,
                                "description": "ETH value in hex (default: 0x0)"
                            },
                            "data": {
                                "type": "string",
                                "required": False,
                                "description": "Transaction data in hex (default: 0x)"
                            },
                            "gas": {
                                "type": "string",
                                "required": False,
                                "description": "Gas limit in hex (optional)"
                            },
                            "gas_price": {
                                "type": "string",
                                "required": False,
                                "description": "Gas price in hex (optional)"
                            }
                        }
                    },
                    "output": {
                        "type": "object",
                        "description": "Transaction simulation result with success status and state changes"
                    }
                }
            }
        ]
    }

    return JSONResponse(content=metadata, status_code=402)


@app.post(
    "/entrypoints/transaction-simulator/invoke",
    response_model=SimulationResponse,
    summary="Simulate Transaction",
    description="Simulate a transaction to preview outcomes before execution"
)
async def simulate_transaction(request: SimulationRequest):
    """
    Simulate a transaction to preview its outcomes

    This endpoint simulates a transaction without broadcasting it to the network.
    It returns:
    - Gas cost estimates
    - Predicted asset changes
    - Success/failure prediction
    - Warnings about potential issues

    Useful for:
    - Previewing transactions before execution
    - Estimating gas costs
    - Detecting failures before spending gas
    - Identifying scam transactions
    """
    try:
        logger.info(
            f"Simulating transaction on chain {request.chain_id}: "
            f"{request.from_address} -> {request.to_address}"
        )

        # Simulate the transaction
        result = await simulation_engine.simulate_transaction(
            chain_id=request.chain_id,
            from_address=request.from_address,
            to_address=request.to_address,
            value=request.value,
            data=request.data,
            gas=request.gas,
            gas_price=request.gas_price
        )

        # Add timestamp
        result["timestamp"] = datetime.utcnow().isoformat() + "Z"

        return SimulationResponse(**result)

    except Exception as e:
        logger.error(f"Simulation error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Simulation failed: {str(e)}")


# Agent Discovery Endpoints
@app.get("/.well-known/agent.json")
async def agent_metadata():
    """Agent metadata for service discovery"""
    return {
        "name": "Transaction Simulator",
        "description": "Preview transaction outcomes before execution - gas costs, asset changes, and failure prediction. Prevents costly mistakes and scam transactions.",
        "url": f"{base_url}/",
        "version": "1.0.0",
        "capabilities": {
            "streaming": False,
            "pushNotifications": False,
            "stateTransitionHistory": True,
            "extensions": [
                {
                    "uri": "https://github.com/google-agentic-commerce/ap2/tree/v0.1",
                    "description": "Agent Payments Protocol (AP2)",
                    "required": True,
                    "params": {"roles": ["merchant"]}
                }
            ]
        },
        "defaultInputModes": ["application/json"],
        "defaultOutputModes": ["application/json"],
        "skills": [
            {
                "id": "transaction-simulation",
                "name": "transaction-simulation",
                "description": "Simulate transactions to preview outcomes before execution",
                "inputModes": ["application/json"],
                "outputModes": ["application/json"],
                "streaming": False,
                "x_input_schema": {
                    "$schema": "https://json-schema.org/draft/2020-12/schema",
                    "type": "object",
                    "properties": {
                        "chain_id": {"type": "integer", "description": "Blockchain ID"},
                        "from_address": {"type": "string", "description": "Sender address"},
                        "to_address": {"type": "string", "description": "Recipient address"},
                        "value": {"type": "string", "description": "ETH value in hex"},
                        "data": {"type": "string", "description": "Transaction data"}
                    },
                    "required": ["chain_id", "from_address", "to_address"]
                }
            }
        ],
        "entrypoints": {
            "transaction-simulator": {
                "description": "Simulate transactions across multiple chains",
                "streaming": False,
                "input_schema": {
                    "$schema": "https://json-schema.org/draft/2020-12/schema",
                    "type": "object",
                    "properties": {
                        "chain_id": {"type": "integer"},
                        "from_address": {"type": "string"},
                        "to_address": {"type": "string"},
                        "value": {"type": "string"},
                        "data": {"type": "string"}
                    },
                    "required": ["chain_id", "from_address", "to_address"]
                },
                "output_schema": {
                    "$schema": "https://json-schema.org/draft/2020-12/schema",
                    "type": "object",
                    "properties": {
                        "success": {"type": "boolean"},
                        "gas_used": {"type": "integer"},
                        "gas_cost_eth": {"type": "number"},
                        "gas_cost_usd": {"type": "number"},
                        "warnings": {"type": "array"}
                    }
                },
                "pricing": {"invoke": "0.03 USDC"}
            }
        },
        "payments": [
            {
                "method": "x402",
                "payee": payment_address,
                "network": "base",
                "endpoint": "https://facilitator.daydreams.systems",
                "priceModel": {"default": "0.03"},
                "extensions": {
                    "x402": {"facilitatorUrl": "https://facilitator.daydreams.systems"}
                }
            }
        ]
    }


@app.get("/.well-known/x402")
async def x402_metadata():
    """x402 payment metadata"""
    return JSONResponse(content={
        "x402Version": 1,
        "accepts": [
            {
                "scheme": "exact",
                "network": "base",
                "maxAmountRequired": "30000",  # 0.03 USDC
                "resource": f"{base_url}/entrypoints/transaction-simulator/invoke",
                "description": "Transaction simulation - preview outcomes, gas costs, and failures before execution",
                "mimeType": "application/json",
                "payTo": payment_address,
                "maxTimeoutSeconds": 30,
                "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",  # USDC on Base
                "outputSchema": {
                    "input": {
                        "type": "http",
                        "method": "POST",
                        "bodyType": "json",
                        "bodyFields": {
                            "chain_id": {
                                "type": "integer",
                                "required": True,
                                "description": "Blockchain ID"
                            },
                            "from_address": {
                                "type": "string",
                                "required": True,
                                "description": "Sender address"
                            },
                            "to_address": {
                                "type": "string",
                                "required": True,
                                "description": "Recipient or contract address"
                            },
                            "value": {
                                "type": "string",
                                "required": False,
                                "description": "ETH value in hex (default: 0x0)"
                            },
                            "data": {
                                "type": "string",
                                "required": False,
                                "description": "Transaction data in hex (default: 0x)"
                            }
                        }
                    },
                    "output": {
                        "type": "object",
                        "properties": {
                            "success": {"type": "boolean", "description": "Simulation success"},
                            "gas_used": {"type": "integer", "description": "Estimated gas"},
                            "gas_cost_eth": {"type": "number", "description": "Cost in ETH"},
                            "gas_cost_usd": {"type": "number", "description": "Cost in USD"},
                            "warnings": {"type": "array", "description": "Potential issues"}
                        }
                    }
                },
                "extra": {
                    "supported_chains": [1, 56, 137, 42161, 10, 8453, 43114],
                    "features": [
                        "gas_estimation",
                        "failure_prediction",
                        "asset_change_preview",
                        "cost_calculation"
                    ],
                    "use_cases": [
                        "preview_transactions",
                        "estimate_gas",
                        "detect_failures",
                        "prevent_scams"
                    ]
                }
            }
        ]
    }, status_code=402)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
