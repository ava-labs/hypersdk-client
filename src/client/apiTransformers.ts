import { hexToBytes } from "@noble/hashes/utils";
import { addressHexFromPubKey, Marshaler } from "../lib/Marshaler";
import { ActionOutput } from "./types";
import { base64 } from "@scure/base";
import { ActionData, TransactionBase, Units } from "../lib/types";



export interface TransactionStatus {
    timestamp: number;
    success: boolean;
    units: string;
    fee: number;
    outputs: any[];
}


export function processTxAPIResponse(response: TransactionStatus, marshaler: Marshaler): TransactionStatus {
    return {
        ...response,
        outputs: response.outputs.map((output: string) => marshaler.parseTyped(base64.decode(output), "output")[0]),
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
        results: TransactionStatus[];
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
        base: TransactionBase,
        actions: any[],
        response: TransactionStatus,
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
        response: TransactionStatus,
        sender: string,
    }[] = [];

    for (let i = 0; i < response.block.block.txs.length; i++) {
        transactions.push({
            base: {
                timestamp: String(response.block.block.txs[i]!.base.timestamp),
                chainId: response.block.block.txs[i]!.base.chainId,
                maxFee: String(response.block.block.txs[i]!.base.maxFee)
            },
            actions: response.block.block.txs[i]!.actions,
            response: processTxAPIResponse(response.block.results[i]!, marshaler),
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
