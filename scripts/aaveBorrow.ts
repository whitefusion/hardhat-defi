import { getNamedAccounts, ethers } from 'hardhat';
import { ILendingPool, ILendingPoolAddressesProvider, IERC20, AggregatorV3Interface } from '../typechain-types';
import { getWeth, AMOUNT } from './getWeth';
import { BigNumber } from 'ethers';

async function main() {
  await getWeth();
  const { deployer } = await getNamedAccounts();
  const lendingPool = await getLendingPool(deployer); 
  console.log('lending pool address: ', lendingPool.address);

  // 存入抵押物
  const wethTokenAddress = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
  await approveErc20(wethTokenAddress, lendingPool.address, AMOUNT, deployer);

  console.log("Depositing ... ");
  await lendingPool.deposit( wethTokenAddress,AMOUNT, deployer, 0);
  console.log("Deposited");

  // 获取借贷额度，额度一般来说不能超过抵押物的80%，否则会被清算
  const { totalDebtETH, availableBorrowsETH } = await getBorrowUserData(lendingPool, deployer);

  // 获取想要借的货币的汇率 ETH -> DAI
  const daiPrice = await getDaiPrice();

  const amountDaiToBorrow = availableBorrowsETH.mul(95).div(100).div(daiPrice);
  console.log(`you can borrow ${amountDaiToBorrow} DAI`);
  const amountDaiToBorrowWei = ethers.utils.parseEther(amountDaiToBorrow.toString());

  // 借DAI
  const daiTokenAddress = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
  await borrowDai(daiTokenAddress, lendingPool, amountDaiToBorrowWei, deployer);
  await getBorrowUserData(lendingPool, deployer);
  console.log('------- ------- ---------')

  // 还DAI
  // 还完之后还是会有一点DAI处于借的状态，那是利息
  await repay(amountDaiToBorrowWei, daiTokenAddress, lendingPool, deployer);
  await getBorrowUserData(lendingPool, deployer);
}

async function repay(
  amount: BigNumber, daiAddress: string, lendingPool: ILendingPool, account: string
) {
  await approveErc20(daiAddress, lendingPool.address, amount, account);
  const repayTx = await lendingPool.repay(daiAddress, amount, 1, account);
  await repayTx.wait(1);
  console.log('repaid');
}

async function borrowDai(
  daiAddress: string, lendingPool: ILendingPool, amountDaiToBorrowWei: BigNumber, account: string
) {
  const borrowTx = await lendingPool.borrow(daiAddress, amountDaiToBorrowWei, 1, 0, account);
  await borrowTx.wait(1);
  console.log('you borrowed !');
}

async function getLendingPool(account: string) {
  // lendingpooladdress: 0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5
  const lendingPoolAddressProvider: ILendingPoolAddressesProvider = await ethers.getContractAt(
    "ILendingPoolAddressesProvider",
    "0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5",
    account
  );
  const lendingPoolAddress = await lendingPoolAddressProvider.getLendingPool();
  const lendingPool: ILendingPool = await ethers.getContractAt('ILendingPool', lendingPoolAddress, account);
  return lendingPool;
}

async function getBorrowUserData(lendingPool: ILendingPool, account: string)  {
  const { totalCollateralETH, totalDebtETH, availableBorrowsETH } = await lendingPool.getUserAccountData(account);
  console.log(
    'totalCollateralETH, totalDebtETH, availableBorrowsETH',
    totalCollateralETH.toString(), totalDebtETH.toString(), availableBorrowsETH.toString()
  );
  return { totalDebtETH, availableBorrowsETH };
}

async function getDaiPrice() {
  // 不用传account，因为没有交易
  const daiEthPriceFeed: AggregatorV3Interface = await ethers.getContractAt('AggregatorV3Interface', '0x773616E4d11A78F511299002da57A0a94577F1f4');
  const price = (await daiEthPriceFeed.latestRoundData())[1];
  console.log('the DAI/ETH price is :', price.toString());
  return price;
}

async function approveErc20(
  erc20Address: string,
  spenderAddress: string,
  amountToSpend: any,
  account: string
) {
  const erc20Token: IERC20 = await ethers.getContractAt('IERC20', erc20Address, account);
  const tx = await erc20Token.approve(spenderAddress, amountToSpend);
  await tx.wait(1);
  console.log('approved');
}

main()
.then()
.catch(e => {
  console.log(e);
  process.exit(1);
})