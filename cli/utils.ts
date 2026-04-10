import { Data } from "@lucid-evolution/lucid";

export function getDateToCurrentSlot(currentSlot: number) {
  const currentDate = Math.floor(Date.now() / 1000);
  return (forDate: number) => {
    return Math.floor(currentSlot + (forDate - currentDate));
  };
}

export const TokeDatumSchema = Data.Object({
  slot: Data.Integer(),
  beneficiary: Data.Bytes(),
});
export type TokeDatum = Data.Static<typeof TokeDatumSchema>;
export const TokeDatum = TokeDatumSchema as unknown as TokeDatum;
