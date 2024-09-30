import { SignerIface } from './types';
import { EphemeralSigner } from './EphemeralSigner';
import { PrivateKeySigner } from '../lib/PrivateKeySigner';
import { DEFAULT_SNAP_ID, MetamaskSnapSigner } from './MetamaskSnapSigner';
import { idStringToBigInt } from '../snap/cb58'
import { ActionData, TransactionPayload } from '../snap';
import { addressHexFromPubKey, Marshaler, VMABI } from '../lib/Marshaler';
import { HyperSDKHTTPClient, TxStatus } from './HyperSDKHTTPClient';
import { base64 } from '@scure/base';
import { hexToBytes } from '@noble/hashes/utils';

// TODO: Implement fee prediction
const DEFAULT_MAX_FEE = 10000000n;

type SignerType =
    | { type: "ephemeral" }
    | { type: "private-key", privateKey: Uint8Array }
    | { type: "metamask-snap", snapId?: string };

export class HyperSDKClient extends EventTarget {
    private readonly http: HyperSDKHTTPClient;
    private signer: SignerIface | null = null;
    private abi: VMABI | null = null;
    private marshaler: Marshaler | null = null;

    constructor(
        private readonly apiHost: string,
        private readonly vmName: string,
        private readonly vmRPCPrefix: string,
        private readonly decimals: number = 9
    ) {
        super();
        this.http = new HyperSDKHTTPClient(apiHost, vmName, vmRPCPrefix);
    }

    // Public methods

    public async connectWallet(params: SignerType): Promise<SignerIface> {
        this.signer = this.createSigner(params);
        await this.signer.connect();
        this.dispatchEvent(new CustomEvent('signerConnected', { detail: this.signer }));
        return this.signer;
    }

    public async sendTransaction(actions: ActionData[]): Promise<TxStatus> {
        const txPayload = await this.createTransactionPayload(actions);
        const abi = await this.getAbi();
        const signed = await this.getSigner().signTx(txPayload, abi);
        const { txId } = await this.http.sendRawTx(signed);
        return this.waitForTransaction(txId);
    }

    //actorHex is optional, if not provided, the signer's public key will be used
    public async simulateAction(action: ActionData, actorHex?: string) {
        const marshaler = await this.getMarshaler();
        const actionBytes = marshaler.encodeTyped(action.actionName, JSON.stringify(action.data));

        const actor = actorHex ?? addressHexFromPubKey(this.getSigner().getPublicKey());

        const output = await this.http.simulateAction(
            actionBytes,
            actor
        );

        return marshaler.parseTyped(base64.decode(output), "output")[0];
    }

    public async getBalance(address: string): Promise<bigint> {
        const result = await this.http.makeVmAPIRequest<{ amount: number }>('balance', { address });
        return BigInt(result.amount); // TODO: Handle potential precision loss
    }

    public convertToNativeTokens(formattedBalance: string): bigint {
        const float = parseFloat(formattedBalance);
        return BigInt(float * 10 ** this.decimals);
    }

    public formatNativeTokens(balance: bigint): string {
        const divisor = 10n ** BigInt(this.decimals);
        const quotient = balance / divisor;
        const remainder = balance % divisor;
        const paddedRemainder = remainder.toString().padStart(this.decimals, '0');
        return `${quotient}.${paddedRemainder}`;
    }

    public async getAbi(): Promise<VMABI> {
        if (!this.abi) {
            const result = await this.http.makeCoreAPIRequest<{ abi: VMABI }>('getABI');
            this.abi = result.abi;
        }
        return this.abi;
    }

    public async getTransaction(txId: string): Promise<TxStatus> {
        const txStatus = await this.http.getTransaction(txId);
        if (txStatus.result.length > 0) {
            const marshaler = await this.getMarshaler();
            txStatus.result = txStatus.result.map((result: string) => marshaler.parseTyped(hexToBytes(result), "output")[0]);
        }
        return txStatus;
    }

    // Private methods

    private createSigner(params: SignerType): SignerIface {
        switch (params.type) {
            case "ephemeral":
                return new EphemeralSigner();
            case "private-key":
                return new PrivateKeySigner(params.privateKey);
            case "metamask-snap":
                return new MetamaskSnapSigner(params.snapId ?? DEFAULT_SNAP_ID);
            default:
                throw new Error(`Invalid signer type: ${(params as { type: string }).type}`);
        }
    }

    private getSigner(): SignerIface {
        if (!this.signer) {
            throw new Error("Signer not connected");
        }
        return this.signer;
    }


    private async getMarshaler(): Promise<Marshaler> {
        if (!this.marshaler) {
            const abi = await this.getAbi();
            this.marshaler = new Marshaler(abi);
        }
        return this.marshaler;
    }

    private async createTransactionPayload(actions: ActionData[]): Promise<TransactionPayload> {
        const { chainId } = await this.http.getNetwork();
        const chainIdBigNumber = idStringToBigInt(chainId);

        return {
            timestamp: String(BigInt(Date.now()) + 59n * 1000n),
            chainId: String(chainIdBigNumber),
            maxFee: String(DEFAULT_MAX_FEE),
            actions: actions
        };
    }

    private async waitForTransaction(txId: string, timeout: number = 55000): Promise<TxStatus> {
        const startTime = Date.now();
        let lastError: Error | null = null;
        for (let i = 0; i < 10; i++) {
            if (Date.now() - startTime > timeout) {
                throw new Error("Transaction wait timed out");
            }
            try {
                return await this.getTransaction(txId);
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
            }
            await new Promise(resolve => setTimeout(resolve, 100 * i));
        }
        throw lastError || new Error("Failed to get transaction status");
    }

}
