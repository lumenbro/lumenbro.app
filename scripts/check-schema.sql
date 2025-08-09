-- Check existing database schema and constraints

-- List all tables
\dt

-- Check turnkey_wallets table structure
\d turnkey_wallets

-- Check users table structure  
\d users

-- Check referrals table structure
\d referrals

-- Check founders table structure
\d founders

-- Check constraints on turnkey_wallets
SELECT 
    tc.constraint_name, 
    tc.constraint_type, 
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    LEFT JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.table_name='turnkey_wallets';

-- Check indexes on turnkey_wallets
SELECT 
    indexname, 
    indexdef 
FROM pg_indexes 
WHERE tablename = 'turnkey_wallets';

-- Check if the unique constraint exists
SELECT 
    conname,
    contype,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'turnkey_wallets'::regclass;







