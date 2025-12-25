import { useMemo, useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useReadContract } from 'wagmi';
import { Contract } from 'ethers';
import { formatUnits } from 'viem';

import { useEthersSigner } from '../hooks/useEthersSigner';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../config/contracts';
import '../styles/StakeApp.css';

const DECIMALS = 6;

function toUnits(value: string): bigint | null {
  const trimmed = value.trim();
  if (!trimmed || /^[-]/.test(trimmed)) return null;

  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric)) return null;

  const [whole, fraction = ''] = trimmed.split('.');
  const normalizedFraction = (fraction + '000000').slice(0, 6);

  const composed = `${whole || '0'}${normalizedFraction}`;
  if (!/^\d+$/.test(composed)) return null;

  return BigInt(composed);
}

function formatAmount(value?: bigint | number | string | null) {
  if (value === undefined || value === null) return '***';
  const big =
    typeof value === 'bigint'
      ? value
      : typeof value === 'number'
        ? BigInt(Math.trunc(value))
        : BigInt(value);
  return formatUnits(big, DECIMALS);
}

function previewHandle(handle?: string) {
  if (!handle) return '—';
  return `${handle.slice(0, 10)}…${handle.slice(-6)}`;
}

export function StakeApp() {
  const { address, isConnected } = useAccount();
  const signerPromise = useEthersSigner();
  const { instance, isLoading: zamaLoading, error: zamaError } = useZamaInstance();

  const [stakeInput, setStakeInput] = useState('25');
  const [withdrawInput, setWithdrawInput] = useState('10');
  const [actionBusy, setActionBusy] = useState<'claim' | 'stake' | 'withdraw' | null>(null);
  const [txStatus, setTxStatus] = useState('');
  const [decrypting, setDecrypting] = useState(false);
  const [decryptedBalance, setDecryptedBalance] = useState<string | null>(null);
  const [decryptedStaked, setDecryptedStaked] = useState<string | null>(null);
  const contractReady = true;
  const addressPreview = contractReady
    ? `${CONTRACT_ADDRESS.slice(0, 6)}…${CONTRACT_ADDRESS.slice(-4)}`
    : 'Set Sepolia address';

  const { data: claimAmountRaw } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'CLAIM_AMOUNT',
    chainId: 11155111,
  });

  const { data: hasClaimed } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'hasClaimed',
    args: address ? [address] : undefined,
    chainId: 11155111,
    query: { enabled: !!address },
  });

  const {
    data: encryptedBalance,
    refetch: refetchBalance,
    isFetching: fetchingBalance,
  } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'confidentialBalanceOf',
    args: address ? [address] : undefined,
    chainId: 11155111,
    query: { enabled: !!address },
  });

  const {
    data: encryptedStaked,
    refetch: refetchStaked,
    isFetching: fetchingStaked,
  } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'stakedBalanceOf',
    args: address ? [address] : undefined,
    chainId: 11155111,
    query: { enabled: !!address },
  });

  const claimDisplay = useMemo(() => {
    if (typeof claimAmountRaw === 'bigint') {
      return formatUnits(claimAmountRaw, DECIMALS);
    }
    return '0.0';
  }, [claimAmountRaw]);

  const resetDecrypt = () => {
    setDecryptedBalance(null);
    setDecryptedStaked(null);
  };

  const refetchAll = async () => {
    await Promise.all([refetchBalance(), refetchStaked()]);
  };

  const handleClaim = async () => {
    if (!contractReady) {
      setTxStatus('Update CONTRACT_ADDRESS to the deployed Sepolia contract.');
      return;
    }
    if (!signerPromise || !address) {
      setTxStatus('Connect your wallet to claim mETH.');
      return;
    }
    try {
      setActionBusy('claim');
      setTxStatus('Sending claim transaction...');
      const signer = await signerPromise;
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await contract.claim();
      setTxStatus('Waiting for confirmation...');
      await tx.wait();
      setTxStatus('Claim complete. mETH minted to your wallet.');
      resetDecrypt();
      await refetchAll();
    } catch (error) {
      console.error(error);
      setTxStatus(error instanceof Error ? error.message : 'Claim failed');
    } finally {
      setActionBusy(null);
    }
  };

  const handleStake = async () => {
    if (!contractReady) {
      setTxStatus('Update CONTRACT_ADDRESS to the deployed Sepolia contract.');
      return;
    }
    if (!instance || !signerPromise || !address) {
      setTxStatus('Encryption service and wallet are required.');
      return;
    }
    const units = toUnits(stakeInput);
    if (units === null) {
      setTxStatus('Enter a valid stake amount (use up to 6 decimals).');
      return;
    }

    try {
      setActionBusy('stake');
      setTxStatus('Encrypting and sending stake...');

      const encrypted = await instance.createEncryptedInput(CONTRACT_ADDRESS, address).add64(units).encrypt();
      const signer = await signerPromise;
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await contract.stake(encrypted.handles[0], encrypted.inputProof);
      setTxStatus('Waiting for stake confirmation...');
      await tx.wait();
      setTxStatus('Stake confirmed.');
      resetDecrypt();
      await refetchAll();
    } catch (error) {
      console.error(error);
      setTxStatus(error instanceof Error ? error.message : 'Stake failed');
    } finally {
      setActionBusy(null);
    }
  };

  const handleWithdraw = async () => {
    if (!contractReady) {
      setTxStatus('Update CONTRACT_ADDRESS to the deployed Sepolia contract.');
      return;
    }
    if (!instance || !signerPromise || !address) {
      setTxStatus('Encryption service and wallet are required.');
      return;
    }
    const units = toUnits(withdrawInput);
    if (units === null) {
      setTxStatus('Enter a valid withdrawal amount (use up to 6 decimals).');
      return;
    }

    try {
      setActionBusy('withdraw');
      setTxStatus('Encrypting withdrawal request...');
      const encrypted = await instance.createEncryptedInput(CONTRACT_ADDRESS, address).add64(units).encrypt();
      const signer = await signerPromise;
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await contract.withdraw(encrypted.handles[0], encrypted.inputProof);
      setTxStatus('Waiting for withdrawal confirmation...');
      await tx.wait();
      setTxStatus('Withdrawal processed.');
      resetDecrypt();
      await refetchAll();
    } catch (error) {
      console.error(error);
      setTxStatus(error instanceof Error ? error.message : 'Withdraw failed');
    } finally {
      setActionBusy(null);
    }
  };

  const decryptBalances = async () => {
    if (!contractReady) {
      setTxStatus('Update CONTRACT_ADDRESS to the deployed Sepolia contract.');
      return;
    }
    if (!instance || !address || !signerPromise) {
      setTxStatus('Connect wallet and wait for the encryption service.');
      return;
    }
    if (!encryptedBalance && !encryptedStaked) {
      setTxStatus('No encrypted balances to decrypt yet.');
      return;
    }

    try {
      setDecrypting(true);
      setTxStatus('Requesting decryption...');
      const keypair = instance.generateKeypair();

      const handleContractPairs = [
        encryptedBalance ? { handle: encryptedBalance as string, contractAddress: CONTRACT_ADDRESS } : null,
        encryptedStaked ? { handle: encryptedStaked as string, contractAddress: CONTRACT_ADDRESS } : null,
      ].filter(Boolean);

      const start = Math.floor(Date.now() / 1000).toString();
      const durationDays = '7';
      const contractAddresses = [CONTRACT_ADDRESS];
      const eip712 = instance.createEIP712(keypair.publicKey, contractAddresses, start, durationDays);

      const signer = await signerPromise;
      const signature = await signer.signTypedData(
        eip712.domain,
        { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
        eip712.message
      );

      const result = await instance.userDecrypt(
        handleContractPairs,
        keypair.privateKey,
        keypair.publicKey,
        signature.replace('0x', ''),
        contractAddresses,
        address,
        start,
        durationDays
      );

      if (encryptedBalance) {
        const value = result[encryptedBalance as string];
        setDecryptedBalance(formatAmount(value));
      }
      if (encryptedStaked) {
        const value = result[encryptedStaked as string];
        setDecryptedStaked(formatAmount(value));
      }
      setTxStatus('Decryption completed.');
    } catch (error) {
      console.error(error);
      setTxStatus(error instanceof Error ? error.message : 'Decryption failed');
    } finally {
      setDecrypting(false);
    }
  };

  const claimed = !!hasClaimed;

  return (
    <div className="page">
      <header className="hero">
        <div>
          <p className="eyebrow">Atlas Stake on FHEVM</p>
          <h1>Stake mETH without exposing your balances.</h1>
          <p className="lede">
            Claim your mETH, keep balances encrypted on-chain, and decrypt them only when you want to see them.
          </p>
          <div className="tags">
            <span>Encrypted reads via viem</span>
            <span>Ethers-powered writes</span>
            <span>Sepolia only</span>
          </div>
          <p className="muted" style={{ marginTop: '8px' }}>Contract: {addressPreview}</p>
        </div>
        <ConnectButton />
      </header>

      <section className="grid">
        <div className="card highlight">
          <div className="card-header">
            <div>
              <p className="eyebrow">Claim</p>
              <h3>Get {claimDisplay} mETH</h3>
            </div>
            <div className="pill">{isConnected ? 'Wallet linked' : 'Connect wallet'}</div>
          </div>
          <p className="muted">One-time mint per address. Tokens stay encrypted using FHE.</p>
          <button
            className="action-button"
            onClick={handleClaim}
            disabled={!isConnected || claimed || actionBusy === 'claim'}
          >
            {claimed ? 'Already claimed' : actionBusy === 'claim' ? 'Claiming...' : 'Claim mETH'}
          </button>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <p className="eyebrow">Wallet balance</p>
              <h3>{decryptedBalance ?? 'Encrypted'}</h3>
            </div>
            <span className="handle-label">{previewHandle(encryptedBalance as string | undefined)}</span>
          </div>
          <p className="muted">
            Uses viem for reads. Click decrypt to request your value from Zama relayer.
          </p>
          <div className="pill secondary">{fetchingBalance ? 'Refreshing...' : 'Encrypted'}</div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <p className="eyebrow">Staked balance</p>
              <h3>{decryptedStaked ?? 'Encrypted'}</h3>
            </div>
            <span className="handle-label">{previewHandle(encryptedStaked as string | undefined)}</span>
          </div>
          <p className="muted">
            Staked amounts stay hidden on-chain until you decrypt them locally.
          </p>
          <div className="pill secondary">{fetchingStaked ? 'Refreshing...' : 'Encrypted'}</div>
        </div>
      </section>

      <section className="grid actions">
        <div className="card">
          <div className="card-header">
            <div>
              <p className="eyebrow">Stake</p>
              <h3>Move mETH into the vault</h3>
            </div>
            <span className="pill subtle">Keeps amounts private</span>
          </div>
          <div className="form">
            <label>Amount (up to 6 decimals)</label>
            <input
              type="text"
              value={stakeInput}
              onChange={(e) => setStakeInput(e.target.value)}
              placeholder="25.000000"
            />
            <button
              className="action-button"
              onClick={handleStake}
              disabled={!isConnected || actionBusy === 'stake' || zamaLoading}
            >
              {actionBusy === 'stake' ? 'Staking...' : 'Stake mETH'}
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <p className="eyebrow">Withdraw</p>
              <h3>Bring staked mETH back</h3>
            </div>
            <span className="pill subtle">Requires encrypted proof</span>
          </div>
          <div className="form">
            <label>Amount (up to 6 decimals)</label>
            <input
              type="text"
              value={withdrawInput}
              onChange={(e) => setWithdrawInput(e.target.value)}
              placeholder="10.000000"
            />
            <button
              className="action-button"
              onClick={handleWithdraw}
              disabled={!isConnected || actionBusy === 'withdraw' || zamaLoading}
            >
              {actionBusy === 'withdraw' ? 'Withdrawing...' : 'Withdraw mETH'}
            </button>
          </div>
        </div>

        <div className="card wide">
          <div className="card-header">
            <div>
              <p className="eyebrow">Decrypt</p>
              <h3>Reveal your balances locally</h3>
            </div>
            <span className="pill subtle">{zamaLoading ? 'Loading relayer' : 'Ready'}</span>
          </div>
          <p className="muted">
            Decryption uses Zama relayer SDK. We never store your values; everything happens client-side with your
            signature.
          </p>
          <div className="actions-row">
            <button
              className="ghost-button"
              onClick={decryptBalances}
              disabled={decrypting || zamaLoading || !isConnected}
            >
              {decrypting ? 'Decrypting...' : 'Decrypt balances'}
            </button>
            <button className="ghost-button" onClick={resetDecrypt}>
              Clear decrypted values
            </button>
          </div>
          <div className="status">
            <div>
              <p className="label">Wallet mETH</p>
              <p className="value">{decryptedBalance ?? '—'}</p>
            </div>
            <div>
              <p className="label">Staked mETH</p>
              <p className="value">{decryptedStaked ?? '—'}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="status-bar">
        <div>
          <p className="label">Status</p>
          <p className="value">{txStatus || 'Ready'}</p>
        </div>
        <div>
          <p className="label">Relayer</p>
          <p className="value">{zamaError ? zamaError : zamaLoading ? 'Loading...' : 'Online'}</p>
        </div>
        <div>
          <p className="label">Network</p>
          <p className="value">Sepolia</p>
        </div>
        <div>
          <p className="label">Contract</p>
          <p className="value">{addressPreview}</p>
        </div>
      </section>
    </div>
  );
}
