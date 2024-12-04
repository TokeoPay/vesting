// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";
import { BlockFrostAPI } from "@blockfrost/blockfrost-js";
import { validators } from "../../../../plutus.json";
import {
  Data,
  getAddressDetails,
  slotToUnixTime,
  validatorToAddress,
} from "@lucid-evolution/lucid";

type ErrData = {
  err: string;
};

export const TokeDatumSchema = Data.Object({
  slot: Data.Integer(),
  beneficiary: Data.Bytes(),
});
export type TokeDatum = Data.Static<typeof TokeDatumSchema>;
export const TokeDatum = TokeDatumSchema as unknown as TokeDatum;

// type UTxOResult = ReturnType<typeof accountsAddressesAll>;

export default async function handler(
  req: NextApiRequest,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  res: NextApiResponse<ErrData | any>
) {
  const { addresses, network } = req.body;

  const tokeToken =
    network === "Mainnet"
      ? "375df3f2fb44d3c42b3381a09edd4ea2303a57ada32b5308c0774ee0544f4b45"
      : "9a5046383eac69a68377823db320d4d7739a9915262a75dadd0ca601544f4b45";

  if (!Array.isArray(addresses)) {
    return res
      .status(400)
      .json({ err: "Address is not validate", ...req.body });
  }

  const validatorAddress = validatorToAddress(network, {
    type: "PlutusV3",
    script: validators[0].compiledCode,
  });

  const bf = new BlockFrostAPI({
    projectId: process.env.BF_API!,
  });

  const utxos = await bf.addressesUtxosAll(validatorAddress);

  const pubKeyHashes = addresses
    .map((addr: string) => {
      try {
        console.log(getAddressDetails(addr).paymentCredential);
        return getAddressDetails(addr).paymentCredential?.hash;
      } catch (err) {
        console.error(err);
        return null;
      }
    })
    .filter((a) => !!a);

  const pkhToAddress = addresses.map((addr: string) => {
    try {
      return [addr, getAddressDetails(addr).paymentCredential?.hash] as const;
    } catch (err) {
      console.error(err);
      return [null, null];
    }
  })!;

  console.log("pubKeyHashes", pubKeyHashes);

  const latestBlock = await bf.blocksLatest();

  res.status(200).json(
    utxos
      .filter((u) => !!u.inline_datum)
      .filter((u) => {
        console.log(
          "beneficiary",
          Data.from(u.inline_datum!, TokeDatum).beneficiary
        );
        return pubKeyHashes.includes(
          Data.from(u.inline_datum!, TokeDatum).beneficiary
        );
      })
      .map((u) => {
        return {
          utxo: u,
          currentSlot: latestBlock.slot,
          mustBeSignedBy: pkhToAddress.find(
            ([, pkh]) =>
              pkh === Data.from(u.inline_datum!, TokeDatum).beneficiary
          )![0],
          amount: u.amount.entries().reduce((acc, asset) => {
            return (
              acc +
              (asset[1].unit === tokeToken
                ? Number.parseInt(asset[1].quantity)
                : 0)
            );
          }, 0),
          vestingDate: slotToUnixTime(
            network,
            Number.parseInt(
              Data.from(u.inline_datum!, TokeDatum).slot.toString()
            )
          ),
          vestingSlot: Data.from(u.inline_datum!, TokeDatum).slot.toString(),
          available:
            Date.now() >
            slotToUnixTime(
              network,
              Number.parseInt(
                Data.from(u.inline_datum!, TokeDatum).slot.toString()
              )
            ),
        };
      })
  );
}
