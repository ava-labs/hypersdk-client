import { base64 } from '@scure/base';


interface ApiResponse<T> {
    result: T;
    error?: {
        message: string;
    };
}

export class HyperSDKHTTPClient {
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

    private getNetworkCache: { networkId: number, subnetId: string, chainId: string } | null = null;
    public async getNetwork(): Promise<{ networkId: number, subnetId: string, chainId: string }> {
        if (!this.getNetworkCache) {
            this.getNetworkCache = await this.makeCoreAPIRequest<{ networkId: number, subnetId: string, chainId: string }>('network');
        }
        return this.getNetworkCache;
    }

    public async sendRawTx(txBytes: Uint8Array): Promise<void> {
        const bytesBase64 = base64.encode(txBytes);
        return this.makeCoreAPIRequest<void>('submitTx', { tx: bytesBase64 });
    }

    public async executeReadonlyAction(action: Uint8Array, actor: string): Promise<string> {
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
}