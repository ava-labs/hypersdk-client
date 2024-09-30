import { SignerIface } from './types';
import { EphemeralSigner } from './EphemeralSigner';
import { PrivateKeySigner } from '../lib/PrivateKeySigner';
import { DEFAULT_SNAP_ID, MetamaskSnapSigner } from './MetamaskSnapSigner';
import { idStringToBigInt } from '../snap/cb58'
import { ActionData, TransactionPayload } from '../snap';
import { addressHexFromPubKey, Marshaler, VMABI } from '../lib/Marshaler';
import { HyperSDKHTTPClient } from './HyperSDKHTTPClient';
import { HyperSDKWSClient } from './HyperSDKWSClient';
import { base64 } from '@scure/base';
import { TxMessage } from 'src/lib/WsMarshaler';

//FIXME: we don't have a fee prediction yet, so we just use a huge number
const MAX_TX_FEE_TEMP = 10000000n

type signerParams = {
    type: "ephemeral"
} | {
    type: "private-key",
    privateKey: Uint8Array
} | {
    type: "metamask-snap",
    snapId?: string,
}

export class HyperSDKClient extends EventTarget {
    private readonly http: HyperSDKHTTPClient;
    private ws: HyperSDKWSClient | null = null;
    private signer: SignerIface | null = null;

    constructor(
        protected readonly apiHost: string,//for example: http://localhost:9650
        protected readonly vmName: string,//for example: hypervm
        protected readonly vmRPCPrefix: string,//for example: hyperapi
        protected readonly decimals: number = 9,
    ) {
        super();
        this.http = new HyperSDKHTTPClient(apiHost, vmName, vmRPCPrefix);
    }

    private async getWSClient(): Promise<HyperSDKWSClient> {
        const marshaler = await this.getMarshaler();
        if (!this.ws) {
            this.ws = new HyperSDKWSClient(this.apiHost, this.vmName, marshaler);
        }
        return this.ws;
    }

    public async generatePayload(actions: ActionData[]): Promise<TransactionPayload> {
        const chainIdStr = (await this.http.getNetwork()).chainId
        const chainIdBigNumber = idStringToBigInt(chainIdStr)

        return {
            timestamp: String(BigInt(Date.now()) + 59n * 1000n),
            chainId: String(chainIdBigNumber),
            maxFee: String(MAX_TX_FEE_TEMP),
            actions: actions
        }
    }

    public async sendTx(actions: ActionData[]): Promise<TxMessage> {
        const txPayload = await this.generatePayload(actions);
        const abi = await this.getAbi();
        const signer = this.getSigner();
        const signed = await signer.signTx(txPayload, abi);
        return (await this.getWSClient()).registerTx(signed);
    }

    public async connectWallet(params: signerParams): Promise<SignerIface> {
        if (params.type === "ephemeral") {
            this.signer = new EphemeralSigner();
        } else if (params.type === "private-key") {
            this.signer = new PrivateKeySigner(params.privateKey);
        } else if (params.type === "metamask-snap") {
            this.signer = new MetamaskSnapSigner(params.snapId ?? DEFAULT_SNAP_ID);
        } else {
            throw new Error(`Invalid signer type: ${(params as { type: string }).type}`);
        }

        await this.signer.connect();
        this.dispatchEvent(new CustomEvent('signerConnected', { detail: this.signer }));
        return this.signer;
    }

    public getSigner(): SignerIface {
        if (!this.signer) {
            throw new Error("Signer not connected");
        }
        return this.signer;
    }

    public fromFormattedBalance = (balance: string): bigint => {
        const float = parseFloat(balance)
        return BigInt(float * 10 ** this.decimals)
    }

    public formatBalance = (balance: bigint): string => {
        const divisor = 10n ** BigInt(this.decimals);
        const quotient = balance / divisor;
        const remainder = balance % divisor;
        const paddedRemainder = remainder.toString().padStart(this.decimals, '0');
        return `${quotient}.${paddedRemainder}`;
    }

    public async executeReadonlyAction(action: ActionData) {
        const marshaler = await this.getMarshaler();
        const actionBytes = marshaler.encodeTyped(action.actionName, JSON.stringify(action.data))
        const output = await this.http.executeReadonlyAction(
            actionBytes,
            addressHexFromPubKey(this.getSigner().getPublicKey())
        );

        try {
            const [parsed, _] = marshaler.parseTyped(base64.decode(output), "output")
            return parsed
        } catch (error) {
            throw new Error(`While unmarshaling response: ${error}`)
        }
    }

    private marshaler: Marshaler | null = null;
    private async getMarshaler() {
        if (!this.marshaler) {
            const abi = await this.getAbi();
            this.marshaler = new Marshaler(abi);
        }
        return this.marshaler;
    }

    public async getBalance(address: string): Promise<bigint> {
        const result = await this.http.makeVmAPIRequest<{ amount: number }>('balance', { address });
        return BigInt(result.amount)//FIXME: might be some loss of precision here
    }

    private abi: VMABI | null = null;
    public async getAbi(): Promise<VMABI> {
        if (!this.abi) {
            const result = await this.http.makeCoreAPIRequest<{ abi: VMABI }>('getABI');
            this.abi = result.abi;
        }
        return this.abi;
    }
}
