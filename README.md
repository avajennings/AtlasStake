# AtlasStake

AtlasStake is a confidential staking app for mETH built on Zama FHEVM. Users claim encrypted mETH, stake privately, and decrypt balances only when they choose.

## Overview

AtlasStake combines an encrypted ERC7984-style token with a private staking vault. All sensitive amounts are stored and processed as ciphertext using Zama Fully Homomorphic Encryption (FHE). The contract never sees plaintext values, yet still enforces staking and withdrawal rules.

## Problem Statement

Public blockchains expose balances and stake sizes, which leaks user behavior, strategy, and financial posture. Conventional staking flows make it trivial to:
- Track large positions
- Infer trading patterns
- Front-run exits or entries

AtlasStake aims to keep stake amounts private while retaining verifiable on-chain execution.

## Solution Summary

AtlasStake uses Zama FHEVM to keep balances encrypted on-chain. Users interact through a relayer to encrypt inputs and decrypt outputs. The contract verifies and updates state over ciphertext, while the frontend reveals plaintext only to the wallet owner.

## Key Features

- One-time mETH claim with a fixed encrypted amount
- Confidential staking with encrypted inputs and balances
- Private withdrawals with enforced limits
- On-demand balance decryption in the UI
- Events for claim, stake, and withdrawal actions

## Advantages

- Privacy by default: balances and stake sizes stay encrypted
- Selective disclosure: users decide when to decrypt
- Non-custodial: assets remain in the user wallet or the contract, never in a relayer
- Deterministic logic: staking and withdrawal rules are enforced on-chain
- Minimal trust: the relayer assists with encryption and decryption, but cannot move funds

## How It Works

### Components

- Smart contracts: encrypted token, staking vault, and access control for encrypted values
- Relayer: handles encryption/decryption requests per Zama FHEVM flow
- Frontend: prepares encrypted inputs, sends transactions, and decrypts results

### Claim Flow

1. User calls `claim()`.
2. Contract mints an encrypted amount defined by `CLAIM_AMOUNT` (100 * 1e6).
3. The encrypted balance is allowed for the caller.

### Stake Flow

1. Frontend encrypts a stake amount and produces an input proof.
2. User calls `stake(encryptedAmount, inputProof)`.
3. Contract transfers encrypted mETH into the vault and updates the encrypted stake balance.
4. Updated encrypted balance is allowed for the user and the contract.

### Withdraw Flow

1. Frontend encrypts a withdrawal amount and produces an input proof.
2. User calls `withdraw(encryptedAmount, inputProof)`.
3. Contract checks encrypted `requestedAmount <= stakedBalance` using FHE.
4. If the request exceeds the stake, the allowed withdrawal becomes zero.
5. Contract updates the encrypted stake and transfers the allowed amount back.

### Balance Decryption

1. Frontend reads encrypted balances via viem.
2. Relayer decrypts ciphertext for the wallet owner.
3. UI shows plaintext only after user confirmation.

## Smart Contract Details

- `contracts/AtlasStake.sol`: main contract with claim, stake, withdraw, and encrypted balance queries
- `CLAIM_AMOUNT`: fixed claim size (100 * 1e6 in base units)
- Errors: `AlreadyClaimed`, `NothingStaked`
- Events: `Claimed`, `Staked`, `Withdrawn`
- Encrypted state:
  - `_stakedBalances[address] -> euint64`
  - `_hasClaimed[address] -> bool`

`contracts/FHECounter.sol` is a minimal example contract from the FHEVM template and is not part of the AtlasStake product logic.

## Frontend Details

- Framework: React + Vite
- Wallet: RainbowKit
- Reads: viem
- Writes: ethers
- Encryption: Zama relayer SDK
- No Tailwind CSS
- No frontend environment variables
- No localhost network usage in the UI
- ABI is sourced from `deployments/sepolia` and copied into the app code

## Project Structure

```
AtlasStake/
├── app/                 # Frontend (React + Vite)
├── contracts/           # Solidity contracts
├── deploy/              # Deployment scripts
├── deployments/         # Deployment artifacts and ABI
├── tasks/               # Hardhat custom tasks
├── test/                # Hardhat tests
├── hardhat.config.ts    # Hardhat configuration
└── README.md            # This document
```

## Prerequisites

- Node.js 20+
- npm 7+
- A funded Sepolia account for deployment

## Configuration

Create a `.env` in the repo root for Hardhat:

```
INFURA_API_KEY=your_infura_key
PRIVATE_KEY=your_private_key
ETHERSCAN_API_KEY=optional_if_you_want_verification
```

Notes:
- Use a private key, not a mnemonic.
- The frontend does not use environment variables.

## Local Development

Install dependencies:

```
npm install
```

Compile and run tests:

```
npm run compile
npm run test
```

Optional local node for contract development:

```
npm run chain
npm run deploy:localhost
```

## Deploy to Sepolia

Before deploying, run tasks and tests:

```
npm run test
```

Deploy:

```
npm run deploy:sepolia
```

Verify:

```
npm run verify:sepolia <CONTRACT_ADDRESS>
```

## Frontend Usage

From the repo root:

```
cd app
npm install
npm run dev
```

Connect a wallet on Sepolia and interact with the claim, stake, and withdraw flows. Balances remain encrypted until you request decryption.

## Scripts

Common scripts from `package.json`:

- `npm run compile`: compile contracts
- `npm run test`: run tests
- `npm run coverage`: coverage
- `npm run lint`: lint Solidity and TypeScript
- `npm run clean`: clean build artifacts
- `npm run deploy:sepolia`: deploy to Sepolia
- `npm run verify:sepolia`: verify on Etherscan

## Security and Privacy Considerations

- Encrypted amounts are only decrypted for the requesting user.
- Decrypting a balance reveals plaintext to the user and any device or service in their trust boundary.
- FHE protects on-chain values but does not protect off-chain UI state.
- Treat private keys as production secrets and do not expose them in logs or CI output.

## Limitations

- Fixed claim amount per address
- No staking rewards or lockup periods yet
- Single chain focus (Sepolia for now)

## Future Roadmap

- Configurable staking rewards
- Lockup periods and early withdrawal policies
- Multi-asset support beyond mETH
- Better analytics and encrypted portfolio views
- Relayer redundancy and higher availability
- Formal security review and audit

## Documentation

- Zama FHEVM docs: https://docs.zama.ai/fhevm
- Hardhat FHEVM setup: https://docs.zama.ai/protocol/solidity-guides/getting-started/setup
- FHEVM testing guide: https://docs.zama.ai/protocol/solidity-guides/development-guide/hardhat/write_test

## License

BSD-3-Clause-Clear. See `LICENSE`.
