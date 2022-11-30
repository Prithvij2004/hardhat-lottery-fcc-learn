const { assert, expect } = require("chai")
const { network, getNamedAccounts, deployments, ethers } = require("hardhat")
const {developmentChains, networkConfig} = require("../../helper-hardhat-config")

!developmentChains.includes(network.name) ? describe.skip : describe("Lottery Unit Tests", async function () {
    let lottery, vrfCoordinatorV2Mock, lotteryEntranceFee, deployer, interval
    const chainId = network.config.chainId
    

    beforeEach(async function() {
        deployer = (await getNamedAccounts()).deployer
        await deployments.fixture("all")
        lottery = await ethers.getContract("Lottery", deployer)
        vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer)
        lotteryEntranceFee = await lottery.getEntranceFee()
        interval = await lottery.getInterval()

    })

    describe("constructor",  function() {
        it("intializes the lottery correctly", async function() {
            // ideally we make our test have just 1 assert per "it"
            const lotteryState = await lottery.getLotteryState()
            assert.equal(lotteryState.toString(), "0")
            assert.equal(interval.toString(), networkConfig[chainId]["interval"])
        })
    })

    describe("enterLottery", function() {
        it("reverts if they don't pay enough", async function() {
            await expect(lottery.enterLottery()).to.be.revertedWith("Lottery__NotEnoughETHEntered")
        })
        it("records players", async function() {
            await lottery.enterLottery({value: lotteryEntranceFee})
            const playerFromContract = await lottery.getPlayer(0)
            assert.equal(playerFromContract, deployer)
        })
        it("emits event on enter", async function() {
            await expect(lottery.enterLottery({value: lotteryEntranceFee})).to.emit(lottery, "LotteryEnter")
        })
        it("dosen't allow entrance when lottery is calculating", async function() {
            await lottery.enterLottery({value:  lotteryEntranceFee})
            await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
            await network.provider.request({method:"evm_mine", params: []})
            // we pretend to be chainlink keeper
            await lottery.performUpkeep([])
            await expect(lottery.enterLottery({value: lotteryEntranceFee})).to.be.revertedWith("Lottery__NotOpen")
        })
    })
    describe("checkUpKeep", function() {
        it("returns false if people haven't send any ETH", async function() {
            await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
            await network.provider.send("evm_mine", [])
            const {upkeepNeeded}= await lottery.callStatic.checkUpkeep([])
            assert(!upkeepNeeded)
        })
        it("returns false if lottery isn't open", async function() {
            await lottery.enterLottery({value: lotteryEntranceFee})
            await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
            await network.provider.send("evm_mine", [])
            await lottery.performUpkeep([])
            const lotteryState = await lottery.getLotteryState()
            const { upkeepNeeded } = await lottery.callStatic.checkUpkeep([])
            assert.equal(lotteryState.toString(), "1")
            assert.equal(upkeepNeeded, false)
        })
        it("returns false if time hasn't passed", async function() {
            await lottery.enterLottery({value: lotteryEntranceFee})
            await network.provider.send("evm_increaseTime", [interval.toNumber() - 5])
            await network.provider.send("evm_mine", [])
            const { upkeepNeeded } = await lottery.callStatic.checkUpkeep([])
            assert(!upkeepNeeded)
        })
        it("returns true if enough time has passed, has players, eth and is open", async function(){
            await lottery.enterLottery({value: lotteryEntranceFee})
            await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
            await network.provider.send("evm_mine", [])
            const { upkeepNeeded } = await lottery.callStatic.checkUpkeep([])
            assert(upkeepNeeded)
        })
    })
    describe("performUpkeep", function() {
        it("only works if checkUpkeep is true", async function() {
            await lottery.enterLottery({value: lotteryEntranceFee})
            await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
            await network.provider.send("evm_mine", [])
            const tx = await lottery.performUpkeep([])
            assert(tx)
        })
        it("reverts when checkUpkeep is false", async function() {
            await expect(lottery.performUpkeep([])).to.be.revertedWith("Lottery__UpkeepNotNeeded")
        })
        it("updates the lottery state, emits an event and calls the vrf coordinator", async function() {
            await lottery.enterLottery({value: lotteryEntranceFee})
            await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
            await network.provider.send("evm_mine", [])
            const txResponse = await lottery.performUpkeep([])
            const txReceipt = await txResponse.wait(1)
            const requestId = await txReceipt.events[1].args.requestId
            const lotteryState = await lottery.getLotteryState()
            assert(requestId.toNumber() > 0)
            assert(lotteryState.toString() == "1")
        })
    })
    describe("fulfillRandomWords", function() {
        beforeEach(async function() {
            await lottery.enterLottery({value: lotteryEntranceFee})
            await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
            await network.provider.send("evm_mine", [])
        })
        it("can only be called after performUpkeep", async function() {
            expect(vrfCoordinatorV2Mock.fulfillRandomWords(0, lottery.address)).to.be.revertedWith("nonexistent request")
            expect(vrfCoordinatorV2Mock.fulfillRandomWords(1, lottery.address)).to.be.revertedWith("nonexistent request")
        })
        it("picks a winner, resets the lottery, and send money", async function() {
            const additionalEntrants = 3
            const startingAccountIndex = 1
            const accounts = await ethers.getSigners()
            for(let i = startingAccountIndex; i < startingAccountIndex + additionalEntrants; i++) {
                const accountConnectedLottery = lottery.connect(accounts[i])
                await accountConnectedLottery.enterLottery({value: lotteryEntranceFee})
            }
            const startingTimeStamp = await lottery.getLatestTimestamp()
            //performUpkeep
            //fulfillrandomWords
            //We will have to wait for the fulfillRandomWords to be called
            await new Promise(async (resolve, reject) => {
                lottery.once("WinnerPicked", async () => {
                    console.log("Found the event")
                    try {
                        const recentWinner = await lottery.getrecentWinner()
                        console.log(recentWinner)
                        console.log(accounts[2].address)
                        console.log(accounts[0].address)
                        console.log(accounts[1].address)
                        console.log(accounts[3].address)
                        const lotteryState = await lottery.getLotteryState()
                        const numPlayers = await lottery.getNumPlayers()
                        const endingTimeStamp = await lottery.getLatestTimestamp()
                        const winnerEndingBalance = await accounts[1].getBalance()
                        assert(numPlayers.toString(), "0")
                        assert(lotteryState.toString(), "0")
                        assert(endingTimeStamp > startingTimeStamp)
                        assert.equal(winnerEndingBalance.toString(), winnerStartingBalance.add(lotteryEntranceFee.mul(additionalEntrants).add(lotteryEntranceFee).toString()))
                    }catch(e){
                        reject(e)
                    }
                    resolve()
                })
                // Setting up the listener
                // below, we will fire up the event, and the listener will pick it up, and resolves
                const tx = await lottery.performUpkeep([])
                const txReceipt= await tx.wait(1)
                const winnerStartingBalance = await accounts[1].getBalance()
                await vrfCoordinatorV2Mock.fulfillRandomWords(txReceipt.events[1].args.requestId, lottery.address)

            })
        })
    })
})