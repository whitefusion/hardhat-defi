// @ts-ignore
import { getNamedAccounts, ethers } from 'hardhat';
export const AMOUNT = ethers.utils.parseEther('0.02');

export async function getWeth() {
  const { deployer } = await getNamedAccounts();
  // call 'deposit' on the weth contract
  // need abi and address
  const wEthAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
  const iWeth = await ethers.getContractAt('IWeth', wEthAddress, deployer);
  const tx = await iWeth.deposit({ value: AMOUNT });
  await tx.wait(1)
  const wethBalance = await iWeth.balanceOf(deployer);
  console.log(`GOT ${wethBalance.toString()} WETH`);
}


