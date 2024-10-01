import { hexToBytes } from "@noble/hashes/utils";
import { TxAPIResponse } from "./HyperSDKHTTPClient";
import { Marshaler } from "src/lib/Marshaler";
import { ActionOutput } from "./types";

export interface TransactionStatus {
    timestamp: number;
    success: boolean;
    fee: number;
    result: ActionOutput[];
}

export function txAPIResponseToTransactionStatus(response: TxAPIResponse, marshaler: Marshaler): TransactionStatus {
    return {
        timestamp: response.timestamp,
        success: response.success,
        fee: response.fee,
        result: response.result.map((result: string) => marshaler.parseTyped(hexToBytes(result), "output")[0]),
    }
}
