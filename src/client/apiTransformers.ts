import { hexToBytes } from "@noble/hashes/utils";
import { addressBytesFromPubKey, addressHexFromPubKey, Marshaler } from "../lib/Marshaler";
import { ActionOutput } from "./types";
import { ActionData, TransactionBase, TransactionPayload } from "../snap";
import { bytesToHex } from "@noble/curves/abstract/utils";
import { base64 } from "@scure/base";


export interface TxAPIResponse {
    timestamp: number;
    success: boolean;
    units: string;
    fee: number;
    result: any[];
}


export interface TransactionStatus {
    blockTimestamp: number;
    success: boolean;
    fee: number;
    result: ActionOutput[];
    error: string;
}

export function txAPIResponseToTransactionStatus(response: TxAPIResponse, marshaler: Marshaler): TransactionStatus {
    const error = response.success ? "" : "No error message - field Error is not implemented yet in GetTxResponse struct of api/indexer/server.go file";
    return {
        blockTimestamp: response.timestamp,
        success: response.success,
        fee: response.fee,
        result: response.result.map((result: string) => marshaler.parseTyped(hexToBytes(result), "output")[0]),
        error: error
    }
}


export interface BlockAPIResponse {
    block: {
        block: {
            parent: string;
            timestamp: number;
            height: number;
            txs: Array<{
                base: {
                    timestamp: number;
                    chainId: string;
                    maxFee: number;
                };
                actions: ActionData[];
                auth: {
                    signer: number[];
                    signature: number[];
                };
            }>;
            stateRoot: string;
        };
        results: Array<{
            Success: boolean;
            Error: string;
            Outputs: string[];
            Units: string;
            Fee: number;
        }>;
        unitPrices: string;
    };
    blockBytes: string;
}

export interface ExecutedBlock {
    height: number;
    parent: string;
    stateRoot: string;
    timestamp: number;
    transactions: {
        // id: string,
        base: TransactionBase,
        actions: any[],
        response: TxAPIResponse,
        sender: string,
    }[];
}

export function blockAPIResponseToExecutedBlock(response: BlockAPIResponse, marshaler: Marshaler): ExecutedBlock {

    if (response.block.results.length !== response.block.block.txs.length) {
        throw new Error("results and txs have different lengths");
    }

    const transactions: {
        base: TransactionBase,
        actions: ActionData[],
        response: TxAPIResponse,
        sender: string,
        // id: string,
    }[] = [];

    for (let i = 0; i < response.block.block.txs.length; i++) {
        transactions.push({
            // id: "TODO: tx ID placeholder",
            base: {
                timestamp: String(response.block.block.txs[i]!.base.timestamp),
                chainId: response.block.block.txs[i]!.base.chainId,
                maxFee: String(response.block.block.txs[i]!.base.maxFee)
            },
            actions: response.block.block.txs[i]!.actions,
            response: {
                timestamp: response.block.block.txs[i]!.base.timestamp,
                success: response.block.results[i]!.Success,
                units: response.block.results[i]!.Units,
                fee: response.block.results[i]!.Fee,
                result: response.block.results[i]!.Outputs.map((output) => marshaler.parseTyped(base64.decode(output), "output")[0]),
            },
            sender: addressHexFromPubKey(Uint8Array.from(response.block.block.txs[i]!.auth.signer))
        })
    }

    return {
        height: response.block.block.height,
        parent: response.block.block.parent,
        stateRoot: response.block.block.stateRoot,
        timestamp: response.block.block.timestamp,
        transactions: transactions,
    }
}

const BLOCK_RESPONSE_SUCCESS_EXAMPLE = {
    "block": {
        "block": {
            "parent": "Lbrub28kxdDYXRWdSHiWRZydQ2e47CpxdhUrGBkwd1uj3DLaL",
            "timestamp": 1727765440727,
            "height": 413,
            "txs": [
                {
                    "base": {
                        "timestamp": 1727765500000,
                        "chainId": "2ExL2VZdxBKj2Jc5pnPb6u1R1UXb3YLfL48MELZKrsUwAnkie",
                        "maxFee": 33400
                    },
                    "actions": [
                        {
                            "to": "0x00b252f3cebb90a2e163e1bf88b9f2782c8185b5c5407be563172c5c1323d78995",
                            "value": 10000000000,
                            "memo": ""
                        }
                    ],
                    "auth": {
                        "signer": [
                            27,
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
                            167
                        ],
                        "signature": [
                            128,
                            144,
                            233,
                            36,
                            145,
                            231,
                            9,
                            255,
                            78,
                            28,
                            51,
                            212,
                            232,
                            65,
                            213,
                            6,
                            21,
                            38,
                            241,
                            163,
                            155,
                            89,
                            75,
                            83,
                            160,
                            74,
                            1,
                            42,
                            203,
                            237,
                            136,
                            225,
                            86,
                            182,
                            227,
                            55,
                            198,
                            181,
                            224,
                            210,
                            42,
                            120,
                            6,
                            249,
                            15,
                            148,
                            31,
                            195,
                            136,
                            217,
                            45,
                            87,
                            114,
                            212,
                            140,
                            100,
                            222,
                            163,
                            58,
                            73,
                            100,
                            27,
                            67,
                            5
                        ]
                    }
                }
            ],
            "stateRoot": "2fpSnLZw6mqT6pzHhjfb8c9CKhjDRyHbC5zMBrpGm77wKcYZeP"
        },
        "results": [
            {
                "Success": true,
                "Error": "",
                "Outputs": [
                    "AAAACQyqNPeMAAAAAlQL5AA="
                ],
                "Units": "(Bandwidth=192, Compute=7, Storage(Read)=14, Storage(Allocate)=50, Storage(Write)=26)",
                "Fee": 28900
            }
        ],
        "unitPrices": "(Bandwidth=100, Compute=100, Storage(Read)=100, Storage(Allocate)=100, Storage(Write)=100)"
    },
    "blockBytes": "000001142c81ae38785b367716285b0caec4e7544dec49240a863539072d3f12819bf8320000019246d868d7000000000000019d000000010000019246d9506002d1205ce2d344d101466b09b1ea55f943044f6705bc17c0e54d925ca1ffc39b0000000000008278010000b252f3cebb90a2e163e1bf88b9f2782c8185b5c5407be563172c5c1323d7899500000002540be40000000000001b057de320297c29ad0c1f589ea216869cf1938d88c9fbd70d6748323dbf2fa78090e92491e709ff4e1c33d4e841d5061526f1a39b594b53a04a012acbed88e156b6e337c6b5e0d22a7806f90f941fc388d92d5772d48c64dea33a49641b4305dbd64e5a61e914d941d3a32254e59c8683fd694f78d64320fb031f8836c973f90000004f0000000101000000000100000011000000090caa34f78c00000002540be40000000000000000c00000000000000007000000000000000e0000000000000032000000000000001a00000000000070e400000000000000640000000000000064000000000000006400000000000000640000000000000064"
}

const BLOCK_RESPONSE_FAIL_EXAMPLE = {
    "block": {
        "block": {
            "parent": "22gjARJRbn4NJiyPQm1AnWVpCiCVs92VkFiewMLKyNN626s5UL",
            "timestamp": 1727765502902,
            "height": 496,
            "txs": [
                {
                    "base": {
                        "timestamp": 1727765561000,
                        "chainId": "2ExL2VZdxBKj2Jc5pnPb6u1R1UXb3YLfL48MELZKrsUwAnkie",
                        "maxFee": 10000000
                    },
                    "actions": [
                        {
                            "to": "0x0000000000000000000000000000000000000000000000000000000000deadc0de",
                            "value": 1234567893333,
                            "memo": "THVpZ2k="
                        }
                    ],
                    "auth": {
                        "signer": [
                            14,
                            4,
                            48,
                            248,
                            7,
                            200,
                            165,
                            215,
                            176,
                            126,
                            24,
                            62,
                            34,
                            61,
                            166,
                            214,
                            150,
                            73,
                            138,
                            197,
                            214,
                            220,
                            58,
                            153,
                            139,
                            64,
                            121,
                            204,
                            84,
                            242,
                            163,
                            199
                        ],
                        "signature": [
                            206,
                            105,
                            129,
                            10,
                            205,
                            149,
                            166,
                            90,
                            66,
                            103,
                            188,
                            125,
                            231,
                            137,
                            8,
                            138,
                            176,
                            230,
                            234,
                            111,
                            49,
                            61,
                            59,
                            43,
                            131,
                            120,
                            194,
                            19,
                            35,
                            198,
                            223,
                            68,
                            10,
                            86,
                            152,
                            66,
                            43,
                            117,
                            225,
                            59,
                            77,
                            44,
                            0,
                            61,
                            147,
                            189,
                            54,
                            55,
                            61,
                            44,
                            163,
                            228,
                            198,
                            60,
                            150,
                            120,
                            145,
                            138,
                            181,
                            102,
                            207,
                            207,
                            23,
                            5
                        ]
                    }
                }
            ],
            "stateRoot": "aC7tcC14vZwGYTxxDFU3VJd5Q3PtJ37BTdKsxwDwpWHJXMxsy"
        },
        "results": [
            {
                "Success": false,
                "Error": "aW52YWxpZCBiYWxhbmNlOiBjb3VsZCBub3Qgc3VidHJhY3QgYmFsYW5jZSAoYmFsPTk5OTk5NzA2MDAsIGFkZHI9MDBkOTI1MjQ4NTdlODQ5MGU0OTk1Y2RlODVlYzQ5NzVhNGRhZDBiYWY2OWFjNWIyODY5ZWZiOTY3ZThjYjE5ZmE1LCBhbW91bnQ9MTIzNDU2Nzg5MzMzMyk=",
                "Outputs": [],
                "Units": "(Bandwidth=197, Compute=7, Storage(Read)=14, Storage(Allocate)=50, Storage(Write)=26)",
                "Fee": 29400
            }
        ],
        "unitPrices": "(Bandwidth=100, Compute=100, Storage(Read)=100, Storage(Allocate)=100, Storage(Write)=100)"
    },
    "blockBytes": "000001198785a017b34a8f7b7b0eadd634e6d271bd7b8ef2d189120408a5856dd89af2810000019246d95bb600000000000001f0000000010000019246da3ea802d1205ce2d344d101466b09b1ea55f943044f6705bc17c0e54d925ca1ffc39b000000000098968001000000000000000000000000000000000000000000000000000000000000deadc0de0000011f71fb1155000000054c75696769000e0430f807c8a5d7b07e183e223da6d696498ac5d6dc3a998b4079cc54f2a3c7ce69810acd95a65a4267bc7de789088ab0e6ea6f313d3b2b8378c21323c6df440a5698422b75e13b4d2c003d93bd36373d2ca3e4c63c9678918ab566cfcf17054b5da68e6687b97e69c56256dac1fafe5f69ae5a7c9309d40e0d506a6f2ffed5000000d500000001000000009b696e76616c69642062616c616e63653a20636f756c64206e6f742073756274726163742062616c616e6365202862616c3d393939393937303630302c20616464723d3030643932353234383537653834393065343939356364653835656334393735613464616430626166363961633562323836396566623936376538636231396661352c20616d6f756e743d31323334353637383933333333290000000000000000c50000000000000007000000000000000e0000000000000032000000000000001a00000000000072d800000000000000640000000000000064000000000000006400000000000000640000000000000064"
}
