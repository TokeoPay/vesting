import {Data, getAddressDetails, Lucid, Maestro, validatorToAddress, type Assets} from "@lucid-evolution/lucid"
import {readFile} from "node:fs/promises"
import plutus from "../plutus.json"
import { createReadStream } from "node:fs";
import { parse } from "csv-parse";

async function main() {
  // const blockfrost = new BlockfrostProvider()

  const args = process.argv;
  const inDebug = process.env.DEBUG == "1";

  const network = args[2];
  const maestroApiKey = args[3];
  const policy = args[4];
  const tokenName = args[5];
  const mnemonic = await readFile(args[6]);
  const file = createReadStream(args[7], "utf8");

  const parser = parse({
    delimiter: ",",
  });
  const pipe = file.pipe(parser);

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

  let report = [];
  let txHashList = [];

  try {
    let tx = lucid.newTx();

    const calcSlotForDate = getDateToCurrentSlot(lucid.currentSlot());

    let outputs = 0;

    let header = true;
    for await (const payout of pipe) {
      if (header) {
        header = false;
        continue;
      }
      for (let i = 14; i < payout.length - 2; i = i + 2) {
        const forDate = payout[i] as string;
        const payoutAmt = payout[i + 1] as string;
        const beneficiary = payout[4];

        console.log(forDate, payoutAmt, beneficiary);

        if (!forDate) continue;

        const amount = Number.parseInt(payoutAmt.replaceAll(",", ""));

        const slot = calcSlotForDate(Date.parse(forDate + ".Z") / 1000);

        const datum: TokeDatum = {
          slot: BigInt(slot).valueOf(),
          beneficiary: getAddressDetails(beneficiary).paymentCredential!.hash,
        };

        const d = Data.to(datum, TokeDatum);

        const asset: Assets = {
          [`${policy}${tokenName}`]: BigInt(amount).valueOf(),
        };

        tx = tx.pay.ToContract(
          contractAddress,
          { kind: "inline", value: d },
          asset
        );

        outputs += 1;

        report.push({
          beneficiary,
          amount,
          vestingDate: forDate,
          slot,
        });

        if (outputs > 30) {
          const [newWalletInputs, , chainTx] = await tx.chain();
          const signed = await chainTx.sign.withWallet().complete();
          console.log(signed.toCBOR(), "\n\n");
          lucid.overrideUTxOs(newWalletInputs);

          if (!inDebug) {
            const txHash = await signed.submit();
            txHashList.push(txHash);
            console.log(txHash);

            await lucid.awaitTx(txHash);
          }
          // console.log(await lucid.wallet().getUtxos());
          // Do stuff
          outputs = 0;
          tx = lucid.newTx();
        }
      }
    }

    if (outputs > 0) {
      const [newWalletInputs, , chainTx] = await tx.chain();
      const signed = await chainTx.sign.withWallet().complete();

      console.log("\n\n", signed.toCBOR(), "\n\n");
      if (!inDebug) {
        const txHash = await signed.submit();
        console.log(txHash);
        txHashList.push(txHash);

        await lucid.awaitTx(txHash);
        // const txHash = await signed.submit();
        // console.log("txHash", txHash);
        lucid.overrideUTxOs(newWalletInputs);
      }
    }
  } catch (e) {
    console.error(e);
    console.log(await lucid.wallet().getUtxos());
  }

  console.table(report);
  console.log("\n\n", txHashList);
}



function getDateToCurrentSlot(currentSlot: number) {
  const currentDate = Math.floor(Date.now() / 1000)
  return (forDate: number) => {
  
    return Math.floor(currentSlot + ((forDate - currentDate)))
  }
}

export const TokeDatumSchema = Data.Object({
  slot: Data.Integer(),
  beneficiary: Data.Bytes(),
});
export type TokeDatum = Data.Static<typeof TokeDatumSchema>;
export const TokeDatum = TokeDatumSchema as unknown as TokeDatum;


let payouts: {[key: string]: string}[] = [
  {
    "Wallet Address": "addr_test1qrgqd6mhs05vjvtqk2at9pau3fhsd857dyxds27qk54gcvtnpkq9k63v7eue3u8u6pcvuzmwsk2hl46ceu9wxjxjvh4sj4drgd", 
    "Unlock - 1": "429,166.00",
    "Date - 1": "23-Nov-2024",
    "Unlock - 2": "429,166.00",
    "Date - 2": "24-Nov-2024",
    "Unlock - 3": "429,166.00",
    "Date - 3": "25-Nov-2024",
    "Unlock - 4": "429,166.00",
    "Date - 4": "22-Jan-2026",
    "Unlock - 5": "429,166.00",
    "Date - 5": "22-Jan-2026",
    "Unlock - 6": "",
    "Date - 6": "",
    "Unlock - 7": "",
    "Date - 7": "",
    "Unlock - 8": "",
    "Date - 8": "",
    "Unlock - 9": "",
    "Date - 9": "",
    "Unlock - 10": "",
    "Date - 10": "",
    "Unlock - 11": "",
    "Date - 11": "",
    "Unlock - 12": "",
    "Date - 12": "",
    "Unlock - 13": "",
    "Date - 13": "",
    "Unlock - 14": "",
    "Date - 14": "",
    "Unlock - 15": "",
    "Date - 15": "",
    "Unlock - 16": "",
    "Date - 16": "",
    "Unlock - 17": "",
    "Date - 17": "",
    "Unlock - 18": "",
    "Date - 18": "",
  }
]



// const datum: TokeDatum = {
//   slot: BigInt(100),
//   beneficiary: "D006EB7783E8C93160B2BAB287BC8A6F069E9E690CD82BC0B52A8C31"
// }
// console.log(Data.to(datum, TokeDatum))
// if ("D8799F1864581CD006EB7783E8C93160B2BAB287BC8A6F069E9E690CD82BC0B52A8C31FF" === Data.to(datum, TokeDatum).toUpperCase()) {
//   console.log("We good!!")
// }

async function testSlot() {

  const args = process.argv

  const network = args[2]
  const maestroApiKey = args[3]
  const policy = args[4]
  const tokenName = args[5]
  const mnemonic = args[6]

  const lucid = await Lucid(
    new Maestro({
      network: network === 'mainnet' ? 'Mainnet' : 'Preprod', // For MAINNET: "Mainnet"
      apiKey: maestroApiKey, // Get yours by visiting https://docs.gomaestro.org/docs/Getting-started/Sign-up-login
      turboSubmit: false, // Read about paid turbo transaction submission feature at https://docs.gomaestro.org/docs/Dapp%20Platform/Turbo%20Transaction
    }),
    // new Blockfrost('https://cardano-mainnet.blockfrost.io/api/v0', flags.bfApiKey),
    network === 'mainnet' ? 'Mainnet' : 'Preprod',
  )

  const calcSlotForDate = getDateToCurrentSlot(lucid.currentSlot())

  console.log('====================================');
  // Dec 2, 2024 7:23:19 
  console.log(calcSlotForDate(Date.parse("2024-11-30 14:16:09.000") / 1000 ));
  console.log('===================================='); 
}

main().then(() => console.log("Done"))