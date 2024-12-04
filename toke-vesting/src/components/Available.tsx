/* eslint-disable @typescript-eslint/no-explicit-any */
import { PlutusScript } from "@meshsdk/core";
import { useWallet } from "@meshsdk/react";
import { CardanoWallet } from "@meshsdk/react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, useRef } from "react";
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
import toast from "react-hot-toast";

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
  const tableButtonRef = useRef<HTMLButtonElement | null>(null);
  const { connected, wallet } = useWallet();
  const [txHash, setTxHash] = useState("");
  const [addresses, setAddresses] = useState<string[]>();
  const [cart, setCart] = useState(new Map<string, VestingResponse>());

  const [total, setTotal] = useState(0);
  const [claimed, setClaimed] = useState(0);
  const [unclaimed, setUnclaimed] = useState(0);
  const [locked, setLocked] = useState(0);
  const [isButtonVisible, setIsButtonVisible] = useState(true);

  const [loadingState, setLoadingState] = useState<
    "none" | "loading" | "processing"
  >("none");

  const totalInCart = Array.from(cart.values()).reduce(
    (acc, current) => acc + current.amount,
    0
  );

  useEffect(() => {
    if (!connected) return;
    setCart(new Map());
    setTxHash("");
    setAddresses([]);

    try {
      setLoadingState("loading");

      Promise.all([wallet.getUsedAddresses(), wallet.getUnusedAddresses()])
        .then((value) => {
          setAddresses([...value[0], ...value[1]]);
          // refetch();
        })
        .catch((e) => {
          toast.error("Error fetching addresses");
          console.error(e);
        })
    } catch (e) {
      toast.error("Error fetching addresses");
      console.error(e);
      setLoadingState("none");
    }
  }, [connected, wallet]);

  function addToCart(utxo: VestingResponse) {
    setCart((prevCart) => {
      const updatedCart = new Map(prevCart);
      updatedCart.set(`${utxo.utxo.tx_hash}.${utxo.utxo.output_index}`, utxo);
      return updatedCart;
    });
  }

  function removeFromCart(utxo: VestingResponse) {
    setCart((prevCart) => {
      const updatedCart = new Map(prevCart);
      updatedCart.delete(`${utxo.utxo.tx_hash}.${utxo.utxo.output_index}`);
      return updatedCart;
    });
  }
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsButtonVisible(entry.isIntersecting);
      },
      { threshold: 1.0 }
    );

    if (tableButtonRef.current) {
      observer.observe(tableButtonRef.current);
    }

    return () => {
      if (tableButtonRef.current) {
        observer.unobserve(tableButtonRef.current);
      }
    };
  }, []);

  async function processCart() {
    if (cart.size === 0) return;
    try {
      setLoadingState("processing");
      const lucid = await Lucid(new Kupmios("/kupo", "/ogmios"), "Preprod");

      lucid.selectWallet.fromAPI(
        wallet._walletInstance as unknown as WalletApi
      );
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
      let txHash = await signed.submit();

      lucid.awaitTx(txHash);

      toast.success("Transaction submitted successfully!");
      setTxHash(txHash);
    } catch (e) {
      toast.error("Error processing cart");
      console.error(e);
    } finally {
      setLoadingState("none");
    }
  }

  const { data, refetch } = useQuery({
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
      })
        .then((res) => res.json())
        .catch((e) => {
          toast.error("Error fetching vesting data");
          console.error(e);
        })
        .finally(() => setLoadingState("none")),
  });

  useEffect(() => {
    if (!data) return;
      setLoadingState("loading");

    // Calculate total, claimed, unclaimed, and locked values
    let totalAmount = 0;
    let claimedAmount = 0;
    let unclaimedAmount = 0;
    let lockedAmount = 0;

    data.forEach((vesting: VestingResponse) => {
      totalAmount += vesting.amount;
      if (vesting.available) {
        unclaimedAmount += vesting.amount;
      } else {
        lockedAmount += vesting.amount;
      }
    });

    setTotal(totalAmount);
    setClaimed(claimedAmount);
    setUnclaimed(unclaimedAmount);
    setLocked(lockedAmount);
    setLoadingState("none");
  }, [data]);
  // Sort data by vestingDate
  const sortedData = data?.sort(
    (a: VestingResponse, b: VestingResponse) => a.vestingDate - b.vestingDate
  );

  return (
    <span className=" flex flex-col mt-4 md:mt-8 w-full h-full overflow-scroll">
      <div className="w-full flex flex-col md:flex-row justify-between items-start md:items-end">
        <div className="flex flex-col">
          <p className="text-gray-600 font-semibold">$TOKE</p>
          <p className="text-gray-800 font-semibold text-2xl">Token Vesting</p>
        </div>
        <div className=" border border-gray-600 rounded-md  text-gray-800 flex items-center h-min overflow-clip ">
          <p className="text-gray-800 p-1 border-r border-gray-600 text-sm bg-gray-200 font-semibold">
            $TOKE
          </p>
          <div className="flex p-1">
            <p className="md:flex hidden text-sm font-semibold">
              375df3f2fb44d3c42b3381a09edd4ea2303a57ada32b5308c0774ee0544f4b45
            </p>
            <p className="md:hidden flex text-sm">375df3f2..544f4b45</p>
            {/* //copy icon */}
          </div>
        </div>
      </div>
      {loadingState === "loading" ? (
        <div className="w-full h-full flex justify-center items-center">
          <p className="text-gray-800 font-semibold">Loading data...</p>
        </div>
      ) : (
        <>
          {!connected ? (
            <div className="w-max mx-auto my-auto px-2 md:px-8 py-8 flex flex-col gap-8 items-center justify-center rounded-md border border-gray-800 bg-gray-200">
              <CardanoWallet />
              <p className="text-gray-800 font-semibold text-lg">
                Connect your wallet to view your allocation
              </p>
            </div>
          ) : (
            <div className="flex flex-col">
              <AllocationBar
                total={total}
                claimed={claimed}
                unclaimed={unclaimed}
                locked={locked}
              />

              <table className="w-full border-collapse border border-gray-800 rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-gray-200">
                    <th className="px-4 py-3 text-gray-800 text-left font-semibold">
                      Vesting Date
                    </th>
                    <th className="px-4 py-3 text-gray-800 text-left font-semibold">
                      Token Amount
                    </th>
                    <th className="px-4 py-3 text-gray-800 text-right font-semibold">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedData?.map((u: VestingResponse, index: any) => {
                    const isInCart = cart.has(
                      `${u.utxo.tx_hash}.${u.utxo.output_index}`
                    );

                    return (
                      <tr
                        key={`${u.utxo.tx_hash}.${u.utxo.tx_index}`}
                        className={`border-b ${
                          index % 2 === 0 ? "bg-white" : "bg-gray-100"
                        }`}
                      >
                        <td className="px-4 py-2 text-gray-800">
                          {Intl.DateTimeFormat().format(
                            new Date(u.vestingDate)
                          )}
                        </td>
                        <td className="px-4 py-2 text-gray-800">
                          {u.amount.toLocaleString()} TOKE
                        </td>
                        <td className="px-4 py-2 text-right">
                          {u.available ? (
                            <button
                              onClick={() =>
                                isInCart ? removeFromCart(u) : addToCart(u)
                              }
                              className={`${
                                isInCart
                                  ? "border border-red-700 text-red-700 bg-white hover:bg-red-700 hover:text-white"
                                  : "border border-gray-800 text-gray-800 bg-white hover:bg-[#4f46E5] hover:text-white"
                              } font-semibold py-1 px-4 rounded transition`}
                            >
                              {isInCart ? "Remove" : "Add"}
                            </button>
                          ) : (
                            <button
                              disabled
                              className="bg-gray-400 text-gray-600 font-semibold py-1 px-4 rounded cursor-not-allowed"
                            >
                              Unavailable
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {cart.size > 0 && (
                <>
                  <button
                    ref={tableButtonRef}
                    onClick={processCart}
                    className="mt-2 bg-gray-800 hover:bg-gray-600 font-semibold text-white py-2 px-4 border rounded-md"
                  >
                    {loadingState === "processing"
                      ? "Processing..."
                      : `Claim $TOKE ${totalInCart.toLocaleString()}`}
                  </button>

                  {/* Floating Button */}
                  {!isButtonVisible && (
                    <div className="fixed bottom-0 left-0 right-0 bg-gray-800 p-4 shadow-lg z-50">
                      <button
                        onClick={processCart}
                        className="w-full font-semibold text-white py-3 px-4 rounded-md bg-blue-600 hover:bg-blue-500"
                        disabled={loadingState === "processing"}
                      >
                        {loadingState === "processing"
                          ? "Processing..."
                          : `Claim $TOKE ${totalInCart.toLocaleString()}`}
                      </button>
                    </div>
                  )}
                </>
              )}

              {txHash ? (
                <div className="p-6 absolute bottom-0 left-0 right-0 border-green-500 text-green-400">
                  Submitted: <span>{txHash}</span>
                </div>
              ) : null}
            </div>
          )}
        </>
      )}
    </span>
  );
}

export function AllocationBar({
  total,
  claimed,
  unclaimed,
  locked,
}: {
  total: number;
  claimed: number;
  unclaimed: number;
  locked: number;
}) {
  const claimedPercentage = (claimed / total) * 100;
  const unclaimedPercentage = (unclaimed / total) * 100;
  const lockedPercentage = (locked / total) * 100;

  return (
    <div className="allocation-container mt-4" style={{ color: "#ffffff" }}>
      <p className="font-semibold mb-2 text-gray-700 text-lg font">
        TOTAL ALLOCATION
      </p>
      <div
        className="allocation-bar"
        style={{
          display: "flex",
          height: "8px",
          backgroundColor: "#2E2E2E",
          borderRadius: "4px",
          overflow: "hidden",
        }}
      >
        {/* <div
          style={{
            width: `${claimedPercentage}%`,
            backgroundColor: "#1f2937",
            transition: "width 0.3s ease",
          }}
        ></div> */}
        <div
          style={{
            width: `${unclaimedPercentage}%`,
            backgroundColor: "#4f46E5",
            transition: "width 0.3s ease",
          }}
        ></div>
        <div
          style={{
            width: `${lockedPercentage}%`,
            backgroundColor: "#374151",
            transition: "width 0.3s ease",
          }}
        ></div>
      </div>
      <div className="allocation-info mt-2 flex gap-4">
        <span
          style={{ color: "#000000", display: "flex", alignItems: "center" }}
        >
          {/* <div
            style={{
              width: "8px",
              height: "8px",
              backgroundColor: "#000000",
              borderRadius: "50%",
              marginRight: "8px",
            }}
          ></div> */}
          {total.toLocaleString()} Total Remaining
        </span>
        <span
          style={{ color: "#4f46E5", display: "flex", alignItems: "center" }}
        >
          <div
            style={{
              width: "8px",
              height: "8px",
              backgroundColor: "#4f46E5",
              borderRadius: "50%",
              marginRight: "8px",
            }}
          ></div>
          {unclaimed.toLocaleString()} Claimable
        </span>
        <span
          style={{ color: "#374151", display: "flex", alignItems: "center" }}
        >
          <div
            style={{
              width: "8px",
              height: "8px",
              backgroundColor: "#374151",
              borderRadius: "50%",
              marginRight: "8px",
            }}
          ></div>
          {locked.toLocaleString()} Locked
        </span>
      </div>
    </div>
  );
}
