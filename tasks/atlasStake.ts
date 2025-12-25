import { FhevmType } from "@fhevm/hardhat-plugin";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

function toUnits(value: string): bigint {
  const trimmed = value.trim();
  if (!trimmed || Number.isNaN(Number(trimmed))) {
    throw new Error("Invalid amount");
  }
  const [whole, fraction = ""] = trimmed.split(".");
  const normalizedFraction = (fraction + "000000").slice(0, 6);
  return BigInt(`${whole || "0"}${normalizedFraction}`);
}

task("task:address", "Prints the AtlasStake address").setAction(async function (_taskArguments: TaskArguments, hre) {
  const { deployments } = hre;

  const atlasStake = await deployments.get("AtlasStake");

  console.log("AtlasStake address is " + atlasStake.address);
});

task("task:claim", "Claims the default mETH allocation")
  .addOptionalParam("address", "Optionally specify the AtlasStake contract address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;

    const AtlasStakeDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("AtlasStake");
    console.log(`AtlasStake: ${AtlasStakeDeployment.address}`);

    const [signer] = await ethers.getSigners();
    const atlasStakeContract = await ethers.getContractAt("AtlasStake", AtlasStakeDeployment.address);

    const tx = await atlasStakeContract.connect(signer).claim();
    console.log(`Wait for tx:${tx.hash}...`);
    await tx.wait();

    console.log(`Claim finished for ${signer.address}`);
  });

task("task:stake", "Stakes an encrypted mETH amount")
  .addOptionalParam("address", "Optionally specify the AtlasStake contract address")
  .addParam("value", "mETH amount with up to 6 decimals")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const AtlasStakeDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("AtlasStake");
    console.log(`AtlasStake: ${AtlasStakeDeployment.address}`);

    const [signer] = await ethers.getSigners();
    const atlasStakeContract = await ethers.getContractAt("AtlasStake", AtlasStakeDeployment.address);

    const units = toUnits(taskArguments.value);
    const encryptedValue = await fhevm
      .createEncryptedInput(AtlasStakeDeployment.address, signer.address)
      .add64(units)
      .encrypt();

    const tx = await atlasStakeContract.connect(signer).stake(encryptedValue.handles[0], encryptedValue.inputProof);
    console.log(`Wait for tx:${tx.hash}...`);
    await tx.wait();

    console.log(`Staked ${taskArguments.value} mETH`);
  });

task("task:withdraw", "Withdraws an encrypted portion of staked mETH")
  .addOptionalParam("address", "Optionally specify the AtlasStake contract address")
  .addParam("value", "mETH amount with up to 6 decimals")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const AtlasStakeDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("AtlasStake");
    console.log(`AtlasStake: ${AtlasStakeDeployment.address}`);

    const [signer] = await ethers.getSigners();
    const atlasStakeContract = await ethers.getContractAt("AtlasStake", AtlasStakeDeployment.address);

    const units = toUnits(taskArguments.value);
    const encryptedValue = await fhevm
      .createEncryptedInput(AtlasStakeDeployment.address, signer.address)
      .add64(units)
      .encrypt();

    const tx = await atlasStakeContract.connect(signer).withdraw(encryptedValue.handles[0], encryptedValue.inputProof);
    console.log(`Wait for tx:${tx.hash}...`);
    await tx.wait();

    console.log(`Withdrawal requested for ${taskArguments.value} mETH`);
  });

task("task:decrypt-balances", "Decrypts balance and staked balance for the default signer")
  .addOptionalParam("address", "Optionally specify the AtlasStake contract address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const AtlasStakeDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("AtlasStake");
    console.log(`AtlasStake: ${AtlasStakeDeployment.address}`);

    const [signer] = await ethers.getSigners();
    const atlasStakeContract = await ethers.getContractAt("AtlasStake", AtlasStakeDeployment.address);

    const encryptedBalance = await atlasStakeContract.confidentialBalanceOf(signer.address);
    const encryptedStaked = await atlasStakeContract.stakedBalanceOf(signer.address);

    if (encryptedBalance === ethers.ZeroHash) {
      console.log("No mETH claimed yet");
      return;
    }

    const balance = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedBalance,
      AtlasStakeDeployment.address,
      signer,
    );
    const staked = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedStaked,
      AtlasStakeDeployment.address,
      signer,
    );

    const balanceBigInt = typeof balance === "bigint" ? balance : BigInt(balance);
    const stakedBigInt = typeof staked === "bigint" ? staked : BigInt(staked);

    console.log(`Balance: ${ethers.formatUnits(balanceBigInt, 6)} mETH`);
    console.log(`Staked : ${ethers.formatUnits(stakedBigInt, 6)} mETH`);
  });
