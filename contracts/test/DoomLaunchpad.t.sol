// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {DoomLaunchpad} from "../src/DoomLaunchpad.sol";
import {DoomToken} from "../src/DoomToken.sol";

contract DoomLaunchpadTest is Test {
    address constant TREASURY = 0x0DbFef7e227701671896B9Ef498D7Ce87F4E57e0;

    DoomLaunchpad lp;
    address creator = makeAddr("creator");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");

    uint256 constant DURATION = 1 days;

    function setUp() public {
        lp = new DoomLaunchpad(TREASURY);
        vm.deal(creator, 100 ether);
        vm.deal(alice, 1000 ether);
        vm.deal(bob, 1000 ether);
        vm.deal(carol, 1000 ether);
    }

    event LaunchCreated(
        uint256 indexed id,
        address indexed token,
        address indexed creator,
        string name,
        string symbol,
        uint256 bond,
        uint256 targetMcap,
        uint64 deadline,
        uint64 revealEnd,
        uint256 creatorLaunched,
        uint256 creatorSurvived
    );
    event LaunchMetadata(
        uint256 indexed id, string imageURI, string description, string website, string twitter, string telegram
    );
    event FeePaid(uint256 indexed id, uint8 indexed kind, address indexed payer, uint256 amount);
    event Trade(uint256 indexed id, address indexed trader, bool isBuy, uint256 bnb, uint256 tokens, uint256 priceAfter);

    uint256 constant BOND = 0.1 ether;
    uint256 constant BOND_FEE = 0.0001 ether;
    uint256 constant NET_BOND = 0.0999 ether;

    function _params(uint256 target) internal pure returns (DoomLaunchpad.LaunchParams memory p) {
        p = DoomLaunchpad.LaunchParams({
            name: "Doom Cat",
            symbol: "DCAT",
            imageURI: "ipfs://cat",
            description: "a doomed cat",
            website: "https://doom.cat",
            twitter: "https://x.com/doomcat",
            telegram: "https://t.me/doomcat",
            targetMcap: target,
            duration: DURATION
        });
    }

    function _launch(uint256 target) internal returns (uint256 id) {
        vm.prank(creator);
        id = lp.createLaunch{value: BOND}(_params(target), 0, 0);
    }

    function _fee(uint256 x) internal pure returns (uint256) {
        return (x * 10) / 10_000;
    }

    function _commit(address user, uint256 id, uint8 side, bytes32 salt, uint256 amount) internal {
        bytes32 c = keccak256(abi.encode(side, salt, user));
        vm.prank(user);
        lp.commit{value: amount}(id, c);
    }

    // ------------------------------------------------------------------ launch

    function test_ownerAndTreasury() public view {
        assertEq(lp.owner(), TREASURY);
        assertEq(lp.treasury(), TREASURY);
        assertEq(lp.minBond(), 0.05 ether);
        assertEq(lp.FEE_BPS(), 10);
    }

    function test_createLaunch() public {
        uint256 id = _launch(100 ether);
        assertEq(id, 1);
        DoomLaunchpad.Launch memory l = lp.getLaunch(id);
        assertEq(l.creator, creator);
        assertEq(l.bond, NET_BOND);
        assertEq(TREASURY.balance, BOND_FEE);
        assertEq(address(lp).balance, NET_BOND);
        assertEq(l.targetMcap, 100 ether);
        assertEq(l.deadline, block.timestamp + DURATION);
        assertEq(l.commitEnd, l.deadline);
        assertEq(l.revealEnd, l.deadline + 24 hours);
        assertEq(uint8(l.state), 0);
        DoomToken t = DoomToken(l.token);
        assertEq(t.totalSupply(), 1_000_000_000 ether);
        assertEq(t.balanceOf(address(lp)), 1_000_000_000 ether);
        assertEq(t.symbol(), "DCAT");
        assertEq(t.name(), "Doom Cat");
        assertEq(t.imageURI(), "ipfs://cat");
        DoomLaunchpad.Metadata memory m = lp.getMetadata(id);
        assertEq(m.imageURI, "ipfs://cat");
        assertEq(m.description, "a doomed cat");
        assertEq(m.website, "https://doom.cat");
        assertEq(m.twitter, "https://x.com/doomcat");
        assertEq(m.telegram, "https://t.me/doomcat");
        assertEq(lp.launchedCount(creator), 1);
        assertEq(lp.tokenToLaunch(l.token), id);
    }

    function test_createLaunch_bondTooLow() public {
        vm.prank(creator);
        vm.expectRevert(DoomLaunchpad.BondTooLow.selector);
        lp.createLaunch{value: 0.01 ether}(_params(1 ether), 0, 0);
        // dev buy does not count toward the bond
        vm.prank(creator);
        vm.expectRevert(DoomLaunchpad.BondTooLow.selector);
        lp.createLaunch{value: 1 ether}(_params(1 ether), 0.99 ether, 0);
        // devBuyWei > msg.value
        vm.prank(creator);
        vm.expectRevert(DoomLaunchpad.BondTooLow.selector);
        lp.createLaunch{value: 1 ether}(_params(1 ether), 2 ether, 0);
    }

    function test_createLaunch_eventsAndFee() public {
        uint64 deadline = uint64(block.timestamp + DURATION);
        vm.expectEmit(true, false, true, true, address(lp));
        emit LaunchCreated(
            1, address(0), creator, "Doom Cat", "DCAT", NET_BOND, 100 ether, deadline, deadline + 24 hours, 1, 0
        );
        vm.expectEmit(true, false, false, true, address(lp));
        emit LaunchMetadata(1, "ipfs://cat", "a doomed cat", "https://doom.cat", "https://x.com/doomcat", "https://t.me/doomcat");
        vm.expectEmit(true, true, true, true, address(lp));
        emit FeePaid(1, 0, creator, BOND_FEE);
        _launch(100 ether);
    }

    function test_createLaunch_devBuy() public {
        uint256 devBuy = 1 ether;
        uint256 quote = lp.quoteBuy(1, devBuy); // empty curve quote is id-independent
        uint256 c0 = creator.balance;
        vm.expectEmit(true, true, true, true, address(lp));
        emit FeePaid(1, 1, creator, _fee(devBuy));
        vm.prank(creator);
        uint256 id = lp.createLaunch{value: BOND + devBuy}(_params(100 ether), devBuy, quote);
        DoomLaunchpad.Launch memory l = lp.getLaunch(id);
        assertEq(l.bond, NET_BOND);
        assertEq(DoomToken(l.token).balanceOf(creator), quote);
        assertEq(c0 - creator.balance, BOND + devBuy);
        assertEq(TREASURY.balance, BOND_FEE + _fee(devBuy));
        assertEq(lp.getCurve(id).realBnb, devBuy - _fee(devBuy));
        assertEq(address(lp).balance, NET_BOND + devBuy - _fee(devBuy));
    }

    function test_createLaunch_devBuySlippage() public {
        vm.prank(creator);
        vm.expectRevert(DoomLaunchpad.Slippage.selector);
        lp.createLaunch{value: BOND + 1 ether}(_params(100 ether), 1 ether, type(uint256).max);
    }

    function test_createLaunch_validation() public {
        DoomLaunchpad.LaunchParams memory p = _params(1 ether);
        p.name = "";
        vm.prank(creator);
        vm.expectRevert(DoomLaunchpad.BadName.selector);
        lp.createLaunch{value: BOND}(p, 0, 0);

        p = _params(1 ether);
        p.name = string(new bytes(33));
        vm.prank(creator);
        vm.expectRevert(DoomLaunchpad.BadName.selector);
        lp.createLaunch{value: BOND}(p, 0, 0);

        p = _params(1 ether);
        p.symbol = "";
        vm.prank(creator);
        vm.expectRevert(DoomLaunchpad.BadSymbol.selector);
        lp.createLaunch{value: BOND}(p, 0, 0);

        p = _params(1 ether);
        p.symbol = "ABCDEFGHIJK";
        vm.prank(creator);
        vm.expectRevert(DoomLaunchpad.BadSymbol.selector);
        lp.createLaunch{value: BOND}(p, 0, 0);

        p = _params(1 ether);
        p.imageURI = string(new bytes(257));
        vm.prank(creator);
        vm.expectRevert(DoomLaunchpad.MetadataTooLong.selector);
        lp.createLaunch{value: BOND}(p, 0, 0);

        p = _params(1 ether);
        p.description = string(new bytes(513));
        vm.prank(creator);
        vm.expectRevert(DoomLaunchpad.MetadataTooLong.selector);
        lp.createLaunch{value: BOND}(p, 0, 0);

        p = _params(1 ether);
        p.website = string(new bytes(129));
        vm.prank(creator);
        vm.expectRevert(DoomLaunchpad.MetadataTooLong.selector);
        lp.createLaunch{value: BOND}(p, 0, 0);

        p = _params(1 ether);
        p.twitter = string(new bytes(129));
        vm.prank(creator);
        vm.expectRevert(DoomLaunchpad.MetadataTooLong.selector);
        lp.createLaunch{value: BOND}(p, 0, 0);

        p = _params(1 ether);
        p.telegram = string(new bytes(129));
        vm.prank(creator);
        vm.expectRevert(DoomLaunchpad.MetadataTooLong.selector);
        lp.createLaunch{value: BOND}(p, 0, 0);

        p = _params(1 ether);
        p.duration = 10 minutes;
        vm.prank(creator);
        vm.expectRevert(DoomLaunchpad.BadDuration.selector);
        lp.createLaunch{value: BOND}(p, 0, 0);

        p = _params(0);
        vm.prank(creator);
        vm.expectRevert(DoomLaunchpad.BadTarget.selector);
        lp.createLaunch{value: BOND}(p, 0, 0);

        // boundary lengths are accepted
        p = _params(1 ether);
        p.name = string(new bytes(32));
        p.symbol = "ABCDEFGHIJ";
        p.imageURI = string(new bytes(256));
        p.description = string(new bytes(512));
        p.website = string(new bytes(128));
        p.twitter = string(new bytes(128));
        p.telegram = string(new bytes(128));
        vm.prank(creator);
        lp.createLaunch{value: BOND}(p, 0, 0);
    }

    function test_setMinBond_onlyOwner() public {
        vm.expectRevert();
        lp.setMinBond(1 ether);
        vm.prank(TREASURY);
        lp.setMinBond(1 ether);
        assertEq(lp.minBond(), 1 ether);
    }

    function test_pause() public {
        vm.prank(TREASURY);
        lp.pause();
        vm.prank(creator);
        vm.expectRevert();
        lp.createLaunch{value: BOND}(_params(1 ether), 0, 0);
    }

    function test_ownable2Step() public {
        vm.prank(TREASURY);
        lp.transferOwnership(alice);
        assertEq(lp.owner(), TREASURY);
        vm.prank(alice);
        lp.acceptOwnership();
        assertEq(lp.owner(), alice);
    }

    // ------------------------------------------------------------------ curve

    function test_buySell_andFees() public {
        uint256 id = _launch(100 ether);
        uint256 p0 = lp.currentPrice(id);
        // initial mcap ~ 27.96 BNB
        assertApproxEqRel(lp.currentMcap(id), 27.96 ether, 0.001e18);

        uint256 quote = lp.quoteBuy(id, 1 ether);
        uint256 tr0 = TREASURY.balance;
        vm.expectEmit(true, true, true, true, address(lp));
        emit FeePaid(id, 1, alice, 0.001 ether);
        vm.prank(alice);
        uint256 out = lp.buy{value: 1 ether}(id, quote);
        assertEq(out, quote);
        DoomToken t = DoomToken(lp.getLaunch(id).token);
        assertEq(t.balanceOf(alice), out);
        assertEq(TREASURY.balance - tr0, 0.001 ether);
        assertEq(lp.getCurve(id).realBnb, 0.999 ether);
        assertEq(address(lp).balance, NET_BOND + 0.999 ether);
        assertGt(lp.currentPrice(id), p0);

        vm.startPrank(alice);
        t.approve(address(lp), out);
        uint256 q = lp.quoteSell(id, out);
        uint256 balBefore = alice.balance;
        uint256 tr1 = TREASURY.balance;
        DoomLaunchpad.Curve memory cv = lp.getCurve(id);
        uint256 gross = ((30 ether + cv.realBnb) * out) / (1_073_000_000 ether - cv.tokensSold + out);
        vm.expectEmit(true, true, true, true, address(lp));
        emit FeePaid(id, 2, alice, _fee(gross));
        uint256 bnbOut = lp.sell(id, out, q);
        vm.stopPrank();
        assertEq(bnbOut, q);
        assertEq(TREASURY.balance - tr1, _fee(gross));
        assertEq(bnbOut, gross - _fee(gross));
        assertEq(address(lp).balance, NET_BOND + lp.getCurve(id).realBnb);
        assertEq(alice.balance - balBefore, bnbOut);
        assertLt(bnbOut, 1 ether);
        assertEq(lp.getCurve(id).tokensSold, 0);
        assertApproxEqAbs(lp.currentPrice(id), p0, 1);
    }

    function test_buy_slippage() public {
        uint256 id = _launch(100 ether);
        vm.prank(alice);
        vm.expectRevert(DoomLaunchpad.Slippage.selector);
        lp.buy{value: 1 ether}(id, type(uint256).max);
    }

    function test_buy_capsAtCurveSupplyAndRefunds() public {
        uint256 id = _launch(100 ether);
        uint256 before = alice.balance;
        vm.prank(alice);
        uint256 out = lp.buy{value: 500 ether}(id, 0);
        assertEq(out, lp.CURVE_SUPPLY());
        uint256 spent = before - alice.balance;
        assertLt(spent, 500 ether);
        // reserve stays in the contract; fee went to treasury; refund went back
        uint256 reserve = lp.getCurve(id).realBnb;
        assertEq(address(lp).balance, reserve + NET_BOND);
        assertEq(TREASURY.balance, BOND_FEE + (spent - reserve));
        assertApproxEqAbs(spent - reserve, _fee(spent), 1);
        vm.prank(bob);
        vm.expectRevert(DoomLaunchpad.CurveSoldOut.selector);
        lp.buy{value: 1 ether}(id, 0);
    }

    // ------------------------------------------------------------------ TWAP

    function test_twapUsesWindowNotSpot() public {
        uint256 id = _launch(40 ether);
        // Pump hard early (outside the TWAP window), dump right before twap window -> TWAP low.
        vm.prank(alice);
        uint256 out = lp.buy{value: 50 ether}(id, 0);
        vm.warp(block.timestamp + DURATION * 3 / 4 - 1);
        vm.startPrank(alice);
        DoomToken(lp.getLaunch(id).token).approve(address(lp), out);
        lp.sell(id, out, 0);
        vm.stopPrank();
        // Last-second pump right before deadline should barely move TWAP
        vm.warp(block.timestamp + DURATION / 4 - 10);
        vm.prank(bob);
        lp.buy{value: 100 ether}(id, 0);
        assertGt(lp.currentMcap(id), 40 ether);
        vm.warp(lp.getLaunch(id).revealEnd);
        lp.settle(id);
        assertEq(uint8(lp.getLaunch(id).state), 2); // Died
        assertLt(lp.getMarket(id).twapMcap, 40 ether);
    }

    // ------------------------------------------------------------------ market

    function test_commitReveal_survive_claim_bondRefund_forfeit() public {
        uint256 id = _launch(30 ether); // initial mcap ~27.96
        // Buy enough to push mcap above 30 BNB and hold
        vm.prank(carol);
        lp.buy{value: 5 ether}(id, 0);
        assertGt(lp.currentMcap(id), 30 ether);

        uint256 tr0 = TREASURY.balance;
        vm.expectEmit(true, true, true, true, address(lp));
        emit FeePaid(id, 3, alice, 0.002 ether);
        _commit(alice, id, 1, "a", 2 ether); // YES, stake 1.998
        _commit(bob, id, 2, "b", 1 ether); // NO, stake 0.999
        _commit(carol, id, 2, "c", 0.5 ether); // NO, stake 0.4995, never reveals -> forfeited
        assertEq(TREASURY.balance - tr0, 0.0035 ether);
        assertEq(lp.getMarket(id).totalCommitted, 3.4965 ether);
        (address cu, uint256 ca,) = lp.commits(id, keccak256(abi.encode(uint8(1), bytes32("a"), alice)));
        assertEq(cu, alice);
        assertEq(ca, 1.998 ether);

        // cannot reveal during commit phase
        vm.prank(alice);
        vm.expectRevert(DoomLaunchpad.NotRevealPhase.selector);
        lp.reveal(id, 1, "a");

        DoomLaunchpad.Launch memory l = lp.getLaunch(id);
        vm.warp(l.deadline);
        // cannot commit after deadline
        vm.prank(alice);
        vm.expectRevert(DoomLaunchpad.CommitClosed.selector);
        lp.commit{value: 1 ether}(id, bytes32(uint256(1)));

        // wrong salt fails
        vm.prank(alice);
        vm.expectRevert(DoomLaunchpad.BadCommitment.selector);
        lp.reveal(id, 1, "wrong");
        // someone else can't reveal alice's commitment
        vm.prank(bob);
        vm.expectRevert(DoomLaunchpad.BadCommitment.selector);
        lp.reveal(id, 1, "a");

        vm.prank(alice);
        lp.reveal(id, 1, "a");
        vm.prank(bob);
        lp.reveal(id, 2, "b");

        vm.expectRevert(DoomLaunchpad.TooEarly.selector);
        lp.settle(id);

        vm.warp(l.revealEnd);
        uint256 trBefore = TREASURY.balance;
        lp.settle(id);
        assertEq(uint8(lp.getLaunch(id).state), 1); // Survived
        assertEq(lp.survivedCount(creator), 1);

        // no settlement fee: losers = 0.999 (bob) + 0.4995 (carol forfeited) = 1.4985
        assertEq(TREASURY.balance, trBefore);
        uint256 expected = 1.998 ether + 1.4985 ether;
        assertEq(lp.claimable(id, alice), expected);
        assertEq(lp.claimable(id, bob), 0);
        assertEq(lp.claimable(id, carol), 0);

        uint256 b0 = alice.balance;
        vm.prank(alice);
        lp.claim(id);
        assertEq(alice.balance - b0, expected);
        vm.prank(alice);
        vm.expectRevert(DoomLaunchpad.NothingToClaim.selector);
        lp.claim(id);

        vm.prank(bob);
        vm.expectRevert(DoomLaunchpad.NothingToClaim.selector);
        lp.claim(id);

        // bond refund
        vm.prank(alice);
        vm.expectRevert(DoomLaunchpad.NotCreator.selector);
        lp.claimBond(id);
        uint256 c0 = creator.balance;
        vm.prank(creator);
        lp.claimBond(id);
        assertEq(creator.balance - c0, NET_BOND);
        assertEq(address(lp).balance, lp.getCurve(id).realBnb); // only curve reserve remains
        vm.prank(creator);
        vm.expectRevert(DoomLaunchpad.NothingToClaim.selector);
        lp.claimBond(id);

        vm.expectRevert(DoomLaunchpad.AlreadySettled.selector);
        lp.settle(id);
    }

    function test_dies_bondToNoPool() public {
        uint256 id = _launch(1000 ether); // unreachable target
        _commit(alice, id, 1, "a", 3 ether); // YES
        _commit(bob, id, 2, "b", 1 ether); // NO
        _commit(carol, id, 2, "c", 1 ether); // NO
        _commit(carol, id, 1, "c2", 1 ether); // YES unrevealed -> forfeited

        DoomLaunchpad.Launch memory l = lp.getLaunch(id);
        vm.warp(l.deadline + 1);
        vm.prank(alice);
        lp.reveal(id, 1, "a");
        vm.prank(bob);
        lp.reveal(id, 2, "b");
        vm.prank(carol);
        lp.reveal(id, 2, "c");

        vm.warp(l.revealEnd);
        lp.settle(id);
        assertEq(uint8(lp.getLaunch(id).state), 2);
        assertEq(lp.survivedCount(creator), 0);

        // stakes net of 0.1%: losers = 2.997 (alice) + 0.999 (forfeit) + 0.0999 (bond) = 4.0959
        // winPool = 1.998; each NO winner gets 0.999 + 4.0959/2
        assertEq(TREASURY.balance, BOND_FEE + 0.006 ether); // no settlement fee
        assertEq(lp.claimable(id, bob), 0.999 ether + 2.04795 ether);
        assertEq(lp.claimable(id, carol), 0.999 ether + 2.04795 ether);
        assertEq(lp.claimable(id, alice), 0);

        vm.prank(bob);
        lp.claim(id);
        vm.prank(carol);
        lp.claim(id);

        vm.prank(creator);
        vm.expectRevert(DoomLaunchpad.NotSettled.selector);
        lp.claimBond(id);

        assertEq(address(lp).balance, 0); // fully solvent, nothing stuck
    }

    function test_noWinners_refundMode() public {
        uint256 id = _launch(1000 ether); // dies
        _commit(alice, id, 1, "a", 1 ether); // YES revealed
        _commit(bob, id, 2, "b", 1 ether); // NO unrevealed
        DoomLaunchpad.Launch memory l = lp.getLaunch(id);
        vm.warp(l.deadline);
        vm.prank(alice);
        lp.reveal(id, 1, "a");
        vm.warp(l.revealEnd);
        uint256 tr0 = TREASURY.balance;
        assertEq(tr0, BOND_FEE + 0.002 ether);
        lp.settle(id);
        assertEq(lp.claimable(id, alice), 0.999 ether);
        // forfeited bob stake + net bond pushed to treasury at settle
        assertEq(TREASURY.balance - tr0, 0.999 ether + NET_BOND);
        vm.prank(alice);
        lp.claim(id);
        assertEq(address(lp).balance, 0);
    }

    function test_commitmentHelperMatches() public view {
        bytes32 salt = keccak256("s");
        assertEq(lp.computeCommitment(1, salt, alice), keccak256(abi.encode(uint8(1), salt, alice)));
    }

    function testFuzz_buySellNeverDrains(uint96 a, uint96 b) public {
        uint256 id = _launch(100 ether);
        uint256 x = bound(uint256(a), 0.001 ether, 40 ether);
        uint256 y = bound(uint256(b), 0.001 ether, 40 ether);
        vm.prank(alice);
        uint256 outA = lp.buy{value: x}(id, 0);
        vm.prank(bob);
        uint256 outB = lp.buy{value: y}(id, 0);
        DoomToken t = DoomToken(lp.getLaunch(id).token);
        vm.startPrank(alice);
        t.approve(address(lp), outA);
        lp.sell(id, outA, 0);
        vm.stopPrank();
        vm.startPrank(bob);
        t.approve(address(lp), outB);
        lp.sell(id, outB, 0);
        vm.stopPrank();
        assertEq(address(lp).balance, lp.getCurve(id).realBnb + NET_BOND);
    }

    function test_betFee_minBetIsGross() public {
        uint256 id = _launch(100 ether);
        vm.prank(alice);
        vm.expectRevert(DoomLaunchpad.BetTooSmall.selector);
        lp.commit{value: 0.001 ether - 1}(id, bytes32(uint256(1)));
        uint256 tr0 = TREASURY.balance;
        _commit(alice, id, 1, "x", 0.001 ether);
        assertEq(TREASURY.balance - tr0, 0.000001 ether);
        assertEq(lp.getMarket(id).totalCommitted, 0.000999 ether);
    }

    function test_tinyTrade_zeroFeeNoEvent() public {
        uint256 id = _launch(100 ether);
        uint256 tr0 = TREASURY.balance;
        vm.prank(alice);
        lp.buy{value: 999}(id, 0); // fee rounds to 0
        assertEq(TREASURY.balance, tr0);
    }
}
