-- 1. Accounts: The entities holding value
CREATE TABLE IF NOT EXISTS accounts (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  balance DECIMAL(20, 2) DEFAULT 0.00, -- Cache balance for speed
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Transactions: The "Intent" or Grouping ID
CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  amount DECIMAL(20, 2) NOT NULL,
  reference VARCHAR(100), -- e.g. "Invoice #101"
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Ledger Entries: The Immutable History (Double Entry)
CREATE TABLE IF NOT EXISTS ledger_entries (
  id SERIAL PRIMARY KEY,
  transaction_id INTEGER REFERENCES transactions(id),
  account_id INTEGER REFERENCES accounts(id),
  amount DECIMAL(20, 2) NOT NULL, -- Positive for CREDIT, Negative for DEBIT
  balance_after DECIMAL(20, 2), -- Balance of the account after this entry
  type VARCHAR(10) CHECK (type IN ('DEBIT', 'CREDIT')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Idempotency Keys (For API Reliability)
CREATE TABLE IF NOT EXISTS idempotency_keys (
  key VARCHAR(255) PRIMARY KEY,
  response_body JSONB, -- Store the result to return it again if retried
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);