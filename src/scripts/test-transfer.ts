import { transferFunds } from "../services/ledger-service.js";
import { getClient } from "../db/connection.js";

async function testConcurrentTransfers() {
  console.log('\n🚀 Starting concurrent transfer test...\n');
  
  const startTime = Date.now();
  
  // Create 50 concurrent transfer promises
  const transferPromises = [];
  
  for (let i = 0; i < 50; i++) {
    // Alternate between different account pairs
    const fromAccountId = (i % 2) + 1; // Alternates between 1 and 2
    const toAccountId = fromAccountId === 1 ? 2 : 1;
    const amount = 10.00 + (i * 0.50); // Varying amounts
    
    const promise = transferFunds({
      fromAccountId,
      toAccountId,
      amount,
      reference: `Concurrent Transfer #${i + 1}`
    });
    
    transferPromises.push(promise);
  }
  
  // Execute all transfers concurrently
  const results = await Promise.allSettled(transferPromises);
  
  const endTime = Date.now();
  const duration = endTime - startTime;
  
  // Analyze results
  const successful = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;
  
  console.log('\n📊 Test Results:');
  console.log('================');
  console.log(`✅ Successful: ${successful}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏱️ Duration: ${duration}ms`);
  console.log(`Throughput: ${(50 / (duration / 1000)).toFixed(2)} transfers/sec`);
  
  // Show any errors
  if (failed > 0) {
    console.log('\n❌ Failed Transfers:');
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.log(`  Transfer #${index + 1}: ${result.reason.message}`);
      }
    });
  }
  
  // Verify final balances
  await verifyBalances();
}

async function verifyBalances() {
  const client = await getClient();
  try {
    console.log('\n💰 Final Account Balances:');
    console.log('==========================');
    
    const accountsResult = await client.query(`
      SELECT id, name, balance 
      FROM accounts 
      ORDER BY id
    `);
    
    for (const account of accountsResult.rows) {
      console.log(`  ${account.name} (ID: ${account.id}): $${parseFloat(account.balance).toFixed(2)}`);
    }
    
    // Verify ledger integrity
    const ledgerResult = await client.query(`
      SELECT 
        account_id,
        SUM(CASE WHEN type = 'DEBIT' THEN amount ELSE -amount END) as calculated_balance
      FROM ledger_entries
      GROUP BY account_id
      ORDER BY account_id
    `);
    
    console.log('\n📒 Ledger Calculated Balances:');
    console.log('==============================');
    
    let balancesMatch = true;
    for (const ledger of ledgerResult.rows) {
      const account = accountsResult.rows.find(a => a.id === ledger.account_id);
      const accountBalance = parseFloat(account.balance);
      const ledgerBalance = parseFloat(ledger.calculated_balance);
      const match = Math.abs(accountBalance - ledgerBalance) < 0.01;
      
      console.log(`  Account ${ledger.account_id}: $${ledgerBalance.toFixed(2)} ${match ? '✅' : '❌ MISMATCH!'}`);
      
      if (!match) {
        balancesMatch = false;
        console.log(`    Expected: $${accountBalance.toFixed(2)}`);
      }
    }
    
    // Transaction count
    const txCountResult = await client.query('SELECT COUNT(*) as count FROM transactions');
    const entryCountResult = await client.query('SELECT COUNT(*) as count FROM ledger_entries');
    
    console.log('\n📈 Transaction Statistics:');
    console.log('==========================');
    console.log(`  Total Transactions: ${txCountResult.rows[0].count}`);
    console.log(`  Total Ledger Entries: ${entryCountResult.rows[0].count}`);
    console.log(`  Entries per Transaction: ${(entryCountResult.rows[0].count / txCountResult.rows[0].count).toFixed(1)}`);
    
    if (balancesMatch) {
      console.log('\n✅ All balances match ledger calculations!');
    } else {
      console.log('\n❌ Balance mismatch detected - possible data integrity issue!');
    }
    
  } catch (error) {
    console.error('❌ Error verifying balances:', error);
  } finally {
    client.release();
    process.exit(0);
  }
}

await testConcurrentTransfers();