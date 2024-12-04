/* eslint-disable @typescript-eslint/no-explicit-any */
import { PlutusScript } from "@meshsdk/core";
import { useWallet } from "@meshsdk/react";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { validators } from "../../../plutus.json";
import {
  Lucid,
  // Blockfrost,
  WalletApi,
  Constr,
  Data,
  UTxO,
  Kupmios,
} from "@lucid-evolution/lucid";

// const blockfrost = new Blockfrost(
//   "https://cardano-preprod.blockfrost.io/api/v0",
//   process.env.NEXT_PUBLIC_BF_API!
// );

type VestingResponse = {
  utxo: {
    address: string;
    tx_hash: string;
    tx_index: number;
    output_index: number;
    amount: {
      unit: string;
      quantity: string;
    }[];
    block: string;
    data_hash: string | null;
    inline_datum: string | null;
    reference_script_hash: string | null;
  };
  amount: number;
  vestingSlot: string;
  available: boolean;
  vestingDate: number;
  currentSlot: number;
  mustBeSignedBy: string;
};

export function Available() {
  const { connected, wallet } = useWallet();
  const [txHash, setTxHash] = useState("");
  const [addresses, setAddresses] = useState<string[]>();
  const [cart, setCart] = useState(new Map<string, VestingResponse>());

  useEffect(() => {
    if (!connected) return;

    Promise.all([wallet.getUsedAddresses(), wallet.getUnusedAddresses()]).then(
      (value) => setAddresses([...value[0], ...value[1]])
    );
  }, [connected, wallet]);

  function addToCart(utxo: VestingResponse) {
    setCart((c) => {
      const upd = new Map(c);
      upd.set(`${utxo.utxo.tx_hash}.${utxo.utxo.output_index}`, utxo);
      return upd;
    });
  }

  async function processCart() {
    if (cart.size === 0) return;

    const lucid = await Lucid(new Kupmios("/kupo", "/ogmios"), "Preprod");

    lucid.selectWallet.fromAPI(wallet._walletInstance as unknown as WalletApi);
    const script: PlutusScript = {
      version: "V3",
      code: validators[0].compiledCode,
    };
    const redeemer = Data.to(new Constr(0, []));
    // cart.values().map((utxo) => )

    const scriptUtxos = cart
      .values()
      .map((utxo) => {
        const assets: Record<string, bigint> = {};

        utxo.utxo.amount.forEach((asset) => {
          assets[asset.unit] = BigInt(asset.quantity);
        });

        const u: UTxO = {
          address: utxo.utxo.address,
          outputIndex: utxo.utxo.output_index,
          txHash: utxo.utxo.tx_hash,
          assets: assets,
          datum: utxo.utxo.inline_datum,
        };

        return u;
      })
      .toArray();

    const txn = lucid.newTx().collectFrom(scriptUtxos, redeemer);

    cart.values().forEach((utxo) => txn.addSigner(utxo.mustBeSignedBy));

    const x = cart.values().find(() => true);
    if (!x) return;

    const walletAddress = (await wallet.getUsedAddress()).toBech32();
    const completeTx = await txn
      .validFrom(Date.now())
      .validTo(Date.now() + 3 * 60 * 1000)
      .attach.SpendingValidator({
        type: "PlutusV3",
        script: script.code,
      })
      .complete({
        changeAddress: walletAddress,
        localUPLCEval: false,
      });

    console.log(completeTx.toCBOR());

    const signed = await completeTx.sign.withWallet().complete();
    setTxHash(await signed.submit());
  }

  const { data } = useQuery({
    queryKey: ["vestingData"],
    enabled: !!addresses?.length,
    queryFn: () =>
      fetch("/api/get_available_vesting", {
        method: "post",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          addresses,
          network: "Preprod",
        }),
      }).then((res) => res.json()),
  });

  if (!connected) {
    return <span>No wallet connected.</span>;
  }

  return (
    <span className='text-green-500'>
      {data?.map((u: VestingResponse) => {
        return (
          <span key={`${u.utxo.tx_hash}.${u.utxo.tx_index}`} className='flex'>
            {u.available ? (
              <div>
                Claimable: {u.amount}{" "}
                <button
                  onClick={() => addToCart(u)}
                  className='bg-transparent hover:bg-green-500 text-green-700 font-semibold hover:text-white py-2 px-4 border border-green-500 hover:border-transparent rounded'
                >
                  Add to cart
                </button>
              </div>
            ) : (
              <div>
                Unavailable: {u.amount} TOKE Vesting on{" "}
                {Intl.DateTimeFormat().format(new Date(u.vestingDate))} (SLOT:{" "}
                {u.vestingSlot})
              </div>
            )}
          </span>
        );
      })}
      {cart.size === 0 ? (
        <></>
      ) : (
        <button
          onClick={processCart}
          className='bg-transparent hover:bg-green-500 text-green-700 font-semibold hover:text-white py-2 px-4 border border-green-500 hover:border-transparent rounded'
        >
          Process our cart
        </button>
      )}

      {txHash ? (
        <div className='p-6 absolute bottom-0 left-0 right-0 border-green-500 text-green-400'>
          Submitted: <span>{txHash}</span>
        </div>
      ) : null}
    </span>
  );
}
