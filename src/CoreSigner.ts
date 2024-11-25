import { base58 } from '@scure/base';
import { SignerIface } from './types';
import { VMABI } from './Marshaler';
import { TransactionPayload } from './types';
import { EventNames, type ChainAgnosticProvider } from '@avalabs/vm-module-types';

export const DEFAULT_SNAP_ID = `npm:hypersdk-snap`;

type InvokeSnapParams = {
    method: string;
    params?: Record<string, unknown>;
};

let cachedProvider: ChainAgnosticProvider | null = null;
async function getProvider(): Promise<ChainAgnosticProvider | null> {
    if (!cachedProvider) {
        window.addEventListener(EventNames.CORE_WALLET_ANNOUNCE_PROVIDER, (event) => {
            cachedProvider = (<CustomEvent>event).detail.provider;
            console.log('cachedProvider: ', cachedProvider);
            
            // cachedProvider?.subscribeToMessage(this.#handleBackgroundMessage);
        });
    }
    // if (!cachedProvider) {
    //     throw Error('There is no chainagnostic provider');
    // }
    return cachedProvider;
}

export class CoreSigner implements SignerIface {
    private cachedPublicKey: Uint8Array | null = null;

    constructor() {}

    getPublicKey(): Uint8Array {
        if (!this.cachedPublicKey) {
            throw new Error('Public key not cached. Please call connect() first.');
        }
        return this.cachedPublicKey;
    }

    async signTx(txPayload: TransactionPayload, abi: VMABI): Promise<Uint8Array> {
        // TODO separated rpc method in hvm module
        const sig58 = (await this.#request({
            method: 'signTransaction',
            params: {
                abi: abi,
                tx: txPayload,
            },
        })) as string | undefined;
        if (!sig58) {
            throw new Error('Failed to sign transaction');
        }
        return base58.decode(sig58);
    }

    async connect() {
        const provider = await getProvider();
        console.log('provider: ', provider);

        // const providerVersion = (await provider?.request({ method: "web3_clientVersion" })) as string || "";
        // console.log('providerVersion: ', providerVersion);
        // if (!providerVersion.includes("flask")) {
        //     throw new Error("Your client is not compatible with development snaps. Please install MetaMask Flask!");
        // }

        // TODO separated rpc method in hvm module
        // const pubKey = await this._request({
        //     method: 'getPublicKey',
        //     params: {}
        // }) as string | undefined;

        // if (!pubKey) {
        //     throw new Error("Failed to get public key");
        // }

        // this.cachedPublicKey = base58.decode(pubKey);
        this.cachedPublicKey = base58.decode('123245');
        console.log('this.cachedPublicKey: ', this.cachedPublicKey);
    }

    // private async _request({ method, params }: InvokeSnapParams): Promise<unknown> {
    //     JSON.stringify(params); //PRESERVE THIS! if we can't serialize it, Metamask will fail too

    //     const provider = await getProvider();
    //     return await provider.request({
    //         method: 'getPublicKey',
    //         params: {
    //             // snapId: this.snapId,
    //             request: params ? { method, params } : { method },
    //         },
    //     });
    // }

    async #request(params: any) {
        console.log('request params: ', params);

    }
}
