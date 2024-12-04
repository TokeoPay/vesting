
use aiken/cbor
use aiken/collection/list
use aiken/crypto.{VerificationKeyHash}
use cardano/transaction.{
  OutputReference, Transaction, InlineDatum, Input
  }
use aiken/interval
use cardano/script_context.{ScriptContext}

use cardano/address.{from_verification_key}
use cardano/assets.{from_asset}
use tx_util/builder.{
  add_asset_to_tx_output, add_signatory, add_tx_input,
  build_txn_context, new_tx_output,
}

pub type VestingDatum {
  slot: Int,
  beneficiary: VerificationKeyHash
}

validator simple_vesting() {
  spend(
    optional_datum: Option<VestingDatum>,
    _redeemer: Data,
    _own_ref: OutputReference,
    self: Transaction,
  ) {
    expect Some(datum) = optional_datum
    let Transaction { extra_signatories, validity_range, .. } = self

    trace @"Signed by beneficiary": list.has(extra_signatories, datum.beneficiary)
    trace @"Vesting Period Passed": interval.is_entirely_after(validity_range, datum.slot)

    list.has(extra_signatories, datum.beneficiary) &&
    interval.is_entirely_after(validity_range, datum.slot)
  }

  else(_ctx: ScriptContext) {
    fail @"unsupported purpose"
  }
}


fn run_test(vest_until_slot: Int, current_slot: Int, expected_benefactor: VerificationKeyHash, actual_benefactor: VerificationKeyHash) {
  let toke_asset =
    from_asset(#"00", "TOKE", 3_000_000)
  
  let datum = VestingDatum { slot: vest_until_slot, beneficiary: expected_benefactor }

  trace @"Datum": cbor.serialise(datum)
  trace @"vest_until_slot": vest_until_slot
  trace @"expected_benefactor": expected_benefactor

  let vested_utxo = new_tx_output(
    from_verification_key(#"0009"),
    1_500_000,
    InlineDatum(
      datum
    )
  )|> add_asset_to_tx_output(toke_asset)

  let a_utxo = OutputReference { transaction_id: "", output_index: 0 }
  
  let vesting_transaction_output = Input { output_reference: a_utxo, output: vested_utxo }

  let txn = interval.entirely_after(current_slot)
    |> build_txn_context()
    |> add_tx_input(vesting_transaction_output) 
    |> add_signatory(actual_benefactor)
  
  simple_vesting.spend(
    Some(datum),
    #"",
    a_utxo,
    txn.transaction
  )
}

const test_benefactor =  #"d006eb7783e8c93160b2bab287bc8a6f069e9e690cd82bc0b52a8c31"

test test_good_benefactor_diff_intervals_1() {
  run_test(100, 100, test_benefactor, test_benefactor)  
}
test test_good_benefactor_diff_intervals_2() {
  run_test(100, 105, test_benefactor, test_benefactor)  
}
test test_good_benefactor_diff_intervals_3() fail {
  run_test(100, 99, test_benefactor, test_benefactor)
}
test test_good_benefactor_diff_intervals_4() fail {
  run_test(100, 0, test_benefactor, test_benefactor)  
}
test test_good_benefactor_diff_intervals_5() {
  run_test(100, 999999999999999999999, test_benefactor, test_benefactor)  
}
test test_good_benefactor_diff_intervals_6() fail {
  run_test(999999999999999999999, 100, test_benefactor, test_benefactor)  
}
test test_diff_benefactor_good_interval() fail {
  run_test(100, 110, test_benefactor, #"d006eb7783e8c93160b2bab287bc8a6f069e9e690cd82bc0b52a8c30")
}
test test_diff_benefactor_bad_interval() fail {
  run_test(100, 99, test_benefactor, #"d006eb7783e8c93160b2bab287bc8a6f069e9e690cd82bc0b52a8c30")
}