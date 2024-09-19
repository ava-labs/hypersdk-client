import { TransactionPayload } from "../snap";
import { SignerIface } from "../client/types";
import { ed25519 } from "@noble/curves/ed25519";
import { Marshaler, VMABI } from "./Marshaler";
import { ED25519_AUTH_ID } from "../snap/const";

export class PrivateKeySigner implements SignerIface {
    constructor(private privateKey: Uint8Array) {
        if (this.privateKey.length !== 32) {
            throw new Error("Private key must be 32 bytes");
        }
    }

    async signTx(txPayload: TransactionPayload, abi: VMABI): Promise<Uint8Array> {
        const marshaler = new Marshaler(abi);
        const digest = marshaler.encodeTransaction(txPayload);
        const signature = ed25519.sign(digest, this.privateKey);

        const pubKey = ed25519.getPublicKey(this.privateKey);

        return new Uint8Array([...digest, ED25519_AUTH_ID, ...pubKey, ...signature])
    }

    getPublicKey(): Uint8Array {
        return ed25519.getPublicKey(this.privateKey);
    }

    async connect(): Promise<void> {
        // No-op
    }
}
