import { base64 } from "@scure/base"
import { Marshaler } from "./Marshaler"
import { bytesToHex } from "@noble/curves/abstract/utils"


type TransactionResult = {
    success: boolean
    error: string
    outputs: Uint8Array[]
    feeDimensions: FeeDimensions
    fee: bigint
}

type FeeDimensions = {
    bandwidth: bigint;
    compute: bigint;
    storageRead: bigint;
    storageAllocate: bigint;
    storageWrite: bigint;
}


const wsMarshaler = new Marshaler({
    actions: [],
    outputs: [],
    types: [
        {
            name: "FeeDimensions",
            fields: [
                {
                    name: "bandwidth",
                    type: "uint64"
                },
                {
                    name: "compute",
                    type: "uint64"
                },
                {
                    name: "storageRead",
                    type: "uint64"
                },
                {
                    name: "storageAllocate",
                    type: "uint64"
                },
                {
                    name: "storageWrite",
                    type: "uint64"
                }
            ]
        },
    ],
})

export function unmarshalResult(data: Uint8Array): TransactionResult {
    let offset = 0
    const result: TransactionResult = { success: false, error: "", outputs: [], feeDimensions: { bandwidth: 0n, compute: 0n, storageRead: 0n, storageAllocate: 0n, storageWrite: 0n }, fee: 0n }
    //check if the tx succeeded
    result.success = Boolean(data[offset]);
    offset += 1;

    let bytesConsumed = 0

    //unpack tx-level error if there is one
    let txErrorBase64: string
    [txErrorBase64, bytesConsumed] = wsMarshaler.decodeField("[]uint8", data.slice(offset));

    offset += bytesConsumed
    if (txErrorBase64.length > 0) {
        result.error = new TextDecoder().decode(base64.decode(txErrorBase64));
    }

    //unpack number of actions
    let numActions: number = 0;
    [numActions, bytesConsumed] = wsMarshaler.decodeField<number>("uint8", data.slice(offset));
    offset += bytesConsumed

    for (let i = 0; i < numActions; i++) {
        let actionResult: Uint8Array
        [actionResult, bytesConsumed] = wsMarshaler.decodeField<Uint8Array>("[]uint8", data.slice(offset))
        offset += bytesConsumed
        result.outputs.push(actionResult);
    }

    //unpack fee dimensions
    let feeDimensions: FeeDimensions
    [feeDimensions, bytesConsumed] = wsMarshaler.decodeField<FeeDimensions>("FeeDimensions", data.slice(offset))
    offset += bytesConsumed
    result.feeDimensions = feeDimensions

    //unpack fee
    let fee: bigint
    [fee, bytesConsumed] = wsMarshaler.decodeField<bigint>("uint64", data.slice(offset))
    offset += bytesConsumed
    result.fee = fee

    // Check if there are any remaining bytes
    if (offset < data.length) {
        throw new Error(`Unexpected extra bytes: ${data.length - offset} bytes remaining after unpacking`);
    }

    return result
}

type TxMessage = TxErrorMessage | TxResultMessage

type TxErrorMessage = {
    txId: string;
    error: string;
}

type TxResultMessage = {
    txId: string;
    result: TransactionResult;
}

export function unpackTxMessage(data: Uint8Array): TxMessage {
    //first 32 bytes is the txID
    let offset = 0;
    const txId = base64.encode(data.slice(offset, 32));
    offset += 32;


    const hasError = Boolean(data[offset]);
    offset += 1;

    if (hasError) {
        const errorString = wsMarshaler.parse("string", data.slice(offset)) as string;
        return { txId, error: errorString }
    }

    const result = unmarshalResult(data.slice(offset));
    return { txId, result: result }
}
