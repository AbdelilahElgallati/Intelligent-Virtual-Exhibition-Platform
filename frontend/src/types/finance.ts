export type SourceType = 'event_ticket' | 'marketplace' | 'stand_fee';
export type ReceiverType = 'organizer' | 'enterprise' | 'platform';
export type TransactionStatus = 'paid' | 'pending' | 'failed';
export type PayoutStatus = 'unpaid' | 'processing' | 'paid';

export interface FinancialTransaction {
    id: string;
    source_type: SourceType;
    reference_id: string;
    amount: number;
    currency: string;
    payer_id: string;
    receiver_type: ReceiverType;
    receiver_id: string;
    status: TransactionStatus;
    payout_status: PayoutStatus;
    created_at: string | null;
    paid_at: string | null;
    description: string;
    metadata: Record<string, unknown>;
}

export interface FinancialTransactionListResponse {
    items: FinancialTransaction[];
    total: number;
}

export type PayoutRecordStatus = 'pending' | 'completed';

export interface PayoutRecord {
    id: string;
    _id?: string;
    transaction_id: string;
    receiver_id: string;
    receiver_name?: string;
    amount: number;
    status: PayoutRecordStatus;
    note?: string | null;
    processed_by: string;
    processed_by_name?: string;
    processed_at: string;
}

export interface PayoutListResponse {
    items: PayoutRecord[];
    total: number;
}

export interface CreatePayoutResponse {
    payout: PayoutRecord;
    transaction: FinancialTransaction;
    already_settled: boolean;
}

export interface UpdatePayoutPayload {
    note?: string;
    status?: PayoutRecordStatus;
}

export interface DeletePayoutResponse {
    deleted: boolean;
    payout_id: string;
}
