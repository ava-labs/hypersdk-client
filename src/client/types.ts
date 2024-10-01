
import { TransactionPayload } from "../snap"
import { VMABI } from "../lib/Marshaler"

export interface SignerIface {
    signTx(txPayload: TransactionPayload, abi: VMABI): Promise<Uint8Array>
    getPublicKey(): Uint8Array
    connect(): Promise<void>
}


export type ActionOutput = any;
