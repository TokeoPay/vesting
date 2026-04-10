import { readFile } from "node:fs/promises";
import plutus from "../plutus.json";
import {
  Data,
  getAddressDetails,
  Lucid,
  Maestro,
  validatorToAddress,
  type Assets,
} from "@lucid-evolution/lucid";
import { getDateToCurrentSlot, TokeDatum } from "./utils";

async function main() {
  // const blockfrost = new BlockfrostProvider()

  const args = process.argv;
  const inDebug = process.env.DEBUG == "1";

  const network = args[2];
  const maestroApiKey = args[3];
  const policy = args[4];
  const tokenName = args[5];
  const mnemonic = await readFile(args[6]);
  const vestTo = args[7];

  console.log(
    JSON.stringify({
      network,
      maestroApiKey,
      policy,
      tokenName,
      mnPath: args[6],
      vestTo,
    })
  );

  const lucid = await Lucid(
    new Maestro({
      network: network === "mainnet" ? "Mainnet" : "Preprod", // For MAINNET: "Mainnet"
      apiKey: maestroApiKey, // Get yours by visiting https://docs.gomaestro.org/docs/Getting-started/Sign-up-login
      turboSubmit: false, // Read about paid turbo transaction submission feature at https://docs.gomaestro.org/docs/Dapp%20Platform/Turbo%20Transaction
    }),
    // new Blockfrost('https://cardano-mainnet.blockfrost.io/api/v0', flags.bfApiKey),
    network === "mainnet" ? "Mainnet" : "Preprod"
  );

  lucid.selectWallet.fromSeed(mnemonic.toString("utf-8"));
  const validator = plutus.validators[0];

  const contractAddress = validatorToAddress(
    network === "mainnet" ? "Mainnet" : "Preprod",
    {
      type: "PlutusV3",
      script: validator.compiledCode,
    }
  );

  const calcSlotForDate = getDateToCurrentSlot(lucid.currentSlot());
  let tx = lucid.newTx();

  const slot = calcSlotForDate(Date.parse("2027-01-01 00:00:00.000.Z") / 1000);
  const datum: TokeDatum = {
    slot: BigInt(slot).valueOf(),
    beneficiary: getAddressDetails(vestTo).paymentCredential!.hash,
  };
  const d = Data.to(datum, TokeDatum);
  const asset: Assets = {
    [`${policy}${tokenName}`]: BigInt(1).valueOf(),
  };
  tx = tx.pay.ToContract(contractAddress, { kind: "inline", value: d }, asset);
  const transaction = await tx.complete();
  const signed = await transaction.sign.withWallet().complete();

  if (!inDebug) {
    const txHash = await signed.submit();
    await lucid.awaitTx(txHash);
  } else {
    console.log("\n\n", signed.toCBOR(), "\n\n");
  }
}

main().then(() => console.log("Done"));
