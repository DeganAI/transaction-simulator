"""
Transaction Simulation Engine - Preview transaction outcomes before execution
"""
import logging
from typing import Dict, List, Optional
from web3 import Web3
from eth_utils import to_checksum_address
import aiohttp

logger = logging.getLogger(__name__)


class SimulationEngine:
    """
    Simulate transactions to preview outcomes before execution

    Features:
    - Asset transfer preview
    - Gas estimation
    - Failure prediction
    - State changes analysis
    """

    def __init__(self, rpc_urls: Dict[int, str]):
        """
        Initialize with RPC URLs for different chains

        Args:
            rpc_urls: Dict mapping chain_id to RPC URL
        """
        self.rpc_urls = rpc_urls
        self.w3_instances = {}

        for chain_id, rpc_url in rpc_urls.items():
            if rpc_url:
                try:
                    self.w3_instances[chain_id] = Web3(Web3.HTTPProvider(rpc_url))
                    logger.info(f"Initialized Web3 for chain {chain_id}")
                except Exception as e:
                    logger.error(f"Failed to initialize Web3 for chain {chain_id}: {e}")

    async def simulate_transaction(
        self,
        chain_id: int,
        from_address: str,
        to_address: str,
        value: str = "0x0",
        data: str = "0x",
        gas: Optional[str] = None,
        gas_price: Optional[str] = None
    ) -> Dict:
        """
        Simulate a transaction and return predicted outcomes

        Args:
            chain_id: Blockchain ID
            from_address: Sender address
            to_address: Recipient/contract address
            value: ETH value in hex (default: 0x0)
            data: Transaction data in hex (default: 0x)
            gas: Gas limit in hex (optional)
            gas_price: Gas price in hex (optional)

        Returns:
            Dict with simulation results including:
            - success: bool
            - gas_used: int
            - gas_cost_eth: float
            - gas_cost_usd: float (estimated)
            - error: str or None
            - asset_changes: List of predicted transfers
            - warnings: List of potential issues
        """
        try:
            w3 = self.w3_instances.get(chain_id)
            if not w3:
                return {
                    "success": False,
                    "error": f"Chain {chain_id} not supported",
                    "chain_id": chain_id
                }

            # Normalize addresses - use simple validation
            def normalize_address(addr: str) -> str:
                """Simple address normalization without strict checksum validation"""
                addr = addr.strip()
                if not addr.startswith('0x') or len(addr) != 42:
                    raise ValueError(f"Invalid address format: {addr}")
                return addr

            try:
                from_addr = normalize_address(from_address)
                to_addr = normalize_address(to_address)
            except Exception as e:
                return {
                    "success": False,
                    "error": f"Invalid address: {str(e)}",
                    "chain_id": chain_id
                }

            # Build transaction dict
            tx = {
                "from": from_addr,
                "to": to_addr,
                "value": int(value, 16) if isinstance(value, str) and value.startswith("0x") else int(value),
                "data": data
            }

            # Add optional parameters
            if gas:
                tx["gas"] = int(gas, 16) if isinstance(gas, str) and gas.startswith("0x") else int(gas)
            if gas_price:
                tx["gasPrice"] = int(gas_price, 16) if isinstance(gas_price, str) and gas_price.startswith("0x") else int(gas_price)

            # Simulate with eth_call to check for reverts
            try:
                result = w3.eth.call(tx)
                simulation_success = True
                error_msg = None
            except Exception as call_error:
                simulation_success = False
                error_msg = str(call_error)
                logger.warning(f"eth_call failed: {error_msg}")

            # Estimate gas
            try:
                gas_estimate = w3.eth.estimate_gas(tx)
            except Exception as gas_error:
                gas_estimate = 21000  # Minimum for simple transfer
                if not error_msg:
                    error_msg = f"Gas estimation failed: {str(gas_error)}"
                logger.warning(f"Gas estimation failed: {gas_error}")

            # Get current gas price
            try:
                current_gas_price = w3.eth.gas_price
            except:
                current_gas_price = w3.to_wei(20, 'gwei')  # Fallback

            # Calculate costs
            gas_cost_wei = gas_estimate * current_gas_price
            gas_cost_eth = w3.from_wei(gas_cost_wei, 'ether')

            # Estimate USD cost (rough estimate based on chain)
            eth_price_usd = await self._get_eth_price(chain_id)
            gas_cost_usd = float(gas_cost_eth) * eth_price_usd

            # Analyze asset changes
            asset_changes = await self._analyze_asset_changes(
                w3, from_addr, to_addr, tx.get("value", 0), data
            )

            # Generate warnings
            warnings = self._generate_warnings(
                simulation_success, gas_estimate, gas_cost_usd, asset_changes
            )

            return {
                "success": simulation_success,
                "gas_used": gas_estimate,
                "gas_cost_eth": float(gas_cost_eth),
                "gas_cost_usd": round(gas_cost_usd, 4),
                "gas_price_gwei": float(w3.from_wei(current_gas_price, 'gwei')),
                "error": error_msg,
                "asset_changes": asset_changes,
                "warnings": warnings,
                "chain_id": chain_id,
                "simulation_method": "eth_call"
            }

        except Exception as e:
            logger.error(f"Simulation error: {e}")
            return {
                "success": False,
                "error": f"Simulation failed: {str(e)}",
                "chain_id": chain_id
            }

    async def _analyze_asset_changes(
        self, w3: Web3, from_addr: str, to_addr: str, value: int, data: str
    ) -> List[Dict]:
        """Analyze predicted asset changes from transaction"""
        changes = []

        # ETH transfer
        if value > 0:
            changes.append({
                "asset_type": "NATIVE",
                "change_type": "TRANSFER",
                "from": from_addr,
                "to": to_addr,
                "amount_wei": value,
                "amount_eth": float(w3.from_wei(value, 'ether')),
                "symbol": "ETH"
            })

        # TODO: Parse ERC20/ERC721 transfers from data
        # This would require decoding transaction data for token transfers

        return changes

    async def _get_eth_price(self, chain_id: int) -> float:
        """Get rough ETH price estimate for gas cost calculation"""
        # Simplified price estimates per chain
        prices = {
            1: 3000,    # Ethereum
            10: 3000,   # Optimism
            56: 600,    # BSC (BNB)
            137: 1.0,   # Polygon (MATIC)
            42161: 3000,  # Arbitrum
            8453: 3000,   # Base
            43114: 40,    # Avalanche (AVAX)
        }
        return prices.get(chain_id, 3000)

    def _generate_warnings(
        self,
        success: bool,
        gas_estimate: int,
        gas_cost_usd: float,
        asset_changes: List[Dict]
    ) -> List[str]:
        """Generate warnings about potential issues"""
        warnings = []

        if not success:
            warnings.append("⚠️ Transaction will likely FAIL - Do not execute")

        if gas_estimate > 1000000:
            warnings.append(f"⚠️ Very high gas usage: {gas_estimate:,} gas")

        if gas_cost_usd > 10:
            warnings.append(f"⚠️ High gas cost: ${gas_cost_usd:.2f}")

        if gas_cost_usd > 50:
            warnings.append("🚫 EXTREMELY HIGH GAS COST - Verify transaction details")

        if len(asset_changes) == 0:
            warnings.append("ℹ️ No asset transfers detected")

        return warnings
