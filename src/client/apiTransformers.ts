import { hexToBytes } from "@noble/hashes/utils";
import { addressHexFromPubKey, Marshaler } from "../lib/Marshaler";
import { ActionOutput } from "./types";
import { base64 } from "@scure/base";
import { ActionData, TransactionBase, Units } from "../lib/types";
import { bytesToHex } from "@noble/hashes/utils";


export type APITxResult = {
    "timestamp": 1728377000060,
    "success": true,
    "units": {
        "bandwidth": 197,
        "compute": 7,
        "storageRead": 14,
        "storageAllocate": 50,
        "storageWrite": 26
    },
    "fee": 29400,
    "result": ["00000000024cafa41300000000343efce1"]
}

export type TxResult = Omit<APITxResult, 'result'> & {
    result: ActionOutput[]
}

export function processAPITxResult(response: APITxResult, marshaler: Marshaler): TxResult {
    return {
        ...response,
        result: response.result.map(output =>
            marshaler.parseTyped(hexToBytes(output), "output")[0]
        )
    }
}

export type APITransactionStatus = {
    success: boolean;
    units: Units;
    fee: number;
    outputs: string[];
    error: string;
}

export type TransactionStatus = Omit<APITransactionStatus, 'outputs'> & {
    outputs: Record<string, unknown>[];
}


export function processAPITransactionStatus(response: APITransactionStatus, marshaler: Marshaler): TransactionStatus {
    const processedOutputs = response.outputs.map(output =>
        marshaler.parseTyped(hexToBytes(output), "output")[0]
    );

    return {
        ...response,
        outputs: processedOutputs,
    };
}


export function processAPIBlock(response: APIBlock, marshaler: Marshaler): Block {
    const processedTxs = response.block.block.txs.map(tx => ({
        ...tx,
        auth: {
            signer: bytesToHex(new Uint8Array(tx.auth.signer)),
            signature: bytesToHex(new Uint8Array(tx.auth.signature))
        }
    }));

    const processedResults = response.block.results.map(result =>
        processAPITransactionStatus(result, marshaler)
    );

    return {
        ...response.block,
        block: {
            ...response.block.block,
            txs: processedTxs,
        },
        results: processedResults,
    }
}

type absctractBlock<FixedBytesType, TxStatusType> = {
    blockID: string;
    block: {
        parent: string;
        timestamp: number;
        height: number;
        txs: {
            base: {
                timestamp: number;
                chainId: string;
                maxFee: number;
            };
            actions: Record<string, unknown>[];
            auth: {
                signer: FixedBytesType;
                signature: FixedBytesType;
            };
        }[];
        stateRoot: string;
    };
    results: TxStatusType[];
    unitPrices: Units;
}

export type APIBlock = {
    block: absctractBlock<number[], APITransactionStatus>,
    blockBytes: string
}
export type Block = absctractBlock<string, TransactionStatus>


//TODO: remove this after API stabilizes
const EXAMPLE_BLOCK_API_RESPONSE: APIBlock = {
    "block": {
        "blockID": "k2ZxbWEMpRB4GpMFmntHhU9bD757GSSWHV9gCPk22Q89uo1gv",
        "block": {
            "parent": "UiDbuqDRvpiuzP9xJyEzq6VK3SXfoNy3mLFAWQpJEkTMXsqYo",
            "timestamp": 1728374398758,
            "height": 366,
            "txs": [{
                "base": {
                    "timestamp": 1728374457000,
                    "chainId": "WXsVLmf6PmTa39HLHpr5zGUP4EdukrR1SpLqtPvhUFHyZmTRi",
                    "maxFee": 33400
                },
                "actions": [{
                    "to": "0x0056007a54b0cae0ece37f31ead9614d3fd271fb8db88e88bc557620a64ef04b10",
                    "value": 10000000000,
                    "memo": ""
                }],
                "auth": {
                    "signer": [27,
                        5,
                        125,
                        227,
                        32,
                        41,
                        124,
                        41,
                        173,
                        12,
                        31,
                        88,
                        158,
                        162,
                        22,
                        134,
                        156,
                        241,
                        147,
                        141,
                        136,
                        201,
                        251,
                        215,
                        13,
                        103,
                        72,
                        50,
                        61,
                        191,
                        47,
                        167],
                    "signature": [65,
                        156,
                        156,
                        19,
                        212,
                        105,
                        239,
                        209,
                        155,
                        172,
                        154,
                        199,
                        77,
                        138,
                        149,
                        246,
                        185,
                        127,
                        207,
                        158,
                        231,
                        115,
                        235,
                        135,
                        141,
                        221,
                        92,
                        112,
                        94,
                        34,
                        239,
                        133,
                        177,
                        113,
                        179,
                        11,
                        74,
                        168,
                        42,
                        230,
                        25,
                        63,
                        143,
                        163,
                        1,
                        248,
                        39,
                        10,
                        51,
                        118,
                        155,
                        87,
                        11,
                        24,
                        249,
                        192,
                        27,
                        104,
                        80,
                        149,
                        209,
                        248,
                        74,
                        2]
                }
            }],
            "stateRoot": "LfoGnf4utoobBBp29ou1VJ3N8LkfTpEgcD4RzRQgMVkF4TQtN"
        },
        "results": [{
            "success": true,
            "error": "",
            "outputs": ["000000090caa34f78c00000002540be400"],
            "units": {
                "bandwidth": 192,
                "compute": 7,
                "storageRead": 14,
                "storageAllocate": 50,
                "storageWrite": 26
            },
            "fee": 28900
        }],
        "unitPrices": {
            "bandwidth": 100,
            "compute": 100,
            "storageRead": 100,
            "storageAllocate": 100,
            "storageWrite": 100
        }
    },
    "blockBytes": "000001143eeb9f9a35a43e7443557d5c1260c55efd205fc7baaa5c3c34d19f17197e63c2000001926b245f26000000000000016e00000001000001926b2542a8430e7c6e0ae7214d1fc009ec63b3c13687f4f46548c1c69a01dac16cb7988523000000000000827801000056007a54b0cae0ece37f31ead9614d3fd271fb8db88e88bc557620a64ef04b1000000002540be40000000000001b057de320297c29ad0c1f589ea216869cf1938d88c9fbd70d6748323dbf2fa7419c9c13d469efd19bac9ac74d8a95f6b97fcf9ee773eb878ddd5c705e22ef85b171b30b4aa82ae6193f8fa301f8270a33769b570b18f9c01b685095d1f84a022ca924090619deb34939fafeb44936d781b105d04b81079b3cb94e38a958a0090000004f0000000101000000000100000011000000090caa34f78c00000002540be40000000000000000c00000000000000007000000000000000e0000000000000032000000000000001a00000000000070e400000000000000640000000000000064000000000000006400000000000000640000000000000064"
}

