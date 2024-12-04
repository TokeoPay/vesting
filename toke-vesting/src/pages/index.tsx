import localFont from "next/font/local";
import { Available } from "../components/Available";
import { Header } from "@/components/Header";
import { Toaster } from "react-hot-toast";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export default function Home() {
  return (
    <div className="bg-gray-50 w-full justify-center flex">
      <Toaster />
      <div
        className={`${geistSans.variable} ${geistMono.variable}  grid grid-rows-[20px_1fr_20px]  min-h-screen pb-20 gap-16 font-[family-name:var(--font-geist-sans)] w-full `}
      >
        <Header />
        <main className="flex flex-col gap-8 row-start-2 items-center sm:items-start pt-4 px-5 sm:px-10 container mx-auto ">
          <Available />
        </main>
        <footer className="row-start-3 flex gap-6 flex-wrap items-center justify-center"></footer>
      </div>
    </div>
  );
}
