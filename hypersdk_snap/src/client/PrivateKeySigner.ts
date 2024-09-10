import { TransactionPayload } from "src/snap";
import { SignerIface } from "./types";
import { ed25519 } from "@noble/curves/ed25519";
import { Marshaler, VMABI } from "../snap/Marshaler";

export class PrivateKeySigner implements SignerIface {
    constructor(private privateKey: Uint8Array) {
        if (this.privateKey.length !== 32) {
            throw new Error("Private key must be 32 bytes");
        }
    }

    async signTx(txPayload: TransactionPayload, abi: VMABI): Promise<Uint8Array> {
        const marshaler = new Marshaler(abi);
        const digest = marshaler.encodeTransaction(txPayload);
        const signedTxBytes = signTransactionBytes(digest, this.privateKey);
        return signedTxBytes;
    }

    getPublicKey(): Uint8Array {
        return ed25519.getPublicKey(this.privateKey);
    }

    async connect(): Promise<void> {
        // No-op
    }
}
function signTransactionBytes(digest: Uint8Array, privateKey: Uint8Array): Uint8Array {
    throw new Error("Function not implemented.");
}

