import type { OnRpcRequestHandler } from '@metamask/snaps-sdk';
import { Box, Text, Bold, Copyable, Divider, Heading } from '@metamask/snaps-sdk/jsx';
import nacl from 'tweetnacl';
import { base58 } from '@scure/base';
import { SLIP10Node } from '@metamask/key-tree';
import { ED25519_AUTH_ID } from './bech32';
import { ed25519 } from "@noble/curves/ed25519";
import { Marshaler, VMABI } from './Marshaler';

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
    const node = await SLIP10Node.fromJSON(await snap.request({
        method: 'snap_getBip32Entropy',
        params: {
            path: [`m`, `44'`, `9000'`, `0'`],
            curve: 'ed25519'
        }
    }));
    const keyPair = nacl.sign.keyPair.fromSeed(Uint8Array.from(node.privateKeyBytes || []));


    switch (request.method) {
        case 'hello':
            return snap.request({
                method: 'snap_dialog',
                params: {
                    type: 'confirmation',
                    content: (
                        <Box>
                            <Text>
                                Hello, <Bold>{origin}</Bold>!
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
        case 'signTransaction':
            const { derivationPath, tx, abi } = (request.params || {}) as { derivationPath?: string[], tx: TransactionPayload, abi: VMABI };

            const marshaler = new Marshaler(abi);
            const digest = marshaler.encodeTransaction(tx);

            const accepted = await snap.request({
                method: 'snap_dialog',
                params: {
                    type: 'confirmation',
                    content: (
                        <Box>
                            <Heading>Sign Transaction</Heading>
                            <Divider />
                            {/* {tx.actions.map((action, index) => (
                                <Box key={index}>
                                    <Heading key={index}>{action.actionName}</Heading>
                                    {Object.entries(action.data).map(([key, value], entryIndex) => (
                                        <Box key={entryIndex}>
                                            <Text key={entryIndex}>{key}:</Text>
                                            <Copyable key={entryIndex} value={JSON.stringify(value, null, 2)} />
                                            <Divider />
                                        </Box>
                                    ))}
                                </Box>
                            ))} */}
                            <Text>
                                Warning: This JSON might have extra fields, field validation is not implemented yet.
                            </Text>
                        </Box>
                    ),
                },
            });
            if (!accepted) {
                throw { code: -32000, message: 'User rejected transaction' };
            }

            //sign tx
            const privateKey = keyPair.secretKey.slice(0, 32);
            if (privateKey.length !== 32) {
                throw { code: -32000, message: 'error deriving key pair' }
            }

            const signature = ed25519.sign(digest, privateKey);
            const pubKey = ed25519.getPublicKey(privateKey);
            const signedTxBytes = new Uint8Array([...digest, ED25519_AUTH_ID, ...pubKey, ...signature]);

            return base58.encode(signedTxBytes);
        case 'getPublicKey':
            return base58.encode(keyPair.publicKey);
        default:
            throw new Error('Method not found.');
    }
};


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

export type ActionData = {
    actionName: string
    data: Record<string, unknown>
}

export type TransactionPayload = {
    timestamp: string
    chainId: string
    maxFee: string
    actions: ActionData[]
}