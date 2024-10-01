import { base64 } from '@scure/base';

interface ApiResponse<T> {
    result: T;
    error?: {
        message: string;
    };
}

interface NetworkInfo {
    networkId: number;
    subnetId: string;
    chainId: string;
}

export interface TxAPIResponse {
    timestamp: number;
    success: boolean;
    units: string;
    fee: number;
    result: any[];
}

export interface BlockAPIResponse {
    block: {
        block: {
            timestamp: number;
            height: number;
            parentID: string;
            txs: any[];//FIXME:
        };
        results: any[];//FIXME:
        unitPrices: string
    };

    blockBytes: string;
}

export class HyperSDKHTTPClient {
    private getNetworkCache: NetworkInfo | null = null;

    constructor(
        private readonly apiHost: string,
        private readonly vmName: string,
        private readonly vmRPCPrefix: string
    ) {
        if (this.vmRPCPrefix.startsWith('/')) {
            this.vmRPCPrefix = vmRPCPrefix.substring(1);
        }
    }

    public async makeCoreAPIRequest<T>(method: string, params: object = {}): Promise<T> {
        return this.makeApiRequest("coreapi", `hypersdk.${method}`, params);
    }

    public async makeVmAPIRequest<T>(method: string, params: object = {}): Promise<T> {
        return this.makeApiRequest(this.vmRPCPrefix, `${this.vmName}.${method}`, params);
    }

    public async makeIndexerRequest<T>(method: string, params: object = {}): Promise<T> {
        return this.makeApiRequest("indexer", `indexer.${method}`, params);
    }

    private async makeApiRequest<T>(namespace: string, method: string, params: object = {}): Promise<T> {
        const controller = new AbortController();
        const TIMEOUT_SEC = 10
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_SEC * 1000);

        try {
            const response = await fetch(`${this.apiHost}/ext/bc/${this.vmName}/${namespace}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    method,
                    params,
                    id: parseInt(String(Math.random()).slice(2))
                }),
                signal: controller.signal
            });

            const json: ApiResponse<T> = await response.json();
            if (json?.error?.message) {
                throw new Error(json.error.message);
            }
            return json.result;
        } catch (error: unknown) {
            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error(`Request timed out after ${TIMEOUT_SEC} seconds`);
            }
            throw error;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    public async getNetwork(): Promise<NetworkInfo> {
        if (!this.getNetworkCache) {
            this.getNetworkCache = await this.makeCoreAPIRequest<NetworkInfo>('network');
        }
        return this.getNetworkCache;
    }

    public async sendRawTx(txBytes: Uint8Array): Promise<{ txId: string }> {
        const bytesBase64 = base64.encode(txBytes);
        return this.makeCoreAPIRequest<{ txId: string }>('submitTx', { tx: bytesBase64 });
    }

    public async simulateAction(action: Uint8Array, actor: string): Promise<string> {
        const { output, error } = await this.makeCoreAPIRequest<{ output?: string, error?: string }>('execute', {
            action: base64.encode(action),
            actor: actor,
        });

        if (error) {
            throw new Error(error);
        } else if (output) {
            return output;
        } else {
            throw new Error("No output or error returned from execute");
        }
    }

    public async getTransaction(txId: string): Promise<TxAPIResponse> {
        return this.makeIndexerRequest<TxAPIResponse>('getTx', { txId });
    }

    public async getBlock(blockID: string): Promise<BlockAPIResponse> {
        return this.makeIndexerRequest<BlockAPIResponse>('getBlock', { blockID });
    }

    public async getBlockByHeight(height: number): Promise<BlockAPIResponse> {
        return this.makeIndexerRequest<BlockAPIResponse>('getBlockByHeight', { height });
    }

    public async getLatestBlock(): Promise<BlockAPIResponse> {
        return this.makeIndexerRequest<BlockAPIResponse>('getLatestBlock', {});
    }

    public listenToBlocks(callback: (block: BlockAPIResponse) => void, includeEmpty: boolean = false, expectedBlockTimeMs: number = 1000): void {
        let currentHeight: number = -1;

        const fetchNextBlock = async () => {
            try {
                const block = currentHeight === -1 ?
                    await this.getLatestBlock()
                    : await this.getBlockByHeight(currentHeight + 1);

                currentHeight = block.block.block.height

                if (includeEmpty || block.block.block.txs.length > 0) {
                    callback(block);
                }

                fetchNextBlock();
            } catch (error: any) {
                if (error?.message?.includes("block not found")) {
                    setTimeout(fetchNextBlock, expectedBlockTimeMs);
                } else {
                    console.error(error);
                }
            }
        };

        fetchNextBlock();
    }
}
