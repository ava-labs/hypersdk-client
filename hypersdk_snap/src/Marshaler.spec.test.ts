import { bytesToHex } from '@noble/hashes/utils'
import { idStringToBigInt } from './cb58'
import { hexToBytes } from '@noble/curves/abstract/utils'
import { Marshaler } from "./Marshaler";
import { parseBech32 } from './bech32';
import { base64 } from '@scure/base';
import { signTransactionBytes, TransactionPayload } from './sign';
import fs from 'fs';


// {"empty", &testdata.MockObjectSingleNumber{}},
// 		{"uint16", &testdata.MockObjectSingleNumber{}},
// 		{"numbers", &testdata.MockObjectAllNumbers{}},
// 		{"arrays", &testdata.MockObjectArrays{}},
// 		{"transfer", &testdata.MockActionTransfer{}},
// 		{"transferField", &testdata.MockActionWithTransfer{}},
// 		{"transfersArray", &testdata.MockActionWithTransferArray{}},
// 		{"strBytes", &testdata.MockObjectStringAndBytes{}},
// 		{"strByteZero", &testdata.MockObjectStringAndBytes{}},
// 		{"strBytesEmpty", &testdata.MockObjectStringAndBytes{}},
// 		{"strOnly", &testdata.MockObjectStringAndBytes{}},
// 	}

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
]

const abi = new Marshaler(
  fs.readFileSync(`./src/testdata/abi.json`, 'utf8')
)

//TODO: test abi hash

for (const [testCase, action] of testCases) {
  test(`${testCase} spec`, () => {
    const expectedHex = String(
      fs.readFileSync(`./src/testdata/${testCase}.hex`, 'utf8')
    ).trim()
    const input = fs.readFileSync(`./src/testdata/${testCase}.json`, 'utf8')

    const actualHex = bytesToHex(abi.getActionBinary(action, input))
    expect(actualHex).toEqual(expectedHex)
  })
}
