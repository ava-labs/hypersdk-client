import { base64 } from "@scure/base";
import { decodeBatchMessage, encodeBatchMessage } from "../lib/BatchEncoder";
import { unpackTxMessage } from "../lib/WsMarshaler";
import { sha256 } from '@noble/hashes/sha256';

const BLOCK_BYTE_ZERO = 0x00;
const TX_BYTE_ONE = 0x01;

export class HyperSDKWSClient {
    private ws: WebSocket | null = null;
    private batchMessages: Uint8Array[] = [];
    private txMessageResolvers: Map<string, (value: any) => void> = new Map();

    constructor(
        private readonly apiHost: string,
        private readonly vmName: string
    ) {
        this.connectWebSocket(); // Initialize connection immediately
        setInterval(() => {
            this.sendBatchMessages();
        }, 100);
    }

    private async connectWebSocket() {
        const wsProtocol = this.apiHost.startsWith('https') ? 'wss' : 'ws';
        const wsUrl = `${wsProtocol}://${new URL(this.apiHost).host}/ext/bc/${this.vmName}/corews`;
        console.log('Connecting to WebSocket:', wsUrl);

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            console.log('WebSocket connected');
            this.sendBatchMessages(); // Send any queued messages upon connection
        };

        this.ws.onclose = (event) => {
            console.log('WebSocket disconnected', event.reason);
            // Attempt to reconnect after a delay
            setTimeout(() => this.connectWebSocket(), 5000);
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            throw error; // Throw error if there's a connection issue
        };

        this.ws.onmessage = async (event) => {
            try {
                const msgs = decodeBatchMessage(new Uint8Array(await event.data.arrayBuffer()));

                for (const msg of msgs) {
                    const firstByte = msg[0];
                    console.log('firstByte', firstByte)
                    if (firstByte === BLOCK_BYTE_ZERO) {
                        console.log('Received block message, but parsing is not implemented yet')
                    } else if (firstByte === TX_BYTE_ONE) {
                        const unpacked = unpackTxMessage(msg.slice(1));
                        console.log('Received transaction message:', unpacked.txId);
                        const resolver = this.txMessageResolvers.get(unpacked.txId);
                        if (resolver) {
                            resolver(unpacked);
                            this.txMessageResolvers.delete(unpacked.txId);
                        }
                    } else {
                        console.log('Received unknown message type:', firstByte)
                    }
                }
            } catch (error) {
                console.error('Error processing message:', error);
            }
        };
    }

    private async queueMessage(message: Uint8Array, txId: string): Promise<void> {
        this.batchMessages.push(message);
        return new Promise((resolve) => {
            this.txMessageResolvers.set(txId, resolve);
        });
    }

    private sendBatchMessages(): void {
        if (this.batchMessages.length === 0 || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return;
        }
        const batchMessage = encodeBatchMessage(this.batchMessages);
        this.ws.send(batchMessage);
        console.log('Sent a batch of messages', this.batchMessages.length);
        this.batchMessages = [];
    }

    private recentTxIds: string[] = []
    public async registerTx(txBytes: Uint8Array): Promise<any> {
        const txId = base64.encode(sha256(txBytes));
        console.log('Expect transaction ID', txId);

        if (this.recentTxIds.includes(txId)) {
            throw new Error('Transaction ID already received, skipping')
        }
        this.recentTxIds.push(txId)
        if (this.recentTxIds.length > 100) {
            this.recentTxIds.shift()
        }

        const msg = Uint8Array.from([TX_BYTE_ONE, ...txBytes]);
        return this.queueMessage(msg, txId);
    }
}
