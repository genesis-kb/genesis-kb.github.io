-- ============================================================
-- Audiobook Seed Data
-- ============================================================
-- Seed playlists and episodes into the unified schema.
-- All INSERTs use ON CONFLICT for idempotent re-runs.
--
-- To add a new playlist manually:
--   1. Copy one of the INSERT blocks below
--   2. Replace the values with your data
--   3. Set source = 'manual' (default)
--   4. Run in Supabase SQL Editor or via psql
-- ============================================================


-- ════════════════════════════════════════════════════════════════
-- PLAYLIST 1: Bitcoin Fundamentals
-- ════════════════════════════════════════════════════════════════

INSERT INTO public.audio_playlists (
  id, title, slug, description, playlist_type,
  cover_image_url, tags, status, source, difficulty_level
)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Bitcoin Fundamentals',
  'bitcoin-fundamentals',
  'A comprehensive journey through Bitcoin — from the genesis block to the Lightning Network. Perfect for newcomers who want a deep, structured understanding of how Bitcoin works and why it matters.',
  'series',
  'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=600&h=400&fit=crop',
  ARRAY['bitcoin', 'fundamentals', 'beginner'],
  'published',
  'manual',
  'beginner'
)
ON CONFLICT (id) DO UPDATE SET
  title           = EXCLUDED.title,
  slug            = EXCLUDED.slug,
  description     = EXCLUDED.description,
  cover_image_url = EXCLUDED.cover_image_url,
  tags            = EXCLUDED.tags,
  status          = EXCLUDED.status,
  difficulty_level = EXCLUDED.difficulty_level,
  updated_at      = NOW();

INSERT INTO public.audio_episodes (
  id, playlist_id, title, description, sequence_number,
  audio_url, duration_seconds, status, transcript_summary
)
VALUES
  (
    '11111111-1111-1111-1111-111111111111',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'The Genesis Block',
    'How it all began — Satoshi Nakamoto''s whitepaper, the cypherpunk movement, and the creation of the first decentralized digital currency.',
    1,
    'https://duqjdsbziertijeycmbk.supabase.co/storage/v1/object/public/audiobooks/Bitcoin%20Beginners%20Guide/Why_Bitcoin_wallets_hold_no_digital_coins%20(1).m4a',
    372,
    'pending',
    '## Key Takeaways\n\n- The Bitcoin whitepaper was published on October 31, 2008\n- The genesis block was mined on January 3, 2009\n- Satoshi embedded a headline from The Times in the coinbase transaction\n- Bitcoin solved the double-spending problem without a trusted third party'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'How Mining Works',
    'Understanding proof-of-work, hash functions, difficulty adjustment, and the economic incentives that secure the Bitcoin network.',
    2,
    'https://duqjdsbziertijeycmbk.supabase.co/storage/v1/object/public/audiobooks/Bitcoin%20Beginners%20Guide/Why_Bitcoin_wallets_hold_no_digital_coins%20(1).m4a',
    448,
    'pending',
    '## Key Takeaways\n\n- Mining uses SHA-256 hash function to find valid block hashes\n- Difficulty adjusts every 2,016 blocks (~2 weeks)\n- Block reward halves every 210,000 blocks (~4 years)\n- Mining secures the network through economic incentives'
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'Keys, Addresses & Wallets',
    'Public-key cryptography, seed phrases, HD wallets, and best practices for securing your bitcoin.',
    3,
    'https://duqjdsbziertijeycmbk.supabase.co/storage/v1/object/public/audiobooks/Bitcoin%20Beginners%20Guide/Why_Bitcoin_wallets_hold_no_digital_coins%20(1).m4a',
    395,
    'pending',
    '## Key Takeaways\n\n- Private keys are 256-bit random numbers\n- Public keys are derived from private keys using elliptic curve multiplication\n- BIP-39 mnemonic phrases provide human-readable backups\n- Hardware wallets keep private keys offline for maximum security'
  ),
  (
    '44444444-4444-4444-4444-444444444444',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'Transactions Deep Dive',
    'UTXOs, inputs, outputs, scripts, fees, and how value moves across the Bitcoin network.',
    4,
    'https://duqjdsbziertijeycmbk.supabase.co/storage/v1/object/public/audiobooks/Bitcoin%20Beginners%20Guide/Why_Bitcoin_wallets_hold_no_digital_coins%20(1).m4a',
    420,
    'pending',
    '## Key Takeaways\n\n- Bitcoin uses the UTXO model, not account balances\n- Each transaction consumes inputs and creates new outputs\n- Script (Bitcoin''s programming language) validates spending conditions\n- Transaction fees are the difference between inputs and outputs'
  ),
  (
    '55555555-5555-5555-5555-555555555555',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'The Lightning Network',
    'Layer 2 scaling, payment channels, routing, and how Lightning enables instant, low-cost Bitcoin transactions.',
    5,
    'https://duqjdsbziertijeycmbk.supabase.co/storage/v1/object/public/audiobooks/Bitcoin%20Beginners%20Guide/Why_Bitcoin_wallets_hold_no_digital_coins%20(1).m4a',
    510,
    'pending',
    '## Key Takeaways\n\n- Lightning is a Layer 2 protocol built on top of Bitcoin\n- Payment channels allow off-chain transactions between two parties\n- HTLCs (Hash Time-Locked Contracts) enable multi-hop routing\n- Lightning enables micropayments and instant settlements'
  ),
  (
    '66666666-6666-6666-6666-666666666666',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'Privacy & The Future',
    'CoinJoin, Taproot, Schnorr signatures, and the ongoing evolution of Bitcoin''s privacy and scalability features.',
    6,
    'https://duqjdsbziertijeycmbk.supabase.co/storage/v1/object/public/audiobooks/Bitcoin%20Beginners%20Guide/Why_Bitcoin_wallets_hold_no_digital_coins%20(1).m4a',
    465,
    'pending',
    '## Key Takeaways\n\n- Bitcoin is pseudonymous, not anonymous — chain analysis can link addresses\n- CoinJoin combines multiple transactions to improve privacy\n- Taproot (activated Nov 2021) makes complex scripts look like simple payments\n- Schnorr signatures enable key and signature aggregation'
  )
ON CONFLICT (id) DO UPDATE SET
  title              = EXCLUDED.title,
  description        = EXCLUDED.description,
  audio_url          = EXCLUDED.audio_url,
  duration_seconds   = EXCLUDED.duration_seconds,
  transcript_summary = EXCLUDED.transcript_summary,
  status             = EXCLUDED.status;


-- ════════════════════════════════════════════════════════════════
-- PLAYLIST 2: Bitcoin Beginners Guide
-- ════════════════════════════════════════════════════════════════

INSERT INTO public.audio_playlists (
  id, title, slug, description, playlist_type,
  cover_image_url, tags, status, source, difficulty_level
)
VALUES (
  '12345678-abcd-1234-abcd-1234567890ab',
  'Bitcoin Beginners Guide',
  'bitcoin-beginners-guide',
  'This audiobook is curated from Learn Me a Bitcoin. A complete beginner''s guide to understanding Bitcoin. Covers everything from getting started with wallets to the technical guide of how the network works.',
  'series',
  'https://images.unsplash.com/photo-1621416894569-0f39ed31d247?w=600&h=400&fit=crop',
  ARRAY['bitcoin', 'beginners', 'learn-me-a-bitcoin'],
  'published',
  'manual',
  'beginner'
)
ON CONFLICT (id) DO UPDATE SET
  title           = EXCLUDED.title,
  slug            = EXCLUDED.slug,
  description     = EXCLUDED.description,
  cover_image_url = EXCLUDED.cover_image_url,
  tags            = EXCLUDED.tags,
  status          = EXCLUDED.status,
  difficulty_level = EXCLUDED.difficulty_level,
  updated_at      = NOW();

INSERT INTO public.audio_episodes (
  id, playlist_id, title, description, sequence_number,
  audio_url, duration_seconds, status, transcript_summary
)
VALUES
  (
    'c1000000-0000-0000-0000-000000000001',
    '12345678-abcd-1234-abcd-1234567890ab',
    'Wallets: Why Bitcoin wallets hold no digital coins',
    'Learn about Wallets in Bitcoin.',
    1,
    'https://duqjdsbziertijeycmbk.supabase.co/storage/v1/object/public/audiobooks/Bitcoin%20Beginners%20Guide/Why_Bitcoin_wallets_hold_no_digital_coins%20(1).m4a',
    1404,
    'completed',
    '## Key Takeaways\n\n- Overview of Wallets'
  ),
  (
    'c2000000-0000-0000-0000-000000000002',
    '12345678-abcd-1234-abcd-1234567890ab',
    'Exchanges: How to actually own your Bitcoin',
    'Learn about Exchanges in Bitcoin.',
    2,
    'https://duqjdsbziertijeycmbk.supabase.co/storage/v1/object/public/audiobooks/Bitcoin%20Beginners%20Guide/How_to_actually_own_your_Bitcoin%20(1).m4a',
    1200,
    'completed',
    '## Key Takeaways\n\n- Overview of Exchanges'
  ),
  (
    'c3000000-0000-0000-0000-000000000003',
    '12345678-abcd-1234-abcd-1234567890ab',
    'Sending: The mechanical journey of a Bitcoin transaction',
    'Learn about Sending in Bitcoin.',
    3,
    'https://duqjdsbziertijeycmbk.supabase.co/storage/v1/object/public/audiobooks/Bitcoin%20Beginners%20Guide/The_mechanical_journey_of_a_Bitcoin_transaction%20(1).m4a',
    1402,
    'completed',
    '## Key Takeaways\n\n- Overview of Sending'
  ),
  (
    'c4000000-0000-0000-0000-000000000004',
    '12345678-abcd-1234-abcd-1234567890ab',
    'Security: First Principles of Bitcoin Security',
    'Learn about Security in Bitcoin.',
    4,
    'https://duqjdsbziertijeycmbk.supabase.co/storage/v1/object/public/audiobooks/Bitcoin%20Beginners%20Guide/First_Principles_of_Bitcoin_Security.m4a',
    1273,
    'completed',
    '## Key Takeaways\n\n- Overview of Security'
  ),
  (
    'c5000000-0000-0000-0000-000000000005',
    '12345678-abcd-1234-abcd-1234567890ab',
    'The Bitcoin Network: How Bitcoin Nodes Gossip and Verify Transactions',
    'Learn about The Bitcoin Network in Bitcoin.',
    5,
    'https://duqjdsbziertijeycmbk.supabase.co/storage/v1/object/public/audiobooks/Bitcoin%20Beginners%20Guide/How_Bitcoin_Nodes_Gossip_and_Verify_Transactions.m4a',
    1199,
    'completed',
    '## Key Takeaways\n\n- Overview of The Bitcoin Network'
  ),
  (
    'c6000000-0000-0000-0000-000000000006',
    '12345678-abcd-1234-abcd-1234567890ab',
    'Node: How individual computers run the Bitcoin network',
    'Learn about Node in Bitcoin.',
    6,
    'https://duqjdsbziertijeycmbk.supabase.co/storage/v1/object/public/audiobooks/Bitcoin%20Beginners%20Guide/How_individual_computers_run_the_Bitcoin_network%20(1).m4a',
    1027,
    'completed',
    '## Key Takeaways\n\n- Overview of Node'
  ),
  (
    'c7000000-0000-0000-0000-000000000007',
    '12345678-abcd-1234-abcd-1234567890ab',
    'Mining: How Bitcoin mining prevents double spending & The Mathematical Lottery Securing Bitcoin',
    'Learn about Mining in Bitcoin.',
    7,
    'https://duqjdsbziertijeycmbk.supabase.co/storage/v1/object/public/audiobooks/Bitcoin%20Beginners%20Guide/How_Bitcoin_mining_prevents_double_spending.m4a',
    1921,
    'completed',
    '## Key Takeaways\n\n- Overview of Mining'
  ),
  (
    'c8000000-0000-0000-0000-000000000008',
    '12345678-abcd-1234-abcd-1234567890ab',
    'The Blockchain',
    'Learn about The Blockchain in Bitcoin.',
    8,
    'https://duqjdsbziertijeycmbk.supabase.co/storage/v1/object/public/audiobooks/Bitcoin%20Beginners%20Guide/The_Mathematical_Lottery_Securing_Bitcoin_compressed.m4a',
    97,
    'completed',
    '## Key Takeaways\n\n- Overview of The Blockchain'
  ),
  (
    'c9000000-0000-0000-0000-000000000009',
    '12345678-abcd-1234-abcd-1234567890ab',
    'Blocks: The Ruthless Race for Bitcoin Blocks',
    'Learn about Blocks in Bitcoin.',
    9,
    'https://duqjdsbziertijeycmbk.supabase.co/storage/v1/object/public/audiobooks/Bitcoin%20Beginners%20Guide/The_Ruthless_Race_for_Bitcoin_Blocks.m4a',
    973,
    'completed',
    '## Key Takeaways\n\n- Overview of Blocks'
  ),
  (
    'ca000000-0000-0000-0000-000000000010',
    '12345678-abcd-1234-abcd-1234567890ab',
    'Difficulty: How Bitcoin Mining Difficulty Regulates Time',
    'Learn about Difficulty in Bitcoin.',
    10,
    'https://duqjdsbziertijeycmbk.supabase.co/storage/v1/object/public/audiobooks/Bitcoin%20Beginners%20Guide/How_Bitcoin_Mining_Difficulty_Regulates_Time_compressed.m4a',
    2725,
    'completed',
    '## Key Takeaways\n\n- Overview of Difficulty'
  ),
  (
    'cb000000-0000-0000-0000-000000000011',
    '12345678-abcd-1234-abcd-1234567890ab',
    'Transactions',
    'Learn about Transactions in Bitcoin.',
    11,
    'https://duqjdsbziertijeycmbk.supabase.co/storage/v1/object/public/audiobooks/Bitcoin%20Beginners%20Guide/Why_Bitcoin_wallets_hold_no_digital_coins%20(1).m4a',
    0,
    'pending',
    '## Key Takeaways\n\n- Overview of Transactions'
  ),
  (
    'cc000000-0000-0000-0000-000000000012',
    '12345678-abcd-1234-abcd-1234567890ab',
    'Outputs',
    'Learn about Outputs in Bitcoin.',
    12,
    'https://duqjdsbziertijeycmbk.supabase.co/storage/v1/object/public/audiobooks/Bitcoin%20Beginners%20Guide/Why_Bitcoin_wallets_hold_no_digital_coins%20(1).m4a',
    0,
    'pending',
    '## Key Takeaways\n\n- Overview of Outputs'
  ),
  (
    'cd000000-0000-0000-0000-000000000013',
    '12345678-abcd-1234-abcd-1234567890ab',
    'Locks',
    'Learn about Locks in Bitcoin.',
    13,
    'https://duqjdsbziertijeycmbk.supabase.co/storage/v1/object/public/audiobooks/Bitcoin%20Beginners%20Guide/Why_Bitcoin_wallets_hold_no_digital_coins%20(1).m4a',
    0,
    'pending',
    '## Key Takeaways\n\n- Overview of Locks'
  ),
  (
    'ce000000-0000-0000-0000-000000000014',
    '12345678-abcd-1234-abcd-1234567890ab',
    'Keys & Addresses',
    'Learn about Keys & Addresses in Bitcoin.',
    14,
    'https://duqjdsbziertijeycmbk.supabase.co/storage/v1/object/public/audiobooks/Bitcoin%20Beginners%20Guide/Why_Bitcoin_wallets_hold_no_digital_coins%20(1).m4a',
    0,
    'pending',
    '## Key Takeaways\n\n- Overview of Keys & Addresses'
  ),
  (
    'cf000000-0000-0000-0000-000000000015',
    '12345678-abcd-1234-abcd-1234567890ab',
    'Private Keys',
    'Learn about Private Keys in Bitcoin.',
    15,
    'https://duqjdsbziertijeycmbk.supabase.co/storage/v1/object/public/audiobooks/Bitcoin%20Beginners%20Guide/Why_Bitcoin_wallets_hold_no_digital_coins%20(1).m4a',
    0,
    'pending',
    '## Key Takeaways\n\n- Overview of Private Keys'
  ),
  (
    'd0000000-0000-0000-0000-000000000016',
    '12345678-abcd-1234-abcd-1234567890ab',
    'Public Keys',
    'Learn about Public Keys in Bitcoin.',
    16,
    'https://duqjdsbziertijeycmbk.supabase.co/storage/v1/object/public/audiobooks/Bitcoin%20Beginners%20Guide/Why_Bitcoin_wallets_hold_no_digital_coins%20(1).m4a',
    0,
    'pending',
    '## Key Takeaways\n\n- Overview of Public Keys'
  ),
  (
    'd1000000-0000-0000-0000-000000000017',
    '12345678-abcd-1234-abcd-1234567890ab',
    'Digital Signatures',
    'Learn about Digital Signatures in Bitcoin.',
    17,
    'https://duqjdsbziertijeycmbk.supabase.co/storage/v1/object/public/audiobooks/Bitcoin%20Beginners%20Guide/Why_Bitcoin_wallets_hold_no_digital_coins%20(1).m4a',
    0,
    'pending',
    '## Key Takeaways\n\n- Overview of Digital Signatures'
  ),
  (
    'd2000000-0000-0000-0000-000000000018',
    '12345678-abcd-1234-abcd-1234567890ab',
    'SegWit',
    'Learn about SegWit in Bitcoin.',
    18,
    'https://duqjdsbziertijeycmbk.supabase.co/storage/v1/object/public/audiobooks/Bitcoin%20Beginners%20Guide/Why_Bitcoin_wallets_hold_no_digital_coins%20(1).m4a',
    0,
    'pending',
    '## Key Takeaways\n\n- Overview of SegWit'
  )
ON CONFLICT (id) DO UPDATE SET
  title              = EXCLUDED.title,
  description        = EXCLUDED.description,
  audio_url          = EXCLUDED.audio_url,
  duration_seconds   = EXCLUDED.duration_seconds,
  transcript_summary = EXCLUDED.transcript_summary,
  status             = EXCLUDED.status;
