import { test, describe, expect } from "vitest";
import {
  applyDoubleCborEncoding,
  Assets,
  Constr,
  Data,
  Emulator,
  EmulatorAccount,
  generateEmulatorAccount,
  getAddressDetails,
  Lucid,
  validatorToAddress,
} from "@lucid-evolution/lucid";

import { TOKE, TokeDatum } from "../src/utils/Constants";
import plutus from "../../plutus.json";

describe("Vesting Testing", () => {
  async function listTokens(
    emulator: Emulator,
    lucid: Awaited<ReturnType<typeof Lucid>>,
    beneAccount: EmulatorAccount,
    vestingSlot: number
  ) {
    const contractAddress = validatorToAddress("Custom", {
      type: "PlutusV3",
      script: applyDoubleCborEncoding(plutus.validators[0].compiledCode),
    });

    const datum: TokeDatum = {
      slot: BigInt(vestingSlot),
      beneficiary: getAddressDetails(beneAccount.address).paymentCredential!
        .hash,
    };
    const asset: Assets = {
      [TOKE]: BigInt(3_000_000).valueOf(),
    };

    const tx = await lucid
      .newTx()
      .pay.ToContract(
        contractAddress,
        {
          kind: "inline",
          value: Data.to(datum, TokeDatum),
        },
        asset
      )
      .complete();

    const signedTx = await tx.sign.withWallet().complete();

    const txHash = await emulator.submitTx(signedTx.toCBOR());
    emulator.awaitBlock(1);
    console.log("txHash", txHash);
    return {
      txHash,
      contractAddress,
      code: applyDoubleCborEncoding(plutus.validators[0].compiledCode),
    };
  }

  test("List Tokens", async () => {
    const beneAccount = generateEmulatorAccount({
      lovelace: 5_000_000_000n,
    });
    const tokeAccount = generateEmulatorAccount({
      lovelace: 5_000_000_000n,
      [TOKE]: 5_000_000n,
    });

    const emulator = new Emulator([beneAccount, tokeAccount]);

    const lucid = await Lucid(emulator, "Custom");
    lucid.selectWallet.fromSeed(tokeAccount.seedPhrase);

    const { txHash } = await listTokens(emulator, lucid, beneAccount, 100);

    // console.log("LEDGER", emulator.ledger, `${txHash}0`);

    expect(emulator.ledger[`${txHash}0`]).toBeDefined();
  });

  test("Claim Listed Tokens", async () => {
    const beneAccount = generateEmulatorAccount({
      lovelace: 5_000_000_000n,
    });
    const tokeAccount = generateEmulatorAccount({
      lovelace: 5_000_000_000n,
      [TOKE]: 5_000_000n,
    });

    const emulator = new Emulator([beneAccount, tokeAccount]);

    const lucid = await Lucid(emulator, "Custom");
    lucid.selectWallet.fromSeed(tokeAccount.seedPhrase);

    const { contractAddress, code } = await listTokens(
      emulator,
      lucid,
      beneAccount,
      19
    );

    const utxos = await emulator.getUtxos(contractAddress);
    const pkh = getAddressDetails(beneAccount.address).paymentCredential!.hash;

    console.log("UTXOS", utxos, pkh, emulator.slot);

    const claimableUTxOs = utxos
      .filter((u) => !!u.datum)
      .filter((u) => {
        console.log(Data.from(u.datum!, TokeDatum).slot);
        return true;
      })
      .filter((u) => pkh === Data.from(u.datum!, TokeDatum).beneficiary)
      .filter((u) => emulator.slot > Data.from(u.datum!, TokeDatum).slot);

    expect(claimableUTxOs.length).toBeGreaterThan(0);

    lucid.selectWallet.fromSeed(beneAccount.seedPhrase);

    console.log("Set Slot: ", emulator.slot);
    const txn = await lucid
      .newTx()
      .collectFrom(claimableUTxOs, Data.to(new Constr(0, [])))
      .validTo(emulator.time + 3 * 60 * 1000)
      .validFrom(emulator.time)
      .attach.SpendingValidator({
        script: code,
        type: "PlutusV3",
      })
      .complete({
        localUPLCEval: false,
      });

    const signed = await txn.sign.withWallet().complete();
    console.log("SIGNED", signed.toCBOR());
    const txHash = await emulator.submitTx(signed.toCBOR());

    console.log(txHash);
  });
});
