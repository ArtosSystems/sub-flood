import {Keyring} from "@polkadot/keyring";
import {ApiPromise, WsProvider} from "@polkadot/api";
import {KeyringPair} from "@polkadot/keyring/types";
import { SignedBlock, BlockHash, BlockAttestations } from "@polkadot/types/interfaces";

import * as aux from "./aux";
import * as avn from "./avn_helper";
import * as cli from "./cli";

async function run() {
    let options = cli.execution_options();

    let TOTAL_TRANSACTIONS = options.number_of_tx || 25000;
    let TPS = options.target_tps || 1000;
    let TOTAL_BATCHES = TOTAL_TRANSACTIONS/TPS;

    let TOTAL_THREADS = 1;
    let TRANSACTION_PER_BATCH = TPS / TOTAL_THREADS;

    let TOTAL_USERS = TPS;
    let USERS_PER_THREAD = TOTAL_USERS / TOTAL_THREADS;
    let TOKENS_TO_SEND = 1;


    if (!Number.isInteger(USERS_PER_THREAD)) {
        console.log(`USERS_PRE_THREAD is not an integer. Please make TPS a multiple of ${TOTAL_THREADS}`);
        process.exit(-1);
    }

    if (!Number.isInteger(TOTAL_BATCHES)) {
        console.log(`TOTAL_BATCHES is not an integer. Please make TOTAL_TRANSACTIONS (${TOTAL_TRANSACTIONS}) a multiple of TPS ${TPS}`);
        process.exit(-1);
    }

    let global_params = {TOTAL_TRANSACTIONS, TOTAL_THREADS, TOTAL_BATCHES, USERS_PER_THREAD, TOKENS_TO_SEND, TRANSACTION_PER_BATCH}

    console.log(`TPS: ${TPS}, TX COUNT: ${TOTAL_TRANSACTIONS}`);

    let [api, keyring, alice_suri] = await avn.setup(avn.EU_WEST_2_URL);
    let [alice, accounts] = await avn.setup_accounts(api, keyring, alice_suri, TOTAL_USERS);

    console.log("Checking for pending transactions in the network...");
    await avn.check_pending_transactions_for_network();

    console.log("Alice token balance - pre endowment: ", (await avn.token_balance(api, alice)) / avn.BASE_TOKEN);
    await aux.endow_users(api, alice, accounts, options.tx_type, TOTAL_BATCHES);
    await aux.pending_transactions_cleared(api, 0);
    console.log(".");
    console.log("Alice token balance - post endowment: ", (await avn.token_balance(api, alice)) / avn.BASE_TOKEN);

    let thread_payloads = await aux.pre_generate_tx(
      api,
      {alice, accounts, tx_type: options.tx_type},
      global_params);

    await aux.pending_transactions_cleared(api, 0);
    console.log("..");

    let initialTime = new Date();

    await aux.send_transactions(thread_payloads, global_params);

    await aux.pending_transactions_cleared(api, 20);

    let finalTime = new Date();

    await aux.report_substrate_diagnostics(api, initialTime, finalTime, options.tx_type);

    console.log("Alice token balance - closing: ", (await avn.token_balance(api, alice)) / avn.BASE_TOKEN);
}

// run();

run().then(function() {
    console.log("Done");
    process.exit(0);
}).catch(function(err) {
    console.log("Error: " + err.toString());
    process.exit(1);
});