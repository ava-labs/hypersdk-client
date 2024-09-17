
import { sha256 } from '@noble/hashes/sha256';
import { parse } from 'lossless-json'
import { parseBech32 } from './bech32';
import { base64 } from '@scure/base';
import ABIsABI from './testdata/abi.abi.json'
import { TransactionPayload } from '.';

export type VMABI = {
    actions: ActionABI[]
    types: TypeABI[]
}

type ActionABI = {
    id: number
    action: string
    output?: string
}

type TypeABI = {
    name: string,
    fields: ABIField[]
}

type ABIField = {
    name: string,
    type: string
}

export class Marshaler {
    constructor(private abi: VMABI) {
        if (!Array.isArray(this.abi?.actions)) {
            throw new Error('Invalid ABI')
        }
    }

    getHash(): Uint8Array {
        const abiAbiMarshaler = new Marshaler(ABIsABI)
        const abiBytes = abiAbiMarshaler.getActionBinary("ABI", JSON.stringify(this.abi))
        return sha256(abiBytes)
    }

    getActionBinary(actionName: string, dataJSON: string): Uint8Array {
        //todo: has to throw error of dataJSON has any extra fields
        const data = parse(dataJSON) as Record<string, unknown>

        return this.encodeField(actionName, data)
    }


    parseStructBinary(outputType: string, actionResultBinary: Uint8Array): unknown {
        // Handle primitive types
        if (this.isPrimitiveType(outputType)) {
            const [value, _] = this.decodeField(outputType, actionResultBinary);
            return value;
        }

        // Handle struct types
        let structABI = this.abi.types.find((type) => type.name === outputType);
        if (!structABI) {
            throw new Error(`No struct ABI found for type ${outputType}`);
        }

        let result: Record<string, unknown> = {};
        let offset = 0;

        for (const field of structABI.fields) {
            const fieldType = field.type;

            // Decode field based on type
            const [decodedValue, bytesConsumed] = this.decodeField(fieldType, actionResultBinary.subarray(offset));
            result[field.name] = decodedValue;
            offset += bytesConsumed;
        }

        return result;
    }

    // Add this helper method to check if a type is primitive
    private isPrimitiveType(type: string): boolean {
        const primitiveTypes = [
            "uint8", "uint16", "uint32", "uint64", "uint256",
            "int8", "int16", "int32", "int64",
            "string", "Address", "[]uint8", "Bytes"
        ];
        return primitiveTypes.includes(type) || type.startsWith('[]');
    }

    private decodeField(type: string, binaryData: Uint8Array): [unknown, number] {
        // Decodes field and returns value and the number of bytes consumed.
        switch (type) {
            case "uint8":
            case "uint16":
            case "uint32":
            case "uint64":
            case "uint256":
                return [this.decodeNumber(type, binaryData), this.getByteSize(type)];
            case "string":
                return this.decodeString(binaryData);
            case "Address":
                return this.decodeAddress(binaryData);
            case "[]uint8":
            case "Bytes":
                return this.decodeBytes(binaryData);
            case "int8":
            case "int16":
            case "int32":
            case "int64":
                return [this.decodeNumber(type, binaryData), this.getByteSize(type)];
            default:
                // Handle arrays and structs
                if (type.startsWith('[]')) {
                    return this.decodeArray(type.slice(2), binaryData);
                } else {
                    // Struct type
                    const decodedStruct = this.parseStructBinary(type, binaryData);
                    const bytesConsumed = this.getStructByteSize(type, binaryData);
                    return [decodedStruct, bytesConsumed];
                }
        }
    }

    private decodeNumber(type: string, binaryData: Uint8Array): bigint | number {
        const dataView = new DataView(binaryData.buffer, binaryData.byteOffset, binaryData.byteLength);
        let result: bigint | number;

        switch (type) {
            case "uint8":
                result = dataView.getUint8(0);
                break;
            case "uint16":
                result = dataView.getUint16(0, false);
                break;
            case "uint32":
                result = dataView.getUint32(0, false);
                break;
            case "uint64":
                result = dataView.getBigUint64(0, false);
                break;
            case "int8":
                result = dataView.getInt8(0);
                break;
            case "int16":
                result = dataView.getInt16(0, false);
                break;
            case "int32":
                result = dataView.getInt32(0, false);
                break;
            case "int64":
                result = dataView.getBigInt64(0, false);
                break;
            default:
                throw new Error(`Unsupported number type: ${type}`);
        }

        return result;
    }

    private getByteSize(type: string): number {
        switch (type) {
            case "uint8": return 1;
            case "uint16": return 2;
            case "uint32": return 4;
            case "uint64": return 8;
            case "uint256": return 32;
            case "int8": return 1;
            case "int16": return 2;
            case "int32": return 4;
            case "int64": return 8;
            default: throw new Error(`Unknown type for byte size: ${type}`);
        }
    }

    private decodeString(binaryData: Uint8Array): [string, number] {
        const length = this.decodeNumber("uint16", binaryData) as number;
        const textDecoder = new TextDecoder();
        const stringBytes = binaryData.subarray(2, 2 + length); // Skip the length bytes
        return [textDecoder.decode(stringBytes), 2 + length];
    }

    private decodeAddress(binaryData: Uint8Array): [string, number] {
        const addressBytes = binaryData.subarray(0, 33); // Fixed length for Address (33 bytes)
        return [base64.encode(addressBytes), 33];
    }

    private decodeBytes(binaryData: Uint8Array): [string, number] {
        const length = this.decodeNumber("uint32", binaryData) as number;
        const byteArray = binaryData.subarray(4, 4 + length); // Skip the length bytes
        const base64String = base64.encode(byteArray);
        return [base64String, 4 + length];
    }

    private decodeArray(type: string, binaryData: Uint8Array): [unknown[], number] {
        const length = this.decodeNumber("uint32", binaryData) as number;
        let offset = 4; // Skip the length bytes
        let resultArray = [];
        for (let i = 0; i < length; i++) {
            const [decodedValue, bytesConsumed] = this.decodeField(type, binaryData.subarray(offset));
            resultArray.push(decodedValue);
            offset += bytesConsumed;
        }
        return [resultArray, offset];
    }

    private getStructByteSize(type: string, binaryData: Uint8Array): number {
        const structABI = this.abi.types.find((t) => t.name === type);
        if (!structABI) {
            throw new Error(`No struct ABI found for type ${type}`);
        }

        let totalSize = 0;
        for (const field of structABI.fields) {
            const [_, bytesConsumed] = this.decodeField(field.type, binaryData.subarray(totalSize));
            totalSize += bytesConsumed;
        }
        return totalSize;
    }



    encodeTransaction(tx: TransactionPayload): Uint8Array {
        if (tx.timestamp.slice(-3) !== "000") {
            tx.timestamp = String(Math.floor(parseInt(tx.timestamp) / 1000) * 1000)
        }

        const timestampBytes = encodeNumber("uint64", tx.timestamp);
        const chainIdBytes = encodeNumber("uint256", tx.chainId);
        const maxFeeBytes = encodeNumber("uint64", tx.maxFee);
        const actionsCountBytes = encodeNumber("uint8", tx.actions.length);

        let actionsBytes = new Uint8Array();
        for (const action of tx.actions) {
            const actionTypeIdBytes = encodeNumber("uint8", this.getActionTypeId(action.actionName));
            const actionDataBytes = this.encodeField(action.actionName, action.data);
            actionsBytes = new Uint8Array([...actionsBytes, ...actionTypeIdBytes, ...actionDataBytes]);
        }

        // const abiHashBytes = this.getHash()

        return new Uint8Array([
            // ...abiHashBytes //TODO: add abi hash to the end of the signable body of transaction
            ...timestampBytes,
            ...chainIdBytes,
            ...maxFeeBytes,
            ...actionsCountBytes,
            ...actionsBytes,
        ]);
    }

    public getActionTypeId(actionName: string): number {
        const actionABI = this.abi.actions.find(action => action.action === actionName)
        if (!actionABI) throw new Error(`No action ABI found: ${actionName}`)
        return actionABI.id
    }

    private encodeField(type: string, value: unknown, parentActionName?: string): Uint8Array {
        if (type === 'Address' && typeof value === 'string') {
            return encodeAddress(value)
        }

        if ((type === '[]uint8' || type === 'Bytes') && typeof value === 'string') {
            const byteArray = Array.from(atob(value), char => char.charCodeAt(0)) as number[]
            return new Uint8Array([...encodeNumber("uint32", byteArray.length), ...byteArray])
        }

        if (type.startsWith('[]')) {
            return this.encodeArray(type.slice(2), value as unknown[]);
        }

        switch (type) {
            case "uint8":
            case "uint16":
            case "uint32":
            case "uint64":
            case "int8":
            case "int16":
            case "int32":
            case "int64":
                return encodeNumber(type, value as number | string)
            case "string":
                return encodeString(value as string)
            default:
                {
                    let structABI: TypeABI | null = null
                    for (const typ of this.abi.types) {
                        if (typ.name === type) {
                            structABI = typ
                            break
                        }
                    }
                    if (!structABI) throw new Error(`No struct ${type} found in action ${type} ABI`)

                    const dataRecord = value as Record<string, unknown>;
                    let resultingBinary = new Uint8Array()
                    for (const field of structABI.fields) {
                        const fieldBinary = this.encodeField(field.type, dataRecord[field.name], type);
                        resultingBinary = new Uint8Array([...resultingBinary, ...fieldBinary])
                    }
                    return resultingBinary
                }
        }
    }

    private encodeArray(type: string, value: unknown[]): Uint8Array {
        if (!Array.isArray(value)) {
            throw new Error(`Error in encodeArray: Expected an array for type ${type}, but received ${typeof value} of declared type ${type}`)
        }

        const lengthBytes = encodeNumber("uint32", value.length);
        const encodedItems = value.map(item => this.encodeField(type, item));
        const flattenedItems = encodedItems.reduce((acc, item) => {
            if (item instanceof Uint8Array) {
                return [...acc, ...item];
            } else if (typeof item === 'number') {
                return [...acc, item];
            } else {
                throw new Error(`Unexpected item type in encoded array: ${typeof item}`);
            }
        }, [] as number[]);
        return new Uint8Array([...lengthBytes, ...flattenedItems]);
    }
}

function encodeAddress(value: string): Uint8Array {
    let decodedCount = 0

    let addrBytes: Uint8Array = new Uint8Array()

    //try as a normal bech32 address
    try {
        const [, decodedBytes] = parseBech32(value)
        addrBytes = decodedBytes
        decodedCount++
    } catch (e) {
    }

    //try as 33 byte base64 encoded address (golang would marshal as such)
    if (isValidBase64(value)) {
        const decoded = base64.decode(value);
        if (decoded.length === 33) {//doesn't throw
            addrBytes = decoded;
            decodedCount++;
        }
    }

    if (decodedCount > 1) {
        throw new Error(`Address must be either bech32 or base64 encoded, could be decoded as both. the result is ambiguous: ${value}`)
    } else if (decodedCount === 1) {
        return addrBytes
    } else {
        throw new Error(`Address must be either bech32 or base64 encoded, could be decoded as neither: ${value}`)
    }
}

function isValidBase64(str: string): boolean {
    try {
        const decoded = base64.decode(str);
        return decoded.length > 0 && /^[A-Za-z0-9+/]*={0,2}$/.test(str);
    } catch {
        return false;
    }
}

function encodeNumber(type: string, value: number | string): Uint8Array {
    let bigValue = BigInt(value)
    let buffer: ArrayBuffer
    let dataView: DataView

    switch (type) {
        case "uint8":
            buffer = new ArrayBuffer(1)
            dataView = new DataView(buffer)
            dataView.setUint8(0, Number(bigValue))
            break
        case "uint16":
            buffer = new ArrayBuffer(2)
            dataView = new DataView(buffer)
            dataView.setUint16(0, Number(bigValue), false)
            break
        case "uint32":
            buffer = new ArrayBuffer(4)
            dataView = new DataView(buffer)
            dataView.setUint32(0, Number(bigValue), false)
            break
        case "uint64":
            buffer = new ArrayBuffer(8)
            dataView = new DataView(buffer)
            dataView.setBigUint64(0, bigValue, false)
            break
        case "uint256":
            buffer = new ArrayBuffer(32)
            dataView = new DataView(buffer)
            for (let i = 0; i < 32; i++) {
                dataView.setUint8(31 - i, Number(bigValue & 255n))
                bigValue >>= 8n
            }
            break
        case "int8":
            buffer = new ArrayBuffer(1)
            dataView = new DataView(buffer)
            dataView.setInt8(0, Number(bigValue))
            break
        case "int16":
            buffer = new ArrayBuffer(2)
            dataView = new DataView(buffer)
            dataView.setInt16(0, Number(bigValue), false)
            break
        case "int32":
            buffer = new ArrayBuffer(4)
            dataView = new DataView(buffer)
            dataView.setInt32(0, Number(bigValue), false)
            break
        case "int64":
            buffer = new ArrayBuffer(8)
            dataView = new DataView(buffer)
            dataView.setBigInt64(0, bigValue, false)
            break
        default:
            throw new Error(`Unsupported number type: ${type}`)
    }

    return new Uint8Array(buffer)
}

function encodeString(value: string): Uint8Array {
    const encoder = new TextEncoder()
    const stringBytes = encoder.encode(value)
    const lengthBytes = encodeNumber("uint16", stringBytes.length)
    return new Uint8Array([...lengthBytes, ...stringBytes])
}

//TODO: consider using this instead of DataView
// private packUintGeneric(value: bigint, byteLength: number): void {
//     const buffer = new ArrayBuffer(byteLength);
//     const view = new DataView(buffer);
//     for (let i = 0; i < byteLength; i++) {
//         view.setUint8(byteLength - 1 - i, Number(value & 255n));
//         value >>= 8n;
//     }
//     const newBytes = new Uint8Array(buffer);
//     this._bytes = new Uint8Array([...this._bytes, ...newBytes]);
// }

// packUint64(value: bigint): void {
//     this.packUintGeneric(value, 8);
// }
