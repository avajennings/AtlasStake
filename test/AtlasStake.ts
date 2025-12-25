import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

describe("AtlasStake", function () {
  let signers: Signers;
  let atlasStakeContract: any;
  let atlasStakeAddress: string;

  const decryptAmount = async (cipher: string, user: HardhatEthersSigner) => {
    return fhevm.userDecryptEuint(FhevmType.euint64, cipher, atlasStakeAddress, user);
  };

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { alice: ethSigners[0], bob: ethSigners[1] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    const factory = await ethers.getContractFactory("AtlasStake");
    atlasStakeContract = await factory.deploy();
    atlasStakeAddress = await atlasStakeContract.getAddress();
  });

  it("lets a user claim once and decrypt the encrypted balance", async function () {
    const claimAmount: bigint = await atlasStakeContract.CLAIM_AMOUNT();

    await atlasStakeContract.connect(signers.alice).claim();

    const encryptedBalance = await atlasStakeContract.confidentialBalanceOf(signers.alice.address);
    expect(encryptedBalance).to.not.eq(ethers.ZeroHash);

    const clearBalance = await decryptAmount(encryptedBalance, signers.alice);
    expect(clearBalance).to.eq(claimAmount);

    await expect(atlasStakeContract.connect(signers.alice).claim()).to.be.revertedWithCustomError(
      atlasStakeContract,
      "AlreadyClaimed",
    );
  });

  it("stakes and withdraws encrypted mETH values", async function () {
    const claimAmount: bigint = await atlasStakeContract.CLAIM_AMOUNT();
    const stakeAmount = 25_000_000n; // 25 mETH with 6 decimals
    const withdrawAmount = 10_000_000n; // 10 mETH with 6 decimals

    await atlasStakeContract.connect(signers.alice).claim();

    const encryptedStake = await fhevm
      .createEncryptedInput(atlasStakeAddress, signers.alice.address)
      .add64(stakeAmount)
      .encrypt();
    await (await atlasStakeContract.connect(signers.alice).stake(encryptedStake.handles[0], encryptedStake.inputProof)).wait();

    let encryptedBalance = await atlasStakeContract.confidentialBalanceOf(signers.alice.address);
    let encryptedStaked = await atlasStakeContract.stakedBalanceOf(signers.alice.address);

    const balanceAfterStake = await decryptAmount(encryptedBalance, signers.alice);
    const stakedAfterStake = await decryptAmount(encryptedStaked, signers.alice);

    expect(balanceAfterStake).to.eq(claimAmount - stakeAmount);
    expect(stakedAfterStake).to.eq(stakeAmount);

    const encryptedWithdraw = await fhevm
      .createEncryptedInput(atlasStakeAddress, signers.alice.address)
      .add64(withdrawAmount)
      .encrypt();
    await (
      await atlasStakeContract.connect(signers.alice).withdraw(encryptedWithdraw.handles[0], encryptedWithdraw.inputProof)
    ).wait();

    encryptedBalance = await atlasStakeContract.confidentialBalanceOf(signers.alice.address);
    encryptedStaked = await atlasStakeContract.stakedBalanceOf(signers.alice.address);

    const balanceAfterWithdraw = await decryptAmount(encryptedBalance, signers.alice);
    const stakedAfterWithdraw = await decryptAmount(encryptedStaked, signers.alice);

    expect(balanceAfterWithdraw).to.eq(claimAmount - stakeAmount + withdrawAmount);
    expect(stakedAfterWithdraw).to.eq(stakeAmount - withdrawAmount);
  });
});
