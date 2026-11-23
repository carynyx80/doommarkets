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

    function _launch(uint256 target) internal returns (uint256 id) {
        vm.prank(creator);
        id = lp.createLaunch{value: 0.1 ether}("Doom Cat", "DCAT", target, DURATION);
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
    }

    function test_createLaunch() public {
        uint256 id = _launch(100 ether);
        assertEq(id, 1);
        DoomLaunchpad.Launch memory l = lp.getLaunch(id);
        assertEq(l.creator, creator);
        assertEq(l.bond, 0.1 ether);
        assertEq(l.targetMcap, 100 ether);
        assertEq(l.deadline, block.timestamp + DURATION);
        assertEq(l.commitEnd, l.deadline);
        assertEq(l.revealEnd, l.deadline + 24 hours);
        assertEq(uint8(l.state), 0);
        DoomToken t = DoomToken(l.token);
        assertEq(t.totalSupply(), 1_000_000_000 ether);
        assertEq(t.balanceOf(address(lp)), 1_000_000_000 ether);
        assertEq(t.symbol(), "DCAT");
        assertEq(lp.launchedCount(creator), 1);
        assertEq(lp.tokenToLaunch(l.token), id);
    }

    function test_createLaunch_bondTooLow() public {
        vm.prank(creator);
        vm.expectRevert(DoomLaunchpad.BondTooLow.selector);
        lp.createLaunch{value: 0.01 ether}("X", "X", 1 ether, DURATION);
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
        lp.createLaunch{value: 0.1 ether}("X", "X", 1 ether, DURATION);
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
        vm.prank(alice);
        uint256 out = lp.buy{value: 1 ether}(id, quote);
        assertEq(out, quote);
        DoomToken t = DoomToken(lp.getLaunch(id).token);
        assertEq(t.balanceOf(alice), out);
        assertEq(lp.protocolFeesAccrued(), 0.01 ether);
        assertGt(lp.currentPrice(id), p0);

        vm.startPrank(alice);
        t.approve(address(lp), out);
        uint256 q = lp.quoteSell(id, out);
        uint256 balBefore = alice.balance;
        uint256 bnbOut = lp.sell(id, out, q);
        vm.stopPrank();
        assertEq(bnbOut, q);
        assertEq(alice.balance - balBefore, bnbOut);
        assertLt(bnbOut, 1 ether);
        assertEq(lp.getCurve(id).tokensSold, 0);
        assertApproxEqAbs(lp.currentPrice(id), p0, 1);

        uint256 fees = lp.protocolFeesAccrued();
        assertGt(fees, 0.01 ether);
        lp.withdrawFees();
        assertEq(TREASURY.balance, fees);
        assertEq(lp.protocolFeesAccrued(), 0);
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
        // contract holds reserve + fee exactly as spent
        assertEq(address(lp).balance, spent + 0.1 ether);
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

        _commit(alice, id, 1, "a", 2 ether); // YES
        _commit(bob, id, 2, "b", 1 ether); // NO
        _commit(carol, id, 2, "c", 0.5 ether); // NO, never reveals -> forfeited

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
        uint256 feesBefore = lp.protocolFeesAccrued();
        lp.settle(id);
        assertEq(uint8(lp.getLaunch(id).state), 1); // Survived
        assertEq(lp.survivedCount(creator), 1);

        // losers = 1 (bob) + 0.5 (carol forfeited) = 1.5; fee 2% = 0.03
        assertEq(lp.protocolFeesAccrued() - feesBefore, 0.03 ether);
        uint256 expected = 2 ether + 1.47 ether;
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
        assertEq(creator.balance - c0, 0.1 ether);
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

        // losers = 3 (alice) + 1 (forfeit) + 0.1 (bond) = 4.1; fee = 0.082; distributable = 4.018
        assertEq(lp.protocolFeesAccrued(), 0.082 ether);
        assertEq(lp.claimable(id, bob), 1 ether + 2.009 ether);
        assertEq(lp.claimable(id, carol), 1 ether + 2.009 ether);
        assertEq(lp.claimable(id, alice), 0);

        vm.prank(bob);
        lp.claim(id);
        vm.prank(carol);
        lp.claim(id);

        vm.prank(creator);
        vm.expectRevert(DoomLaunchpad.NotSettled.selector);
        lp.claimBond(id);

        lp.withdrawFees();
        assertEq(TREASURY.balance, 0.082 ether);
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
        lp.settle(id);
        assertEq(lp.claimable(id, alice), 1 ether);
        assertEq(lp.protocolFeesAccrued(), 1 ether + 0.1 ether);
        vm.prank(alice);
        lp.claim(id);
        lp.withdrawFees();
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
        assertGe(address(lp).balance, lp.protocolFeesAccrued() + 0.1 ether);
    }
}
