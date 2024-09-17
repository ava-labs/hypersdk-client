import { bytesToHex } from '@noble/hashes/utils'
import { idStringToBigInt } from './cb58'
import { hexToBytes } from '@noble/curves/abstract/utils'
import { Marshaler, VMABI } from "./Marshaler";
import { parseBech32 } from './bech32';
import { base64 } from '@scure/base';
import fs from 'fs';
import { describe, expect, it, test } from '@jest/globals';
import { isLosslessNumber, parse, stringify } from 'lossless-json';

const testCases: [string, string][] = [
  ["empty", "MockObjectSingleNumber"],
  ["uint16", "MockObjectSingleNumber"],
  ["numbers", "MockObjectAllNumbers"],
  ["arrays", "MockObjectArrays"],
  ["transfer", "MockActionTransfer"],
  ["transferField", "MockActionWithTransfer"],
  ["transfersArray", "MockActionWithTransferArray"],
  ["strBytes", "MockObjectStringAndBytes"],
  ["strByteZero", "MockObjectStringAndBytes"],
  ["strBytesEmpty", "MockObjectStringAndBytes"],
  ["strOnly", "MockObjectStringAndBytes"],
  ["outer", "Outer"],
]

const abiJSON = fs.readFileSync(`./src/snap/testdata/abi.json`, 'utf8')
const marshaler = new Marshaler(JSON.parse(abiJSON) as VMABI)

test('ABI hash', () => {
  const actualHash = marshaler.getHash()
  const actualHex = bytesToHex(actualHash)

  const expectedHex = String(
    fs.readFileSync(`./src/snap/testdata/abi.hash.hex`, 'utf8')
  ).trim()

  expect(actualHex).toBe(expectedHex)
})

for (const [testCase, action] of testCases) {
  test(`${testCase} spec - encode and decode`, () => {
    const expectedHex = String(
      fs.readFileSync(`./src/snap/testdata/${testCase}.hex`, 'utf8')
    ).trim();
    const input = fs.readFileSync(`./src/snap/testdata/${testCase}.json`, 'utf8');

    console.log('Input JSON:', input);
    console.log('Expected hex:', expectedHex);

    // Test encoding
    const encodedBinary = marshaler.getActionBinary(action, input);
    const actualHex = bytesToHex(encodedBinary);
    console.log('Actual encoded hex:', actualHex);
    expect(actualHex).toEqual(expectedHex);

    // Test decoding
    console.log('Decoding results:');
    const decodedData = marshaler.parseStructBinary(action, encodedBinary);
    console.log('Decoded data:', JSON.stringify(decodedData, (_, value) =>
      typeof value === 'bigint' ? value.toString() : value
    ));

    // Compare the decoded data with the original input
    const originalData = parse(input)
    console.log('Original data:', JSON.stringify(originalData, (_, value) =>
      typeof value === 'bigint' ? value.toString() : value
    ));

    const compareObjects = (obj1: any, obj2: any) => {
      for (const key in obj1) {
        console.log(`Comparing ${key}:`, obj1[key], obj2[key]);
        if (typeof obj1[key] === 'bigint' || typeof obj2[key] === 'bigint') {
          expect(String(obj1[key])).toEqual(String(obj2[key]));
        } else {
          const expected = isLosslessNumber(obj2[key]) ? obj2[key].toString() : obj2[key]
          const actual = isLosslessNumber(obj1[key]) ? obj1[key].toString() : obj1[key]
          expect(String(actual)).toEqual(String(expected));
        }
      }
    };

    compareObjects(decodedData, originalData);
    // Use JSON.stringify for string representation comparison
    const stringifiedDecoded = stringify(decodedData);
    const stringifiedOriginal = stringify(originalData);
    console.log('Stringified decoded:', stringifiedDecoded);
    console.log('Stringified original:', stringifiedOriginal);
    expect(stringifiedDecoded).toEqual(stringifiedOriginal);
  });
}
