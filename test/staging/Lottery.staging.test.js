const { assert, expect } = require("chai")
const { network, getNamedAccounts, ethers } = require("hardhat")
const {developmentChains} = require("../../helper-hardhat-config")

developmentChains.includes(network.name) ? describe.skip :
describe("Lottery Unit Tests", function () {
    let lottery, lotteryEntranceFee, deployer

    beforeEach(async function() {
        deployer = (await getNamedAccounts()).deployer
        lottery = await ethers.getContract("Lottery", deployer)
        lotteryEntranceFee = await lottery.getEntranceFee()
    })
    describe("fulfillRandomWords", function() {
        it("works with live Chainlink Keepers and ChainLink VRF, we get a random winner", async function() {
            console.log('setting up test')
            const startingTimeStamp = await lottery.getLatestTimestamp()
            const accounts = await ethers.getSigners()

            console.log("setting up listener")
            // setup listener before we enter the lottery
            await new Promise(async (resolve, reject) => {
                lottery.once("WinnerPicked", async () => {
                    console.log("winner picked event fired")
                    try{
                        const recentWinner = await lottery.getrecentWinner()
                        const lotteryState = await lottery.getLotteryState()
                        const winnerEndingBalance = await accounts[0].getBalance()
                        const endingTimeStamp = await lottery.getLatestTimestamp()
                        await expect(lottery.getPlayer(0)).to.be.reverted
                        assert.equal(recentWinner.toString(), accounts[0].address)
                        assert.equal(lotteryState.toString(), "0")
                        assert.equal(winnerEndingBalance.toString(), winnerStartingBalance.add(lotteryEntranceFee).toString())
                        assert(endingTimeStamp > startingTimeStamp)
                        resolve()
                    } catch(error) {
                        console.log(error)
                        reject(error)
                    }
                })
            
            // Then entering the lottery
                console.log("entering Lottery")
                const tx = await lottery.enterLottery({value: lotteryEntranceFee})
                await tx.wait(1)
                console.log("waiting")
                console.log[accounts[0]]
                const winnerStartingBalance = await accounts[0].getBalance()
            // and this wont complete utill out listener has finished llstening!
            })  
        })
    })
})