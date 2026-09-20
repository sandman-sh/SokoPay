-- SokoPay Schema Migration for Supabase
-- Creates isolated, dedicated tables for SokoPay Social Commerce Escrow

CREATE TABLE IF NOT EXISTS public.sokopay_deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_ref VARCHAR(32) NOT NULL UNIQUE,
    deal_id_hash VARCHAR(66),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    image_url TEXT,
    seller_handle VARCHAR(64) NOT NULL,
    carrier VARCHAR(64) DEFAULT 'Standard Courier',
    buyer_address VARCHAR(42),
    seller_address VARCHAR(42),
    token_address VARCHAR(42) NOT NULL,
    token_symbol VARCHAR(16) NOT NULL,
    amount NUMERIC(36, 18) NOT NULL,
    fee_amount NUMERIC(36, 18) DEFAULT 0,
    net_amount NUMERIC(36, 18) DEFAULT 0,
    status VARCHAR(32) DEFAULT 'Created',
    tracking_ref VARCHAR(128) DEFAULT '',
    dispatched_at BIGINT DEFAULT 0,
    delivery_days INT DEFAULT 3,
    tx_hash VARCHAR(66),
    auto_settled BOOLEAN DEFAULT FALSE,
    settled_at TIMESTAMPTZ,
    settlement_tx VARCHAR(66),
    settlement_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sokopay_merchants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    handle VARCHAR(64) NOT NULL UNIQUE,
    display_name VARCHAR(128) NOT NULL,
    location VARCHAR(128),
    phone VARCHAR(32),
    rating NUMERIC(3, 2) DEFAULT 5.0,
    total_deals INT DEFAULT 0,
    dispute_rate VARCHAR(16) DEFAULT '0%',
    verified BOOLEAN DEFAULT FALSE,
    wallet_address VARCHAR(42),
    bio TEXT,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sokopay_carrier_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_ref VARCHAR(32) NOT NULL,
    carrier VARCHAR(64) NOT NULL,
    tracking_ref VARCHAR(128) NOT NULL,
    status VARCHAR(32) NOT NULL,
    location VARCHAR(128),
    milestone_title VARCHAR(255),
    verified_by_oracle BOOLEAN DEFAULT FALSE,
    oracle_attestation_hash VARCHAR(66),
    raw_payload JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed Initial Verified Social Merchants
INSERT INTO public.sokopay_merchants (handle, display_name, location, phone, rating, total_deals, dispute_rate, verified, wallet_address, bio)
VALUES
    ('lagos_kicks', 'Lagos Kicks & Streetwear', 'Lagos, Nigeria', '+2348012345678', 4.9, 38, '0%', true, '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', 'Authentic streetwear, sneakers & limited drops verified on Celo.'),
    ('nairobi_crafts', 'Nairobi Leather Artisans', 'Nairobi, Kenya', '+254712345678', 5.0, 64, '0%', true, '0x90F79bf6EB2c4f870365E785982E1f101E93b906', 'Handcrafted leather goods, bags & travel accessories.'),
    ('creatives_ke', 'Pixel & Vector Studios', 'Remote / Global', '+254799887766', 4.8, 21, '0%', true, '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', 'Digital brand assets, vectors & visual design deliverables.')
ON CONFLICT (handle) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    location = EXCLUDED.location,
    phone = EXCLUDED.phone,
    rating = EXCLUDED.rating,
    total_deals = EXCLUDED.total_deals,
    verified = EXCLUDED.verified,
    wallet_address = EXCLUDED.wallet_address,
    updated_at = NOW();

-- Seed initial deal SKP-8821
INSERT INTO public.sokopay_deals (deal_ref, title, description, image_url, seller_handle, carrier, buyer_address, seller_address, token_address, token_symbol, amount, fee_amount, net_amount, status, delivery_days)
VALUES
    ('SKP-8821', 'Air Jordan 4 Retro (Size 43)', 'Authentic sneakers with original box, Lagos courier delivery', 'https://images.unsplash.com/photo-1552346154-21d32810aba3?w=500&auto=format&fit=crop&q=60', 'lagos_kicks', 'GIG Logistics', '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', '0x5FbDB2315678afecb367f032d93F642f64180aa3', 'cUSD', 65, 0.325, 64.675, 'Funded', 3)
ON CONFLICT (deal_ref) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    status = EXCLUDED.status,
    updated_at = NOW();
