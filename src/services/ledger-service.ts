import { getClient } from '../db/connection.js';
import type { TransferDTO } from '../types.js';

export async function transferFunds({ fromAccountId, toAccountId, amount, reference }: TransferDTO) {
    const client = await getClient();
    try {
        //Start transaction
        await client.query('BEGIN');

        //Determine Lock Order to Prevent Deadlocks
        const lockIds = [fromAccountId, toAccountId].sort((a, b) => a - b);

        // Lock BOTH accounts in one atomic query
        const accountsRes = await client.query(
            `SELECT id, balance FROM accounts 
       WHERE id IN ($1, $2) 
       ORDER BY id FOR UPDATE`,
            [lockIds[0], lockIds[1]]
        );

        // Verify both accounts exist
        if (accountsRes.rows.length !== 2) {
            throw new Error('One or both accounts not found');
        }

        // Find the sender in the locked results
        const sender = accountsRes.rows.find(row => row.id === fromAccountId);
        const receiver = accountsRes.rows.find(row => row.id === toAccountId);

        if (!sender || !receiver) throw new Error('Account lookup failed');

        //Check Sufficient Funds
        const senderBalance = parseFloat(sender.balance);
        if (senderBalance < amount) {
            throw new Error('Insufficient funds in sender account');
        }

        //Create Transaction Record
        const transactionRes = await client.query(
            `INSERT INTO transactions (amount, reference, description) 
       VALUES ($1, $2, $3) RETURNING id`,
            [amount, reference, `Transfer from ${fromAccountId} to ${toAccountId}`]
        );
        const transactionId = transactionRes.rows[0].id;

        //Credit Sender Account
        await client.query(
            'INSERT INTO ledger_entries (transaction_id, account_id, amount, balance_after, type) VALUES ($1, $2, $3, $4, $5)',
            [transactionId, fromAccountId, amount, senderBalance - amount, 'CREDIT']
        );

        //Debit Receiver Account
        const receiverBalance = parseFloat(receiver.balance);

        await client.query(
            'INSERT INTO ledger_entries (transaction_id, account_id, amount, balance_after, type) VALUES ($1, $2, $3, $4, $5)',
            [transactionId, toAccountId, amount, receiverBalance + amount, 'DEBIT']
        );

        //Update Account Balances
        await client.query('UPDATE accounts SET balance = balance - $1 WHERE id = $2', [amount, fromAccountId]);
        await client.query('UPDATE accounts SET balance = balance + $1 WHERE id = $2', [amount, toAccountId]);

        //Commit Transaction
        await client.query('COMMIT');
        console.log(`✅ Transaction ${transactionId} processed successfully.`);
        return { success: true, transactionId };

    } catch (error) {
        //Rollback on Error
        await client.query('ROLLBACK');
        console.error('Transaction Failed:', error);
        throw error;
    } finally {
        //Release Client
        client.release();
    }
};