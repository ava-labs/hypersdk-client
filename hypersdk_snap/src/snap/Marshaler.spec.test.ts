import { bytesToHex } from '@noble/hashes/utils'
import { idStringToBigInt } from './cb58'
import { hexToBytes } from '@noble/curves/abstract/utils'
import { Marshaler, VMABI } from "./Marshaler";
import { parseBech32 } from './bech32';
import { base64 } from '@scure/base';
import fs from 'fs';
import { describe, expect,it ,test} from '@jest/globals';

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
  test(`${testCase} spec`, () => {
    const expectedHex = String(
      fs.readFileSync(`./src/snap/testdata/${testCase}.hex`, 'utf8')
    ).trim()
    const input = fs.readFileSync(`./src/snap/testdata/${testCase}.json`, 'utf8')

    const actualHex = bytesToHex(marshaler.getActionBinary(action, input))
    expect(actualHex).toEqual(expectedHex)
  })
}
