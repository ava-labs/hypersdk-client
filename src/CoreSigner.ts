import { base58 } from '@scure/base';
import { SignerIface } from './types';
import { VMABI } from './Marshaler';
import { TransactionPayload } from './types';
import { hexToBytes } from '@noble/hashes/utils';

type RequestParams = {
    method: string;
    params?: Record<string, any>;
};

enum EventNames {
    CORE_WALLET_ANNOUNCE_PROVIDER = 'core-wallet:announceProvider',
    CORE_WALLET_REQUEST_PROVIDER = 'core-wallet:requestProvider'
}

let coreChainAgnosticProvider: any | null = null;
async function getProvider(): Promise<any | null> {

    if(coreChainAgnosticProvider) {
        return Promise.resolve(coreChainAgnosticProvider);
    }

    return new Promise((resolve) => {
        if (!coreChainAgnosticProvider) {
            window.addEventListener(EventNames.CORE_WALLET_ANNOUNCE_PROVIDER, (event) => {
                coreChainAgnosticProvider = (<CustomEvent>event).detail.provider;
                resolve(coreChainAgnosticProvider)
            });
            window.dispatchEvent(new Event(EventNames.CORE_WALLET_REQUEST_PROVIDER));
        }
    })
    
}

export class CoreSigner implements SignerIface {
    #cachedPublicKey: Uint8Array | null = null;
    #chainIdLength = 32;
    #name: string;
    #rpcUrl: string;
    #chainId: bigint;
    #caipId: string;
    #vmRpcPrefix: string;

    constructor({ params, chainId }: { params: { name: string; rpcUrl: string; vmRpcPrefix: string }; chainId: bigint }) {
        this.#name = params.name;
        this.#rpcUrl = params.rpcUrl;
        this.#chainId = chainId;
        this.#vmRpcPrefix = params.vmRpcPrefix;
        this.#caipId = `hvm:${this.#chainId.toString().slice(0, this.#chainIdLength)}`;
    }

    getPublicKey(): Uint8Array {
        if (!this.#cachedPublicKey) {
            throw new Error('Public key missing. Please call connect() first.');
        }
        return this.#cachedPublicKey;
    }

    async getBalance() {
        await this.#request({
            method: 'hvm_getBalance',
            params: {},
        });
    }

    async signTx(txPayload: TransactionPayload, abi: VMABI): Promise<Uint8Array> {
        const sig58 = (await this.#request({
            method: 'hvm_signTransaction',
            params: [{
                abi: abi,
                tx: txPayload,
            }],
        })) as string | undefined;
        if (!sig58) {
            throw new Error('Failed to sign transaction');
        }
        return base58.decode(sig58);
    }

    async connect() {
        const hvmNetwork = {
            chainName: this.#name,
            caipId: this.#caipId,
            rpcUrl: this.#rpcUrl,
            networkToken: {
                symbol: 'COIN',
                decimals: 9,
                description: '',
                name: 'Coin',
                logoUri: '',
            },
            logoUri: '',
            vmName: 'HVM',
            vmRpcPrefix: this.#vmRpcPrefix,
        };
        
        await this.#request({
            method: 'wallet_addNetwork',
            params: hvmNetwork,
        });

        const pubKeys = await this.#request({
            method: 'wallet_getPublicKey',
            params: {},
        });
        const pubKey = pubKeys.ed25519;

        if(!pubKey) {
            throw new Error('ed25519 is not supported on the active account')
        }

        this.#cachedPublicKey = hexToBytes(pubKey);
    }

    async #request({ method, params }: RequestParams) {
        const provider = await getProvider();
        if (!provider) {
            throw new Error('Core provider not found!');
        }
        if (!params) {
            throw new Error('Request params are missing');
        }
        return provider.request({
            data: { method, params: [params], id: '1' },
            scope: this.#caipId,
        });
    }
}
