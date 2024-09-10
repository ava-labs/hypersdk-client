
import { TransactionPayload } from "src/snap"
import { VMABI } from "../snap/Marshaler"

export interface SignerIface {
    signTx(txPayload: TransactionPayload, abi: VMABI): Promise<Uint8Array>
    getPublicKey(): Uint8Array
    connect(): Promise<void>
}
