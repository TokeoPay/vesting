"use client";

import { CardanoWallet } from "@meshsdk/react";
import Image from "next/image";
import Link from "next/link";
import React, { useState } from "react";
export const Header = () => {
  const [isOpen] = useState(false);
  return (
    <div className=' bg-gray-50 w-full z-30 '>
      <div className='flex flex-col w-full items-center shadow'>
        <div className='flex flex-row w-full px-5 sm:px-10 py-5 justify-between sm:container items-center'>
          <div className='flex h-min'>
            <Link href='/'>
              <Image
                src='/tokeo-logo@2x.png'
                width={120}
                height={30}
                alt='Picture of the author'
              />
            </Link>
          </div>

          {/* <div className="flex md:hidden">
                        <button
                            onClick={() => setIsOpen(!isOpen)}
                            className="outline-none focus:outline-none"
                        >
                            <svg
                                className="w-6 h-6 text-gray-700 hover:text-purple"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                {isOpen ? (
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M6 18L18 6M6 6l12 12"
                                    />
                                ) : (
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M4 6h16M4 12h16m-7 6h7"
                                    />
                                )}
                            </svg>
                        </button>
                    </div> */}
          <div className='hidden md:flex'>
            <CardanoWallet />
          </div>
        </div>

        {isOpen && (
          <div
            className={`flex md:hidden  w-full bg-gray-50 py-3 text-gray-700`}
          >
            <div className='flex flex-col items-center justify-center w-full gap-4'>
              {/* <LinkTo
                to="features"
                className="text-base font-semibold cursor-pointer py-2"
              >
                Features
              </LinkTo>
              <Link href="/Tokenomics" className="text-base  py-2">
                Tokenomics
              </Link>
              <Link href="/About" className="text-base  py-2">
                About
              </Link>
              <Link href="/Team" className="text-base py-2">
                Team
              </Link> */}

              <Link
                target='_blank'
                href='https://tokeo.gitbook.io/tokeo/tokeo/tokenomics'
                className='text-base font-medium pt-2'
              >
                Tokenomics
              </Link>
              <Link
                target={"_blank"}
                href='https://tokeo.gitbook.io/tokeo/tokeo/tokeo/our-team'
                className='text-base font-medium pt-2'
              >
                Team
              </Link>

              <a
                target='_blank'
                href='https://apps.apple.com/us/app/tokeo-wallet/id6476824031?itsct=apps_box_badge&itscg=30200'
                style={{
                  display: "inline-block",
                  overflow: "hidden",
                  borderRadius: "13px",
                  width: "125px",
                  height: "41.5px",
                }}
              >
                <img
                  src='https://tools.applemediaservices.com/api/badges/download-on-the-app-store/black/en-us?size=250x83&releaseDate=1719446400'
                  alt='Download on the App Store'
                  style={{
                    borderRadius: "13px",
                    width: "125px",
                    height: "41.5px",
                  }}
                />
              </a>

              <a
                target='_blank'
                href='https://android.tokeopay.io'
                style={{
                  display: "inline-block",
                  overflow: "hidden",
                  borderRadius: "13px",
                  width: "125px",
                  height: "41.5px",
                }}
              >
                <img
                  src='/googleplay.png'
                  alt='Download on the Play Store'
                  style={{
                    borderRadius: "13px",
                    width: "125px",
                    height: "41.5px",
                  }}
                />
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
