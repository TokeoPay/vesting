import { Data } from "@lucid-evolution/lucid";

export const TOKE =
  "9a5046383eac69a68377823db320d4d7739a9915262a75dadd0ca601544f4b45";

export const TokeDatumSchema = Data.Object({
  slot: Data.Integer(),
  beneficiary: Data.Bytes(),
});
export type TokeDatum = Data.Static<typeof TokeDatumSchema>;
export const TokeDatum = TokeDatumSchema as unknown as TokeDatum;
