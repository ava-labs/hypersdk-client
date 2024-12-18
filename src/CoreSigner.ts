import { base58 } from '@scure/base';
import { SignerIface } from './types';
import { VMABI } from './Marshaler';
import { TransactionPayload } from './types';
import { EventNames, type ChainAgnosticProvider } from '@avalabs/vm-module-types';

type RequestParams = {
    method: string;
    params?: Record<string, any>;
};

let cachedProvider: ChainAgnosticProvider | null = null;
async function getProvider(): Promise<ChainAgnosticProvider | null> {
    if (!cachedProvider) {
        window.addEventListener(EventNames.CORE_WALLET_ANNOUNCE_PROVIDER, (event) => {
            cachedProvider = (<CustomEvent>event).detail.provider;
        });
        window.dispatchEvent(new Event(EventNames.CORE_WALLET_REQUEST_PROVIDER));

        // cachedProvider?.subscribeToMessage(this.#handleBackgroundMessage);
    }
    return cachedProvider;
}

export class CoreSigner implements SignerIface {
    private _cachedPublicKey: Uint8Array | null = null;
    private _chainIdLength = 32;
    private _name: string;
    private _rpcUrl: string;
    private _chainId: bigint;
    private _caipId: string;
    private _vmRpcPrefix: string;

    constructor({ params, chainId }: { params: { name: string; rpcUrl: string; vmRpcPrefix: string }; chainId: bigint }) {
        this._name = params.name;
        this._rpcUrl = params.rpcUrl;
        this._chainId = chainId;
        this._vmRpcPrefix = params.vmRpcPrefix;
        this._caipId = `hvm:${this._chainId.toString().slice(0, this._chainIdLength)}`;
    }

    getPublicKey(): Uint8Array {
        if (!this._cachedPublicKey) {
            throw new Error('Public key not cached. Please call connect() first.');
        }
        return this._cachedPublicKey;
    }

    async signTx(txPayload: TransactionPayload, abi: VMABI): Promise<Uint8Array> {
        // TODO separated rpc method in hvm module
        const sig58 = (await this._request({
            method: 'hvm_signTransaction',
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
        // const provider = await getProvider();

        // TODO separated rpc method in hvm module
        // const pubKey = await this._request({
        //     method: 'getPublicKey',
        //     params: {}
        // }) as string | undefined;

        // if (!pubKey) {
        //     throw new Error("Failed to get public key");
        // }

        this._cachedPublicKey = base58.decode('123245');
        
        const hvmNetwork = {
            chainName: this._name,
            caipId: this._caipId,
            rpcUrl: this._rpcUrl,
            networkToken: {
                symbol: 'COIN',
                decimals: 9,
                description: '',
                name: 'Coin',
                logoUri: '',
            },
            logoUri: '',
            vmName: 'HVM',
            vmRpcPrefix: this._vmRpcPrefix,
        };
        const isNetworkAdded = await this._request({
            method: 'wallet_addNetwork',
            params: hvmNetwork,
        });
        console.log('isNetworkAdded: ', isNetworkAdded);

        // const pubKey = await this._request({
        //     method: 'hvm_getPublicKey',
        //     params: {}
        // })

        // this._cachedPublicKey = base58.decode(pubKey);
        // console.log('pubkey: ', pubKey);
    }

    private async _request({ method, params }: RequestParams) {
        console.log('params: ', params);
        const provider = await getProvider();
        if (!provider) {
            throw new Error('There is no Core provider!');
        }
        if (!params) {
            throw new Error('The params are needed!');
        }
        // const chainId = params.chainId || params.tx.base.chainId;
        // const chainId = '12345';
        console.log('provider3: ', provider);
        console.log('_request method: ', method);
        console.log('request params: ', params);
        // console.log('chainId: ', chainId);
        // console.log('chainId length: ', chainId.length);
        // console.log('newChainId length: ', newChainId.length);
        // console.log('chainId cropped: ', newChainId);
        return provider.request({
            data: { method, params: [params], id: '1' },
            // sessionId: '',
            scope: this._caipId,
        });
    }
}
