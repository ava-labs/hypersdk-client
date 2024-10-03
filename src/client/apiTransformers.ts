import { hexToBytes } from "@noble/hashes/utils";
import { addressHexFromPubKey, Marshaler } from "../lib/Marshaler";
import { ActionOutput } from "./types";
import { base64 } from "@scure/base";
import { ActionData, TransactionBase, Units } from "../lib/types";


export interface TxAPIResponse {
    timestamp: number;
    success: boolean;
    units: string;
    fee: number;
    outputs: any[];
}


export interface TransactionStatus {
    blockTimestamp: number;
    success: boolean;
    fee: number;
    outputs: ActionOutput[];
    error: string;
}

export function txAPIResponseToTransactionStatus(response: TxAPIResponse, marshaler: Marshaler): TransactionStatus {
    const error = response.success ? "" : "No error message - field Error is not implemented yet in GetTxResponse struct of api/indexer/server.go file";
    return {
        blockTimestamp: response.timestamp,
        success: response.success,
        fee: response.fee,
        outputs: response.outputs.map((result: string) => marshaler.parseTyped(hexToBytes(result), "output")[0]),
        error: error
    }
}


export interface BlockAPIResponse {
    block: {
        block: {
            parent: string;
            timestamp: number;
            height: number;
            txs: Array<{
                base: {
                    timestamp: number;
                    chainId: string;
                    maxFee: number;
                };
                actions: ActionData[];
                auth: {
                    signer: number[];
                    signature: number[];
                };
            }>;
            stateRoot: string;
        };
        results: Array<{
            success: boolean;
            error: string;
            outputs: string[];
            units: string;
            fee: number;
        }>;
        unitPrices: Units;
    };
    blockBytes: string;
}

export interface ExecutedBlock {
    height: number;
    parent: string;
    stateRoot: string;
    timestamp: number;
    transactions: {
        // id: string,
        base: TransactionBase,
        actions: any[],
        response: TxAPIResponse,
        sender: string,
    }[];
    units: Units
}

export function blockAPIResponseToExecutedBlock(response: BlockAPIResponse, marshaler: Marshaler): ExecutedBlock {

    if (response.block.results.length !== response.block.block.txs.length) {
        throw new Error("results and txs have different lengths");
    }

    const transactions: {
        base: TransactionBase,
        actions: ActionData[],
        response: TxAPIResponse,
        sender: string,
        // id: string,
    }[] = [];

    for (let i = 0; i < response.block.block.txs.length; i++) {
        transactions.push({
            base: {
                timestamp: String(response.block.block.txs[i]!.base.timestamp),
                chainId: response.block.block.txs[i]!.base.chainId,
                maxFee: String(response.block.block.txs[i]!.base.maxFee)
            },
            actions: response.block.block.txs[i]!.actions,
            response: {
                timestamp: response.block.block.txs[i]!.base.timestamp,
                success: response.block.results[i]!.success,
                units: response.block.results[i]!.units,
                fee: response.block.results[i]!.fee,
                outputs: response.block.results[i]!.outputs.map((output) => marshaler.parseTyped(base64.decode(output), "output")[0]),
            },
            sender: addressHexFromPubKey(Uint8Array.from(response.block.block.txs[i]!.auth.signer))
        })
    }

    return {
        height: response.block.block.height,
        parent: response.block.block.parent,
        stateRoot: response.block.block.stateRoot,
        timestamp: response.block.block.timestamp,
        transactions: transactions,
        units: response.block.unitPrices,
    }
}
