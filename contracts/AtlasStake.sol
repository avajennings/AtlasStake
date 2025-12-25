// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {ERC7984} from "confidential-contracts-v91/contracts/token/ERC7984/ERC7984.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {FHE, ebool, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";

/// @title AtlasStake
/// @notice Confidential mETH token with staking and withdrawal built on Zama FHEVM.
contract AtlasStake is ERC7984, ZamaEthereumConfig {
    uint64 public constant CLAIM_AMOUNT = 100 * 1e6;

    mapping(address => euint64) private _stakedBalances;
    mapping(address => bool) private _hasClaimed;

    error AlreadyClaimed();
    error NothingStaked();

    event Claimed(address indexed account, euint64 encryptedAmount);
    event Staked(address indexed account, euint64 encryptedAmount);
    event Withdrawn(address indexed account, euint64 encryptedAmount);

    constructor() ERC7984("mETH", "mETH", "") {}

    /// @notice Mint a fixed amount of mETH to the caller.
    function claim() external {
        if (_hasClaimed[msg.sender]) revert AlreadyClaimed();

        euint64 amount = FHE.asEuint64(CLAIM_AMOUNT);
        euint64 mintedAmount = _mint(msg.sender, amount);
        _hasClaimed[msg.sender] = true;

        FHE.allow(mintedAmount, msg.sender);
        emit Claimed(msg.sender, mintedAmount);
    }

    /// @notice Stake an encrypted amount of mETH into the vault.
    /// @param encryptedAmount Encrypted amount provided by the frontend relayer.
    /// @param inputProof Proof associated with the encrypted input.
    function stake(externalEuint64 encryptedAmount, bytes calldata inputProof) external {
        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);
        euint64 transferred = _transfer(msg.sender, address(this), amount);

        euint64 currentStaked = _stakedBalances[msg.sender];
        if (!FHE.isInitialized(currentStaked)) {
            currentStaked = FHE.asEuint64(0);
        }

        euint64 updatedStake = FHE.add(currentStaked, transferred);
        _stakedBalances[msg.sender] = updatedStake;

        FHE.allowThis(updatedStake);
        FHE.allow(updatedStake, msg.sender);

        emit Staked(msg.sender, transferred);
    }

    /// @notice Withdraw a portion of the caller's staked mETH.
    /// @param encryptedAmount Encrypted amount requested for withdrawal.
    /// @param inputProof Proof associated with the encrypted input.
    function withdraw(externalEuint64 encryptedAmount, bytes calldata inputProof) external {
        euint64 currentStaked = _stakedBalances[msg.sender];
        if (!FHE.isInitialized(currentStaked)) revert NothingStaked();

        euint64 requestedAmount = FHE.fromExternal(encryptedAmount, inputProof);
        ebool canWithdraw = FHE.le(requestedAmount, currentStaked);
        euint64 allowedAmount = FHE.select(canWithdraw, requestedAmount, FHE.asEuint64(0));

        euint64 reducedStake = FHE.sub(currentStaked, allowedAmount);
        _stakedBalances[msg.sender] = reducedStake;

        FHE.allowThis(reducedStake);
        FHE.allow(reducedStake, msg.sender);

        euint64 sent = _transfer(address(this), msg.sender, allowedAmount);
        emit Withdrawn(msg.sender, sent);
    }

    /// @notice Returns the encrypted staked balance for a user.
    /// @param account Address to query.
    function stakedBalanceOf(address account) external view returns (euint64) {
        return _stakedBalances[account];
    }

    /// @notice Returns whether a user has already claimed mETH.
    /// @param account Address to query.
    function hasClaimed(address account) external view returns (bool) {
        return _hasClaimed[account];
    }
}
