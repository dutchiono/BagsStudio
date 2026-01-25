Your 
FathomStaking.sol
 contract is a UUPS Upgradeable staking pool that incentivizes long-term locking of FTHM tokens in exchange for WETH rewards and governance power.

Here is the architectural breakdown based on the code:

1. Core Mechanics
Staking Token: Users stake FTHM (ERC20).
Reward Token: Users earn rewards in WETH (ERC20).
Upgradeability: The contract uses the UUPS (Universal Upgradeable Proxy Standard) pattern, allowing you to upgrade logic while preserving state.
Security: Uses ReentrancyGuard, Ownable for admin controls, and follows the Checks-Effects-Interactions pattern.
2. Time-Weighted Staking
Instead of a simple "amount staked," the system calculates a Weighted Stake (amount * multiplier) which determines both Voting Power and Fee Share.

Lock Period	Multiplier	Boost
1 Day	100	1.0x
3 Days	110	1.1x
7 Days	130	1.3x
14 Days	160	1.6x
30 Days	200	2.0x
3. Fee Distribution Logic
Fees are distributed in WETH via the distributeFeesWETH(amount) function. The contract pushes WETH into the contract and splits it three ways:

60% → Stakers: Distributed proportionally based on weightedAmount.
25% → Treasury: Sent directly to the defined treasury address.
15% → Burn: Sent to the 0x...dEaD address.
How Staker Rewards Work: It uses a scaler algorithm (similar to MasterChef/Synthetix) to allow O(1) fee distribution.

Global State: A feePerWeightedStake variable increases whenever new fees are added.
User State: Each stake tracks a feeDebt.
Claiming: Pending Reward = (userWeighted * feePerWeightedStake) - feeDebt.
4. Key Functions
stake(amount, lockPeriod): Locks FTHM, calculates weight, and "snapshots" the current fee debt so users only earn future fees.
unstake(stakeIndex): Only allowed after block.timestamp >= unlockTime. Claims pending WETH fees automatically before returning FTHM.
claimAllFees(): Iterates through all user stakes and claims pending WETH rewards without unstaking.
getVotingPower(user): Returns the sum of all weightedAmount across a user's active stakes.
5. Configurable Parameters (Admin)
The contract owner can specificially tune the fee split percentages (stakerFeePercent, treasuryFeePercent, burnFeePercent) as long as they sum to 100%, and update the treasury address.