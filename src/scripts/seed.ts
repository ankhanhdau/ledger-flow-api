import { getClient } from "../db/connection.js";

async function seed() {
    const client = await getClient();
    try {
        // Delete existing data
        await client.query('TRUNCATE ledger_entries RESTART IDENTITY CASCADE');
        await client.query('TRUNCATE transactions RESTART IDENTITY CASCADE');
        await client.query('TRUNCATE accounts RESTART IDENTITY CASCADE');
        console.log('✅ Existing data cleared.');

        // Create sample accounts with higher initial balances
        await client.query(`
      INSERT INTO accounts (name, balance) 
      VALUES 
        ('Alice', 0.00), 
        ('Bob', 0.00)
    `);
        // Set initial balances
        await client.query(`
        INSERT INTO transactions (amount, reference, description)
        VALUES 
          (1000.00, 'Initial Deposit', 'Seed initial balance for Alice'),
          (1000.00, 'Initial Deposit', 'Seed initial balance for Bob')
    `);

        // Update ledger entries and account balances accordingly
        client.query(`
        INSERT INTO ledger_entries (transaction_id, account_id, amount, balance_after, type)
        VALUES 
          (1, 1, 1000.00, 1000.00, 'DEBIT'),
          (2, 2, 1000.00, 1000.00, 'DEBIT')`);

        // Finally, set the account balances
        await client.query(`UPDATE accounts SET balance = 1000.00 WHERE id IN (1, 2)`);
        console.log('✅ Sample accounts created.');
    } catch (error) {
        console.error('❌ Error seeding database:', error);
    } finally {
        client.release();
        process.exit(0);
    }
}
await seed();