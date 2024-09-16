import { bytesToHex } from '@noble/hashes/utils'
import { idStringToBigInt } from './cb58'
import { hexToBytes } from '@noble/curves/abstract/utils'
import { Marshaler, VMABI } from "./Marshaler";
import { parseBech32 } from './bech32';
import { base64 } from '@scure/base';
import fs from 'fs'
import { describe, expect,it ,test} from '@jest/globals';
import { TransactionPayload } from '.';
import { ed25519 } from '@noble/curves/ed25519';
import { PrivateKeySigner } from '../client/PrivateKeySigner';

describe.skip('tx', () => {
  it('has to have at least one test', () => {
    expect(true).toBe(true)
  })
})

test('Empty transaction', () => {
  const chainId = idStringToBigInt("2c7iUW3kCDwRA9ZFd5bjZZc8iDy68uAsFSBahjqSZGttiTDSNH")

  const tx: TransactionPayload = {
    timestamp: "1717111222000",
    chainId: String(chainId),
    maxFee: String(10n * (10n ** 9n)),
    actions: [],
  }

  const abiJSON = fs.readFileSync(`./src/snap/testdata/abi.abi.json`, 'utf8')
  const marshaler = new Marshaler(JSON.parse(abiJSON) as VMABI)

  const txDigest = marshaler.encodeTransaction(tx)

  expect(
    bytesToHex(txDigest)
  ).toBe(
    "0000018fcbcdeef0" + "d36e467c73e2840140cc41b3d72f8a5a7446b2399c39b9c74d4cf077d2509024" + "00000002540be4" + "0000"
  );
})

test('Single action tx sign and marshal', async () => {
  const chainId = idStringToBigInt("2c7iUW3kCDwRA9ZFd5bjZZc8iDy68uAsFSBahjqSZGttiTDSNH");
  const addrString = "morpheus1qqds2l0ryq5hc2ddps04384zz6rfeuvn3kyvn77hp4n5sv3ahuh6wgkt57y";

  const abiJSON = fs.readFileSync(`./src/snap/testdata/abi.json`, 'utf8')
  const marshaler = new Marshaler(JSON.parse(abiJSON) as VMABI)

  const actionData = {
    actionName: "MockActionTransfer",
    data: {
      to: addrString,
      value: "123",
      memo: Buffer.from("memo").toString('base64'),
    }
  }

  const tx: TransactionPayload = {
    timestamp: "1717111222000",
    chainId: String(chainId),
    maxFee: String(10n * (10n ** 9n)),
    actions: [actionData],
  }

  const digest = marshaler.encodeTransaction(tx)
  expect(Buffer.from(digest).toString('hex')).toBe("0000018fcbcdeef0d36e467c73e2840140cc41b3d72f8a5a7446b2399c39b9c74d4cf077d250902400000002540be4000102001b057de320297c29ad0c1f589ea216869cf1938d88c9fbd70d6748323dbf2fa7000000000000007b000000046d656d6f");

  const privateKeyHex = "323b1d8f4eed5f0da9da93071b034f2dce9d2d22692c172f3cb252a64ddfafd01b057de320297c29ad0c1f589ea216869cf1938d88c9fbd70d6748323dbf2fa7";
  const privateKey = hexToBytes(privateKeyHex).slice(0, 32)

  const privateKeySigner = new PrivateKeySigner(privateKey);

  const signedTxBytes = await privateKeySigner.signTx(tx, JSON.parse(abiJSON) as VMABI);

  expect(Buffer.from(signedTxBytes).toString('hex')).toBe("0000018fcbcdeef0d36e467c73e2840140cc41b3d72f8a5a7446b2399c39b9c74d4cf077d250902400000002540be4000102001b057de320297c29ad0c1f589ea216869cf1938d88c9fbd70d6748323dbf2fa7000000000000007b000000046d656d6f001b057de320297c29ad0c1f589ea216869cf1938d88c9fbd70d6748323dbf2fa7113adacdd9eea506ef7c5ff9a2a99e9ffe51979488c9af4313ca6b95252cc0ecc4f38ad3b57afbac7a1f983dca5fe4c417bc0668bde68aa8d824325f1baa7704");
});
