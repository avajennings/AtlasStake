import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedAtlasStake = await deploy("AtlasStake", {
    from: deployer,
    log: true,
  });

  console.log(`AtlasStake contract: `, deployedAtlasStake.address);
};
export default func;
func.id = "deploy_atlasStake"; // id required to prevent reexecution
func.tags = ["AtlasStake"];
