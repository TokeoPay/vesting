/* eslint-disable @typescript-eslint/no-explicit-any */
import { PlutusScript } from "@meshsdk/core";
import { useWallet } from "@meshsdk/react";
import { CardanoWallet } from "@meshsdk/react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, useRef } from "react";
import { validators } from "../../../plutus.json";

import {
  Lucid,
  Constr,
  Data,
  UTxO,
  Kupmios,
  addressFromHexOrBech32,
} from "@lucid-evolution/lucid";

import toast from "react-hot-toast";

export type VestingResponse = {
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
  status?: "Pending" | "Submitted";
};

export function Available() {
  const tableButtonRef = useRef<HTMLButtonElement | null>(null);
  const { connected, wallet, name } = useWallet();
  const [addresses, setAddresses] = useState<string[]>();
  const [cart, setCart] = useState<{ [key: string]: VestingResponse }>({});

  const [total, setTotal] = useState(0);
  const [claimed, setClaimed] = useState(0);
  const [unclaimed, setUnclaimed] = useState(0);
  const [locked, setLocked] = useState(0);
  const [isButtonVisible, setIsButtonVisible] = useState(true);

  const [loadingState, setLoadingState] = useState<
    "none" | "loading" | "processing"
  >("none");

  const totalInCart = Object.values(cart).reduce(
    (acc, current) => acc + current.amount,
    0
  );

  useEffect(() => {
    if (!connected) return;
    setCart({});
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
        });
    } catch (e) {
      toast.error("Error fetching addresses");
      console.error(e);
      setLoadingState("none");
    }
  }, [connected, wallet]);

  function addToCart(utxo: VestingResponse) {
    setCart((prevCart) => {
      const newCart = {
        ...prevCart,
        [`${utxo.utxo.tx_hash}.${utxo.utxo.output_index}`]: utxo,
      };
      return newCart;
    });
  }

  function removeFromCart(utxo: VestingResponse) {
    setCart((prevCart) => {
      const newCart = { ...prevCart };
      delete newCart[`${utxo.utxo.tx_hash}.${utxo.utxo.output_index}`];
      return newCart;
    });
  }
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsButtonVisible(entry.isIntersecting);
      },
      { threshold: 1.0 }
    );

    const tbr = tableButtonRef.current;
    if (tbr) {
      observer.observe(tbr);
    }

    return () => {
      if (tbr) {
        observer.unobserve(tbr);
      }
    };
  }, []);

  async function processCart() {
    const errorLogs = ["Starting: "];

    if (!name) return;

    if (Object.keys(cart).length === 0) return;

    // try {

    //   const txBuilder = new TransactionBuilder()

    //   const inputsBuilder = new TxInputsBuilder()

    //   Object.values(cart).forEach((utxo) => {
    //     const assets: Record<string, bigint> = {};

    //     utxo.utxo.amount.forEach((asset) => {
    //       assets[asset.unit] = BigInt(asset.quantity);
    //     });

    //     const u: UTxO = {
    //       address: utxo.utxo.address,
    //       outputIndex: utxo.utxo.output_index,
    //       txHash: utxo.utxo.tx_hash,
    //       assets: assets,
    //       datum: utxo.utxo.inline_datum,
    //     };

    //     inputsBuilder.add_plutus_script_utxo(
    //       TransactionUnspentOutput.from_bytes(
    //         utxoToCore(u).to_cbor_bytes()
    //       ),
    //       PlutusWitness.
    //     )

    //   });

    //   txBuilder.add_inputs_from()

    // } catch (err) {
    //   throw err
    // }

    try {
      setLoadingState("processing");
      errorLogs.push("Initializing Lucid instance...");
      const lucid = await Lucid(
        new Kupmios("/kupo-mn", "/ogmios-mn"),
        "Mainnet"
      );
      errorLogs.push("Selecting wallet from API...");
      lucid.selectWallet.fromAPI(
        await window.cardano[name].enable()
        // wallet._walletInstance as unknown as WalletApi
      );
      errorLogs.push("Preparing Plutus script...");
      const script: PlutusScript = {
        version: "V3",
        code: validators[0].compiledCode,
      };
      errorLogs.push("Setting redeemer...");
      const redeemer = Data.to(new Constr(0, []));
      // cart.values().map((utxo) => )
      errorLogs.push("Mapping UTxOs from cart...");
      const scriptUtxos = Object.values(cart).map((utxo) => {
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
      });

      errorLogs.push("Building transaction...");

      const txn = lucid.newTx().collectFrom(scriptUtxos, redeemer);

      Object.values(cart).forEach((utxo) => txn.addSigner(utxo.mustBeSignedBy));

      const x = Object.values(cart).find(() => true);
      if (!x) {
        errorLogs.push("No UTxOs found in the cart.");
        throw new Error("No UTxOs found in the cart.");
      }

      const walletAddress = addressFromHexOrBech32(
        (await wallet.getUsedAddresses())[0]
      );
      errorLogs.push(`Wallet address obtained: ${walletAddress}`);

      errorLogs.push("Finalizing transaction...");
      const completeTx = await txn
        .validFrom(Date.now())
        .validTo(Date.now() + 3 * 60 * 1000)
        .attach.SpendingValidator({
          type: "PlutusV3",
          script: script.code,
        })
        .complete({
          canonical: true,
          changeAddress: walletAddress.to_bech32(),
          localUPLCEval: false,
        });

      console.log(completeTx.toCBOR());
      errorLogs.push("Transaction finalized. Signing transaction...");

      const signed = await completeTx.sign.withWallet().complete();
      const txHash = await signed.submit();
      errorLogs.push(`Transaction submitted successfully: ${txHash}`);

      lucid.awaitTx(txHash);

      toast(
        <div className='flex items-center gap-2'>
          <svg
            xmlns='http://www.w3.org/2000/svg'
            viewBox='0 0 24 24'
            fill='#61D345'
            className='size-8'
          >
            <path
              fillRule='evenodd'
              d='M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z'
              clipRule='evenodd'
            />
          </svg>

          <div />
          <p>Transaction submitted successfully: {txHash}</p>
          <button
            onClick={() => {
              navigator.clipboard.writeText(txHash);
              toast.success("Copied to clipboard");
            }}
          >
            <svg
              xmlns='http://www.w3.org/2000/svg'
              fill='none'
              viewBox='0 0 24 24'
              strokeWidth={1.5}
              stroke='currentColor'
              className='size-4'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                d='M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5A3.375 3.375 0 0 0 6.375 7.5H5.25m11.9-3.664A2.251 2.251 0 0 0 15 2.25h-1.5a2.251 2.251 0 0 0-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6V4.5c0-.231.035-.454.1-.664M6.75 7.5H4.875c-.621 0-1.125.504-1.125 1.125v12c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V16.5a9 9 0 0 0-9-9Z'
              />
            </svg>
          </button>
        </div>,
        {
          duration: 10000,
        }
      );

      const updatedCart: { [key: string]: VestingResponse } = {};

      Object.entries(cart).forEach(([k, v]) => {
        v.status = "Submitted";
        updatedCart[k] = v;
      });

      setCart(updatedCart);

      // const confirmed = await lucid.awaitTx(txHash);
      // if (confirmed) {
      //   toast.success("Transaction confirmed!");
      //   refetch(); // Refresh the data after confirmation
      // } else {
      //   toast.error("Transaction not confirmed within the expected time.");
      //   updatedCart.forEach((value) => {
      //     value.status = "Pending";
      //   });
      //   setCart(updatedCart);
      // }
    } catch (e: any) {
      errorLogs.push(
        `Error encountered: ${
          e?.message || JSON.stringify(e) || "Unknown error"
        }`
      );
      toast.error("Error processing cart");
      fetch("/api/log", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: errorLogs,
        }),
      })
        .then((res) => res.json())
        .then((data) => console.log("API Response:", data))
        .catch((err) => console.error("Error:", err));

      console.error(e);
    } finally {
      setLoadingState("none");
    }
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
          network: "Mainnet", //"Preprod",
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
    const claimedAmount = 0;
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
    <span className=' flex flex-col mt-4 md:mt-8 w-full h-full'>
      <div className='w-full flex flex-col md:flex-row justify-between items-start md:items-end'>
        <div className='flex flex-col'>
          <p className='text-gray-600 font-semibold'>$TOKE</p>
          <p className='text-gray-800 font-semibold text-2xl'>Token Vesting</p>
        </div>
        <div className=' border border-gray-600 rounded-md  text-gray-800 flex items-center h-min overflow-clip '>
          <p className='text-gray-800 p-1 border-r border-gray-600 text-sm bg-gray-200 font-semibold'>
            $TOKE
          </p>
          <div className='flex p-1 items-center'>
            <p className='lg:flex hidden text-sm font-semibold'>
              375df3f2fb44d3c42b3381a09edd4ea2303a57ada32b5308c0774ee0
            </p>
            <p className='lg:hidden flex text-sm'>375df3f2..8c0774ee0</p>
            <div
              className='flex items-center pl-1'
              onClick={() => {
                navigator.clipboard.writeText(
                  "375df3f2fb44d3c42b3381a09edd4ea2303a57ada32b5308c0774ee0"
                );
                toast.success("Copied to clipboard");
              }}
            >
              <svg
                xmlns='http://www.w3.org/2000/svg'
                fill='none'
                viewBox='0 0 24 24'
                strokeWidth={1.5}
                stroke='currentColor'
                className='size-4'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  d='M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5A3.375 3.375 0 0 0 6.375 7.5H5.25m11.9-3.664A2.251 2.251 0 0 0 15 2.25h-1.5a2.251 2.251 0 0 0-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6V4.5c0-.231.035-.454.1-.664M6.75 7.5H4.875c-.621 0-1.125.504-1.125 1.125v12c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V16.5a9 9 0 0 0-9-9Z'
                />
              </svg>
            </div>
          </div>
        </div>
      </div>
      {loadingState === "loading" ? (
        <div className='w-full h-full flex justify-center items-center'>
          <p className='text-gray-800 font-semibold'>Loading data...</p>
        </div>
      ) : (
        <>
          {!connected ? (
            <div className='max-w-max w-full mx-auto my-auto px-2 md:px-8 py-8 flex flex-col gap-6 items-center justify-center rounded-md border border-gray-600 bg-gray-200 shadow'>
              <CardanoWallet />
              <p className='text-gray-800 font-semibold text-lg'>
                Connect your wallet to view your allocation
              </p>
            </div>
          ) : (
            <div className='flex flex-col'>
              <AllocationBar
                total={total}
                claimed={claimed}
                unclaimed={unclaimed}
                locked={locked}
              />

              <table
                style={{ tableLayout: "fixed" }}
                className='w-full border-collapse border border-gray-800 rounded-lg overflow-hidden shadow'
              >
                <thead>
                  <tr className='bg-gray-200'>
                    <th className='px-4 py-3 text-gray-800 text-left font-semibold'>
                      Vesting Date
                    </th>
                    <th className='px-4 py-3 text-gray-800 text-left font-semibold'>
                      Token Amount
                    </th>
                    <th className='px-4 py-3 text-gray-800 text-right font-semibold'>
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedData?.map((u: VestingResponse, index: any) => {
                    const isInCart =
                      !!cart[`${u.utxo.tx_hash}.${u.utxo.output_index}`];

                    return (
                      <tr
                        key={`${u.utxo.tx_hash}.${u.utxo.tx_index}`}
                        className={`border-b ${
                          index % 2 === 0 ? "bg-white" : "bg-gray-100"
                        }`}
                      >
                        <td className='px-4 py-2 text-gray-800'>
                          {Intl.DateTimeFormat().format(
                            new Date(u.vestingDate)
                          )}
                        </td>
                        <td className='px-4 py-2 text-gray-800'>
                          {u.amount.toLocaleString()} TOKE
                        </td>
                        <td className='px-4 py-2 text-right'>
                          {u.status === "Submitted" ? (
                            <p
                              className='
                              text-green-500 font-semibold py-1 px-4 rounded transition w-maz
                            '
                            >
                              Submitted
                            </p>
                          ) : u.available ? (
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
                              className='bg-gray-400 text-gray-600 font-semibold py-1 px-4 rounded cursor-not-allowed'
                            >
                              <p className='md:flex hidden'>Unavailable</p>
                              <p className='md:hidden flex'>N/A</p>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {Object.keys(cart).length > 0 && (
                <>
                  <button
                    ref={tableButtonRef}
                    onClick={processCart}
                    className='mt-2 bg-gray-800 hover:bg-gray-600 font-semibold text-white py-2 px-4 border rounded-md'
                  >
                    {loadingState === "processing"
                      ? "Processing..."
                      : `Claim $TOKE ${totalInCart.toLocaleString()}`}
                  </button>

                  {/* Floating Button */}
                  {!isButtonVisible && (
                    <div className='fixed bottom-0 left-0 right-0 bg-gray-800 p-4 shadow-lg z-50'>
                      <button
                        onClick={processCart}
                        className='w-full font-semibold text-white py-3 px-4 rounded-md bg-blue-600 hover:bg-blue-500'
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
            </div>
          )}
        </>
      )}
    </span>
  );
}

export function AllocationBar({
  total,
  // claimed,
  unclaimed,
  locked,
}: {
  total: number;
  claimed: number;
  unclaimed: number;
  locked: number;
}) {
  // const claimedPercentage = (claimed / total) * 100;
  const unclaimedPercentage = (unclaimed / total) * 100;
  const lockedPercentage = (locked / total) * 100;

  return (
    <div className='allocation-container mt-4' style={{ color: "#ffffff" }}>
      <p className='font-semibold mb-2 text-gray-700 text-lg font'>
        TOTAL ALLOCATION
      </p>
      <div
        className='allocation-bar'
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
      <div className='allocation-info mt-2 flex gap-x-4 w-full flex-wrap'>
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
