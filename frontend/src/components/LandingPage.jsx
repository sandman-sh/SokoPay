import React from 'react';
import {
  Wallet,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  ExternalLink,
  Layers,
  Sun,
  Moon,
  Zap,
  Globe,
  Truck,
  CheckCircle2,
  Lock,
  Smartphone,
  Coins,
} from 'lucide-react';

export default function LandingPage({
  onConnect,
  connecting,
  networkInfo,
  dealsCount = 0,
  onOpenAudit,
  toggleLightDarkMode,
  isDarkMode,
  toggleAccent,
  accentMode: _accentMode,
}) {
  const escrowAddress = networkInfo?.activeNetwork?.escrowAddress || '0x8689F95860A33611bCa3A8AEd41Cc501298727AF';
  const oracleAddress = networkInfo?.activeNetwork?.oracleAddress || '0x99ac8364da2D532045e44958c9D8820C621C496a';
  const explorerUrl = networkInfo?.activeNetwork?.explorerUrl || 'https://celoscan.io';

  return (
    <div className="hydra-container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Technical Navbar */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: '20px',
          borderBottom: '1px solid var(--border-hairline)',
          marginBottom: '36px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className="hydra-indicator" />
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '1.25rem', letterSpacing: '0.06em' }}>
            SOKOPAY
          </span>
          <span className="mono-tag mono-tag-accent">CELO L2</span>
          <span className="mono-tag">MINIPAY</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Mainnet Live Status */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              border: '1px solid var(--border-hairline)',
              padding: '6px 10px',
              background: 'var(--bg-highlight)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.68rem',
            }}
          >
            <span className="hydra-indicator" style={{ background: '#10b981', margin: 0 }} />
            <span style={{ color: '#10b981', fontWeight: 600 }}>CELO MAINNET (42220)</span>
          </div>

          {/* Audit Modal Button */}
          <button
            onClick={onOpenAudit}
            className="btn-hydra-ghost"
            style={{ padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            title="Inspect onchain contracts & architecture"
          >
            <Layers size={13} />
            <span style={{ fontSize: '0.68rem' }}>AUDIT & DOCS</span>
          </button>

          {/* Theme Toggles */}
          <button
            onClick={toggleLightDarkMode}
            className="btn-hydra-ghost"
            style={{ padding: '6px 10px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            title={isDarkMode ? 'Switch to White Mode' : 'Switch to Dark Mode'}
            id="landing-theme-toggle"
          >
            {isDarkMode ? <Sun size={13} color="var(--accent-primary)" /> : <Moon size={13} />}
          </button>

          <button
            onClick={toggleAccent}
            className="btn-hydra-ghost"
            style={{ padding: '6px 10px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            title="Toggle Color Palette"
          >
            <Zap size={13} color="var(--accent-primary)" />
          </button>

          {/* Connect Wallet Button */}
          <button
            onClick={onConnect}
            disabled={connecting}
            className="btn-hydra-primary"
            style={{
              padding: '8px 18px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.75rem',
            }}
            id="landing-connect-wallet-btn"
          >
            <Wallet size={14} />
            <span>{connecting ? 'CONNECTING...' : 'CONNECT WALLET'}</span>
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section style={{ marginBottom: '48px', paddingTop: '16px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
          <span className="hydra-indicator" />
          <span className="mono-tag mono-tag-accent" style={{ padding: '4px 10px', fontSize: '0.7rem' }}>
            ⚡ VERIFIED ON CELO MAINNET • ERC-8021 ATTRIBUTION READY
          </span>
        </div>

        <h1
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'clamp(2.3rem, 6vw, 4rem)',
            fontWeight: 800,
            lineHeight: 1.08,
            letterSpacing: '-0.04em',
            marginBottom: '20px',
            maxWidth: '960px',
          }}
        >
          Trustless Social Commerce Escrow on Celo.
        </h1>

        <p
          style={{
            color: 'var(--text-steel)',
            fontSize: '1.12rem',
            maxWidth: '780px',
            lineHeight: 1.65,
            marginBottom: '32px',
          }}
        >
          Buy and sell safely on WhatsApp, Instagram, and Telegram. Non-custodial smart contracts hold cUSD, USDT, and USDC in escrow. Funds release automatically upon verified courier delivery via autonomous logistics oracles.
        </p>

        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '32px' }}>
          <button
            onClick={onConnect}
            disabled={connecting}
            className="btn-hydra-primary"
            style={{
              padding: '14px 28px',
              fontSize: '0.85rem',
              gap: '10px',
              boxShadow: '0 0 25px var(--accent-glow)',
            }}
            id="hero-connect-wallet-btn"
          >
            <Wallet size={16} />
            <span>{connecting ? 'INITIALIZING WALLET...' : 'CONNECT WALLET TO LAUNCH APP'}</span>
            <ArrowRight size={15} />
          </button>

          <a
            href={`${explorerUrl}/address/${escrowAddress}`}
            target="_blank"
            rel="noreferrer"
            className="btn-hydra-ghost"
            style={{ padding: '13px 22px', fontSize: '0.82rem', textDecoration: 'none' }}
          >
            <ExternalLink size={14} />
            <span>CELOSCAN CONTRACT</span>
          </a>

          <button
            onClick={onOpenAudit}
            className="btn-hydra-ghost"
            style={{ padding: '13px 22px', fontSize: '0.82rem' }}
          >
            <Layers size={14} />
            <span>HOW IT WORKS</span>
          </button>
        </div>

        {/* Value Assurance Badges */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="mono-tag">
            <Lock size={12} color="var(--accent-primary)" /> Non-Custodial Escrow
          </span>
          <span className="mono-tag">
            <Truck size={12} color="#10b981" /> Real Logistics Webhooks
          </span>
          <span className="mono-tag">
            <Sparkles size={12} color="#38bdf8" /> SokoBot AI Deals
          </span>
          <span className="mono-tag">
            <Coins size={12} color="var(--accent-primary)" /> 0.5% Protocol Fee
          </span>
          <span className="mono-tag">
            <Smartphone size={12} color="#a855f7" /> Opera MiniPay Native
          </span>
        </div>
      </section>

      {/* Real-time Protocol Telemetry Grid */}
      <div className="metric-grid" style={{ marginBottom: '48px' }}>
        <div className="metric-cell">
          <div className="metric-value">{dealsCount}</div>
          <div className="metric-caption">Onchain Deals Deployed</div>
        </div>
        <div className="metric-cell">
          <div className="metric-value" style={{ fontSize: '1.25rem' }}>
            {escrowAddress.slice(0, 6)}...{escrowAddress.slice(-4)}
          </div>
          <div className="metric-caption">Celo SokoEscrow Contract</div>
        </div>
        <div className="metric-cell">
          <div className="metric-value" style={{ fontSize: '1.25rem' }}>
            {oracleAddress.slice(0, 6)}...{oracleAddress.slice(-4)}
          </div>
          <div className="metric-caption">Registered SokoAgentOracle</div>
        </div>
        <div className="metric-cell">
          <div className="metric-value">0.5%</div>
          <div className="metric-caption">Transparent Settlement Fee</div>
        </div>
      </div>

      {/* Section: How SokoPay Works (Interactive 4-Step Architecture) */}
      <section style={{ marginBottom: '56px' }}>
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span className="hydra-indicator" />
            <span className="hydra-label">01 / ARCHITECTURAL WORKFLOW</span>
          </div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            How Decentralized Social Commerce Works
          </h2>
          <p style={{ color: 'var(--text-steel)', fontSize: '0.92rem', marginTop: '4px' }}>
            Complete peer-to-peer security powered by Celo L2 OP Stack, smart contracts, and real courier telemetry.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '16px',
          }}
        >
          {/* Step 1 */}
          <div className="hydra-card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span className="mono-tag mono-tag-accent">STEP 01</span>
              <Sparkles size={18} color="var(--accent-primary)" />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '8px' }}>
              AI Invoice Generation
            </h3>
            <p style={{ color: 'var(--text-steel)', fontSize: '0.84rem', lineHeight: 1.55, flex: 1 }}>
              Merchant prompts SokoBot via natural language or fills a simple invoice form. SokoPay creates an immutable smart contract deal with a defined delivery timeline.
            </p>
            <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-hairline)', paddingTop: '10px' }}>
              <span className="mono-tag" style={{ fontSize: '0.62rem' }}>
                ERC-8021 CALLED DATA
              </span>
            </div>
          </div>

          {/* Step 2 */}
          <div className="hydra-card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span className="mono-tag mono-tag-accent">STEP 02</span>
              <Lock size={18} color="#38bdf8" />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '8px' }}>
              Smart Escrow Lock
            </h3>
            <p style={{ color: 'var(--text-steel)', fontSize: '0.84rem', lineHeight: 1.55, flex: 1 }}>
              Buyer connects Opera MiniPay or Web3 wallet. Stablecoins (cUSD, USDT, USDC) are locked directly inside the <code style={{ color: 'var(--accent-primary)' }}>SokoEscrow.sol</code> contract.
            </p>
            <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-hairline)', paddingTop: '10px' }}>
              <span className="mono-tag" style={{ fontSize: '0.62rem' }}>
                NON-CUSTODIAL VAULT
              </span>
            </div>
          </div>

          {/* Step 3 */}
          <div className="hydra-card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span className="mono-tag mono-tag-accent">STEP 03</span>
              <Truck size={18} color="#f59e0b" />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '8px' }}>
              Courier Dispatch & Tracking
            </h3>
            <p style={{ color: 'var(--text-steel)', fontSize: '0.84rem', lineHeight: 1.55, flex: 1 }}>
              Seller hands package to verified regional couriers (GIG Logistics, Sendy, DHL). Real-time tracking webhooks stream milestone updates to Supabase and buyers.
            </p>
            <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-hairline)', paddingTop: '10px' }}>
              <span className="mono-tag" style={{ fontSize: '0.62rem' }}>
                LIVE WEBHOOK TELEMETRY
              </span>
            </div>
          </div>

          {/* Step 4 */}
          <div className="hydra-card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span className="mono-tag mono-tag-accent">STEP 04</span>
              <CheckCircle2 size={18} color="#10b981" />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '8px' }}>
              Oracle Attestation & Payout
            </h3>
            <p style={{ color: 'var(--text-steel)', fontSize: '0.84rem', lineHeight: 1.55, flex: 1 }}>
              Upon recipient signature, <code style={{ color: '#10b981' }}>SokoAgentOracle.sol</code> attests the delivery proof onchain. Escrow releases 99.5% payout directly to seller.
            </p>
            <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-hairline)', paddingTop: '10px' }}>
              <span className="mono-tag" style={{ fontSize: '0.62rem' }}>
                INSTANT SUB-SECOND SETTLEMENT
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Section: Core Pillars / Technology */}
      <section style={{ marginBottom: '56px' }}>
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span className="hydra-indicator" />
            <span className="hydra-label">02 / CORE PROTOCOL PILLARS</span>
          </div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Why SokoPay on Celo L2
          </h2>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '16px',
          }}
        >
          <div className="hydra-card">
            <Smartphone size={22} color="var(--accent-primary)" style={{ marginBottom: '12px' }} />
            <h4 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '6px' }}>Opera MiniPay Integration</h4>
            <p style={{ color: 'var(--text-steel)', fontSize: '0.82rem', lineHeight: 1.5 }}>
              Engineered specifically for the 100M+ Opera Mini users across Africa. Frictionless onboarding with phone number authentication and instant stablecoin settlement.
            </p>
          </div>

          <div className="hydra-card">
            <ShieldCheck size={22} color="#10b981" style={{ marginBottom: '12px' }} />
            <h4 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '6px' }}>Autonomous Carrier Oracles</h4>
            <p style={{ color: 'var(--text-steel)', fontSize: '0.82rem', lineHeight: 1.5 }}>
              Physical logistics are verified cryptographically. Courier webhooks feed directly into SokoAgentOracle, preventing rogue buyers or dishonest sellers from cheating.
            </p>
          </div>

          <div className="hydra-card">
            <Zap size={22} color="#f59e0b" style={{ marginBottom: '12px' }} />
            <h4 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '6px' }}>Sub-Second Finality & Low Fees</h4>
            <p style={{ color: 'var(--text-steel)', fontSize: '0.82rem', lineHeight: 1.5 }}>
              Powered by Celo L2 OP Stack architecture. Gas fees cost less than $0.001 per transaction, paid seamlessly in stablecoins (cUSD, USDT, USDC).
            </p>
          </div>

          <div className="hydra-card">
            <Globe size={22} color="#38bdf8" style={{ marginBottom: '12px' }} />
            <h4 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '6px' }}>ERC-8021 Calldata Attribution</h4>
            <p style={{ color: 'var(--text-steel)', fontSize: '0.82rem', lineHeight: 1.5 }}>
              All onchain deals carry standard ERC-8021 attribution calldata tags (<code style={{ color: 'var(--accent-primary)' }}>celo_sokopay1234</code>) for decentralized analytics and partner tracking.
            </p>
          </div>
        </div>
      </section>

      {/* Opera MiniPay / Mobile Banner */}
      <section
        style={{
          border: '1px solid var(--accent-primary)',
          background: 'var(--bg-highlight)',
          padding: '28px 24px',
          marginBottom: '56px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '20px',
        }}
      >
        <div style={{ maxWidth: '640px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span className="hydra-indicator" style={{ background: '#10b981' }} />
            <span className="hydra-label" style={{ color: 'var(--text-white)' }}>MOBILE OPTIMIZED FOR OPERA MINIPAY</span>
          </div>
          <h3 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '8px' }}>
            Accessing from Nigeria, Kenya, Ghana, or South Africa?
          </h3>
          <p style={{ color: 'var(--text-steel)', fontSize: '0.86rem', lineHeight: 1.55 }}>
            Open this link directly inside the Opera Mini browser to connect your MiniPay wallet seamlessly. On desktop, connect using MetaMask, Rabby, or any Web3 provider.
          </p>
        </div>

        <button
          onClick={onConnect}
          disabled={connecting}
          className="btn-hydra-primary"
          style={{ padding: '12px 24px', fontSize: '0.82rem', gap: '8px' }}
        >
          <Smartphone size={15} />
          <span>{connecting ? 'CONNECTING...' : 'CONNECT MINIPAY / WEB3'}</span>
        </button>
      </section>

      {/* Supported Wallets Row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          padding: '16px',
          border: '1px solid var(--border-hairline)',
          background: 'var(--bg-card)',
          marginBottom: '48px',
          flexWrap: 'wrap',
          fontSize: '0.72rem',
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-graphite)',
        }}
      >
        <span>SUPPORTED WALLETS:</span>
        <span style={{ color: 'var(--text-white)' }}>Opera MiniPay</span>
        <span>•</span>
        <span style={{ color: 'var(--text-white)' }}>MetaMask</span>
        <span>•</span>
        <span style={{ color: 'var(--text-white)' }}>Valora Celo</span>
        <span>•</span>
        <span style={{ color: 'var(--text-white)' }}>Rabby Wallet</span>
        <span>•</span>
        <span style={{ color: 'var(--text-white)' }}>Coinbase Wallet</span>
      </div>

      {/* Bottom CTA Block */}
      <div
        className="hydra-card"
        style={{
          textAlign: 'center',
          padding: '48px 20px',
          marginBottom: '48px',
          background: 'var(--bg-surface)',
        }}
      >
        <span className="mono-tag mono-tag-accent" style={{ marginBottom: '14px' }}>
          DECENTRALIZED SOCIAL COMMERCE
        </span>
        <h2 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '12px', letterSpacing: '-0.03em' }}>
          Ready to trade without counterparty risk?
        </h2>
        <p style={{ color: 'var(--text-steel)', maxWidth: '560px', margin: '0 auto 28px', fontSize: '0.92rem' }}>
          Connect your Web3 or Opera MiniPay wallet to unlock the full SokoPay decentralized dashboard, create invoices, and manage onchain escrow settlements.
        </p>
        <button
          onClick={onConnect}
          disabled={connecting}
          className="btn-hydra-primary"
          style={{ padding: '14px 32px', fontSize: '0.88rem', gap: '8px' }}
          id="cta-bottom-connect-btn"
        >
          <Wallet size={16} />
          <span>{connecting ? 'CONNECTING WALLET...' : 'CONNECT WALLET TO ENTER APP'}</span>
        </button>
      </div>

      {/* Footer */}
      <footer
        style={{
          marginTop: 'auto',
          paddingTop: '24px',
          paddingBottom: '24px',
          borderTop: '1px solid var(--border-hairline)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          fontSize: '0.72rem',
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-graphite)',
        }}
      >
        <div>
          SOKOPAY PROTOCOL © 2026 • BUILT FOR CELO L2 (42220) • ERC-8021
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <a
            href={`${explorerUrl}/address/${escrowAddress}`}
            target="_blank"
            rel="noreferrer"
            style={{ color: 'var(--text-steel)', textDecoration: 'none' }}
          >
            CELOSCAN ESCROW
          </a>
          <a
            href={`${explorerUrl}/address/${oracleAddress}`}
            target="_blank"
            rel="noreferrer"
            style={{ color: 'var(--text-steel)', textDecoration: 'none' }}
          >
            CELOSCAN ORACLE
          </a>
          <span style={{ cursor: 'pointer', color: 'var(--accent-primary)' }} onClick={onOpenAudit}>
            SYSTEM ARCHITECTURE
          </span>
        </div>
      </footer>
    </div>
  );
}
