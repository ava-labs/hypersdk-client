import type { OnRpcRequestHandler } from '@metamask/snaps-sdk';
import { Box, Text, Bold } from '@metamask/snaps-sdk/jsx';
import { assertInput, assertIsArray } from './assert';
import nacl from 'tweetnacl';
import { base58 } from '@scure/base';
import { SLIP10Node } from '@metamask/key-tree';

/**
 * Handle incoming JSON-RPC requests, sent through `wallet_invokeSnap`.
 *
 * @param args - The request handler args as object.
 * @param args.origin - The origin of the request, e.g., the website that
 * invoked the snap.
 * @param args.request - A validated JSON-RPC request object.
 * @returns The result of `snap_dialog`.
 * @throws If the request method is not valid for this snap.
 */
export const onRpcRequest: OnRpcRequestHandler = async ({
  origin,
  request,
}) => {

  const keyPair = await deriveKeyPair();

  const pubkey = base58.encode(keyPair.publicKey);


  switch (request.method) {
    case 'hello':
      return snap.request({
        method: 'snap_dialog',
        params: {
          type: 'confirmation',
          content: (
            <Box>
              <Text>
                Hello, <Bold>{pubkey}</Bold>!
              </Text>
              <Text>
                This custom confirmation is just for display purposes.
              </Text>
              <Text>
                But you can edit the snap source code to make it do something,
                if you want to!
              </Text>
            </Box>
          ),
        },
      });
    case 'getPublicKey':
     
      return pubkey;
    default:
      throw new Error('Method not found.');
  }
};


async function deriveKeyPair(pathSuffix: string[] = ["0'"]): Promise<nacl.SignKeyPair> {
  assertIsArray(pathSuffix);
  assertInput(pathSuffix.every((segment) => isValidSegment(segment)));

  const rootNode = await snap.request({
    method: 'snap_getBip32Entropy',
    params: {
      path: [`m`, `44'`, `9000'`],
      curve: 'ed25519'
    }
  });

  const node = await SLIP10Node.fromJSON(rootNode);

  const keypair = await node.derive(pathSuffix.map((segment) => `slip10:${segment}`) as `slip10:${number}'`[]);
  if (!keypair.privateKeyBytes) {
    throw {
      code: -32000,
      message: 'error deriving key pair'
    };
  }

  return nacl.sign.keyPair.fromSeed(Uint8Array.from(keypair.privateKeyBytes));
}

export function isValidSegment(segment: string) {
  if (typeof segment !== 'string') {
      return false;
  }

  if (!segment.match(/^[0-9]+'$/)) {
      return false;
  }

  const index = segment.slice(0, -1);

  if (parseInt(index).toString() !== index) {
      return false;
  }

  return true;
}

