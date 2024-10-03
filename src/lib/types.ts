export type ActionData = {
    actionName: string
    data: Record<string, unknown>
}

export type TransactionPayload = {
    base: TransactionBase,
    actions: ActionData[]
}

export type TransactionBase = {
    timestamp: string
    chainId: string
    maxFee: string
}

export type Units = {
    bandwidth: number
    compute: number
    storageRead: number
    storageAllocate: number
    storageWrite: number
}
