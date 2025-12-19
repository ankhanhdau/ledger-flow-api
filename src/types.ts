export interface TransferDTO {
    fromAccountId: number;
    toAccountId: number;
    amount: number;
    reference: string;
}

export interface AccountParams {
    id: string;
}