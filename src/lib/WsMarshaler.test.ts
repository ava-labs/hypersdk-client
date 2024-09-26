/*
package chain

import (
    "encoding/base64"
    "encoding/hex"
    "testing"

    "github.com/ava-labs/hypersdk/codec"
    "github.com/ava-labs/hypersdk/consts"
    "github.com/ava-labs/hypersdk/fees"
    "github.com/stretchr/testify/require"
)

func TestUnmarshalResultSuccess(t *testing.T) {
    require := require.New(t)
    sampleResult := "0100000000010000001100000000024cafa413000000001613673f00000000000000c50000000000000007000000000000000e0000000000000032000000000000001a00000000000072d8"
    sampleResultBytes, err := hex.DecodeString(sampleResult)
    require.NoError(err)

    p := codec.NewReader(sampleResultBytes, consts.MaxInt)
    result, err := UnmarshalResult(p)
    require.NoError(err)

    expectedOutput, err := base64.StdEncoding.DecodeString("AAAAAAJMr6QTAAAAABYTZz8=")
    require.NoError(err)

    require.Equal(Result{
        Success: true,
        Error:   []byte{},
        Outputs: [][]byte{expectedOutput},
        Units:   fees.Dimensions{197, 7, 14, 50, 26},
        Fee:     29400,
    }, *result)
}

func TestUnmarshalResultError(t *testing.T) {
    require := require.New(t)
    sampleResult := "000000009b696e76616c69642062616c616e63653a20636f756c64206e6f742073756274726163742062616c616e6365202862616c3d31393939393937303630302c20616464723d3030643561613330663037366461303163373136663630306334656564373033333736343735333331366266656663633036383938323532616332626431393262362c20616d6f756e743d313233343536373839313232290000000000000000c50000000000000007000000000000000e0000000000000032000000000000001a00000000000072d8"
    sampleResultBytes, err := hex.DecodeString(sampleResult)
    require.NoError(err)

    p := codec.NewReader(sampleResultBytes, consts.MaxInt)
    result, err := UnmarshalResult(p)
    require.NoError(err)

    require.Equal(Result{
        Success: false,
        Error:   []byte("invalid balance: could not subtract balance (bal=19999970600, addr=00d5aa30f076da01c716f600c4eed7033764753316bfefcc06898252ac2bd192b6, amount=123456789122)"),
        Outputs: [][]byte{},
        Units:   fees.Dimensions{197, 7, 14, 50, 26},
        Fee:     29400,
    }, *result)
}

*/

import { expect, describe, it } from '@jest/globals';
import { unmarshalBlock, unmarshalResult } from './WsMarshaler';
import { hexToBytes } from '@noble/hashes/utils';

describe('unmarshalResult', () => {
    it('should correctly unmarshal a sample successful result', () => {
        // Sample result from the Go test
        const sampleResult = "0100000000010000001100000000024cafa413000000001613673f00000000000000c50000000000000007000000000000000e0000000000000032000000000000001a00000000000072d8";

        // Convert hex string to Uint8Array
        const sampleResultBytes = new Uint8Array(sampleResult.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));

        const result = unmarshalResult(sampleResultBytes);

        expect(result).toMatchObject({
            success: true,
            error: "",
            outputs: ["AAAAAAJMr6QTAAAAABYTZz8="],
            feeDimensions: {
                bandwidth: 197n,
                compute: 7n,
                storageRead: 14n,
                storageAllocate: 50n,
                storageWrite: 26n
            },
            fee: 29400n
        });
    });

    it('should throw an error if there are unexpected extra bytes', () => {
        const invalidResult = new Uint8Array(300);
        invalidResult[0] = 1; // Set success flag to true
        for (let i = 1; i < 300; i++) {
            invalidResult[i] = 0; // Fill the rest with zeros
        }

        expect(() => unmarshalResult(invalidResult)).toThrow('Unexpected extra bytes');
    });

    it('should correctly unmarshal a sample failed result', () => {
        // Sample result from the Go test
        const sampleResult = "000000009b696e76616c69642062616c616e63653a20636f756c64206e6f742073756274726163742062616c616e6365202862616c3d31393939393937303630302c20616464723d3030643561613330663037366461303163373136663630306334656564373033333736343735333331366266656663633036383938323532616332626431393262362c20616d6f756e743d313233343536373839313232290000000000000000c50000000000000007000000000000000e0000000000000032000000000000001a00000000000072d8";

        // Convert hex string to Uint8Array
        const sampleResultBytes = new Uint8Array(sampleResult.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));

        const result = unmarshalResult(sampleResultBytes);

        expect(result).toMatchObject({
            success: false,
            error: "invalid balance: could not subtract balance (bal=19999970600, addr=00d5aa30f076da01c716f600c4eed7033764753316bfefcc06898252ac2bd192b6, amount=123456789122)",
            outputs: [],
            feeDimensions: {
                bandwidth: 197n,
                compute: 7n,
                storageRead: 14n,
                storageAllocate: 50n,
                storageWrite: 26n
            },
            fee: 29400n
        });
    });
});


describe("unmarshalBlockMessage", () => {
    const blockMsg = hexToBytes("add1d36ef009f2bcd1a13aaa3c5856b444dff024af224299690b884a31b9e1eb000001922cd1e5680000000000002d0600000001000001922cd2cae84e8d76ca34b02707426f1f5be17604f0ff4c046f3e9de960bce86182c686dc64000000000000a348010300b19777c054c24a7216ab714d99adbdea1a181f43de6001ba3cd4c8713d328ab9039dd909c6fac1072001b309003837e26150eb2bf3be281c35f3ea3dc861e22dcd00000002540be400001b057de320297c29ad0c1f589ea216869cf1938d88c9fbd70d6748323dbf2fa76183614ccf636a2d3f40f3552c37c9df49414a25debd5477c6fc49860ff9ad1087a670b4154b829fffe68f7d55d4d2f86d8474e07a1bb4aba7def2f94664d50a9def9fdcc92a6be4c0bb51944104728b0e83d2b24c1a6999d6fe82e6f89409be")
    const block = unmarshalBlock(blockMsg)
    expect(block).toMatchObject({
        "hello": "world"
    })
})
