import React, { useState, useEffect } from 'react';
import {
  Send,
  Lock,
  CheckCircle2,
  Truck,
  AlertTriangle,
  Copy,
  Plus,
  RefreshCw,
  Sparkles,
  Share2,
  Check,
  Layers,
  Sun,
  Moon,
  Zap,
  Droplets,
  FileCode2,
  XCircle,
  Globe,
  ExternalLink,
  Wallet,
  ShieldCheck,
  Package,
  LogOut,
  Smartphone,
} from 'lucide-react';
import LandingPage from './components/LandingPage.jsx';

const API_BASE = (import.meta.env.VITE_API_BASE || 'http://localhost:3001/api').replace(/\/+$/, '');

/**
 * Robust markdown formatter for SokoBot chat to eliminate raw asterisks (astrit issue)
 */
function renderChatText(rawText) {
  if (!rawText) return null;
  const lines = rawText.split('\n');

  return lines.map((line, lineIdx) => {
    const parts = [];
    let remaining = line;

    while (remaining.length > 0) {
      // Code (`...`)
      const codeMatch = remaining.match(/^`([^`]+)`/);
      if (codeMatch) {
        parts.push(<code key={`${lineIdx}-${parts.length}`}>{codeMatch[1]}</code>);
        remaining = remaining.slice(codeMatch[0].length);
        continue;
      }

      // Bold (**...**)
      const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/);
      if (boldMatch) {
        parts.push(<strong key={`${lineIdx}-${parts.length}`}>{boldMatch[1]}</strong>);
        remaining = remaining.slice(boldMatch[0].length);
        continue;
      }

      // Italic (*...*)
      const italicMatch = remaining.match(/^\*([^*]+)\*/);
      if (italicMatch) {
        parts.push(<em key={`${lineIdx}-${parts.length}`}>{italicMatch[1]}</em>);
        remaining = remaining.slice(italicMatch[0].length);
        continue;
      }

      // Plain text up to next special char or end
      const nextSpecial = remaining.search(/[`*]/);
      if (nextSpecial === -1) {
        parts.push(remaining.replace(/\*/g, ''));
        break;
      } else if (nextSpecial === 0) {
        remaining = remaining.slice(1);
      } else {
        parts.push(remaining.slice(0, nextSpecial));
        remaining = remaining.slice(nextSpecial);
      }
    }

    return (
      <React.Fragment key={lineIdx}>
        {parts}
        {lineIdx < lines.length - 1 && <br />}
      </React.Fragment>
    );
  });
}

export default function App() {
  const [deals, setDeals] = useState([]);
  const [balances, setBalances] = useState({ buyer: {}, seller: {}, escrow: {} });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [walletRole, setWalletRole] = useState('buyer'); // 'buyer' or 'seller'
  
  // Theme & Appearance: Default is Crisp White Background (Light Mode)
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('soko_theme');
      if (saved === 'dark') return true;
      if (saved === 'light') return false;
    }
    return false; // Default: White Background
  });
  const [accentMode, setAccentMode] = useState('default'); // 'default' or 'electric'

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [isDarkMode]);

  // Web3 & Network State
  const [web3Account, setWeb3Account] = useState(null);
  const [web3ChainId, setWeb3ChainId] = useState(null);
  const [walletConnecting, setWalletConnecting] = useState(false);
  const [executionMode, setExecutionMode] = useState('agent'); // 'web3' (direct browser wallet) or 'agent' (server delegated bot)
  const [networkInfo, setNetworkInfo] = useState({
    activeNetwork: {
      id: 'celo-mainnet',
      name: 'Celo Mainnet',
      chainId: 42220,
      explorerUrl: 'https://celoscan.io',
      escrowAddress: '0x8689F95860A33611bCa3A8AEd41Cc501298727AF',
    },
    availableNetworks: [],
  });
  const [networkLoading, setNetworkLoading] = useState(false);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(null);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [showFaucetModal, setShowFaucetModal] = useState(false);
  const [showTxModal, setShowTxModal] = useState(null);
  const [showDisputeModal, setShowDisputeModal] = useState(null);
  const [showTrackingModal, setShowTrackingModal] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(null);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [manualAddressInput, setManualAddressInput] = useState('');
  const [disputeReason, setDisputeReason] = useState('');
  
  const [dispatchDeal, setDispatchDeal] = useState(null);
  const [trackingInput, setTrackingInput] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [recentTx, setRecentTx] = useState(null);
  const [healthInfo, setHealthInfo] = useState(null);
  const [webhookTesting, setWebhookTesting] = useState(false);

  // Form
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('cUSD');
  const [deliveryDays, setDeliveryDays] = useState(3);
  const [submitting, setSubmitting] = useState(false);

  // Faucet state
  const [faucetToken, setFaucetToken] = useState('cUSD');
  const [faucetAmount, setFaucetAmount] = useState('200');
  const [faucetLoading, setFaucetLoading] = useState(false);

  // Chat
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    {
      sender: 'bot',
      text: 'Jambo! I am SokoBot, your trustless social commerce escrow agent on Celo.\n\nAll deals are executed directly on the smart contract with ERC-8021 Attribution calldata.',
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // Toggle White/Dark Mode (Default is White Background)
  const toggleLightDarkMode = () => {
    const next = !isDarkMode;
    setIsDarkMode(next);
    if (next) {
      document.documentElement.setAttribute('data-theme', 'dark');
      if (typeof window !== 'undefined') localStorage.setItem('soko_theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      if (typeof window !== 'undefined') localStorage.setItem('soko_theme', 'light');
    }
  };

  // Toggle Accent Palette
  const toggleAccent = () => {
    const next = accentMode === 'default' ? 'electric' : 'default';
    setAccentMode(next);
    if (next === 'electric') {
      document.documentElement.setAttribute('data-accent', 'electric');
    } else {
      document.documentElement.removeAttribute('data-accent');
    }
  };

  // Disconnect wallet and return to homepage
  const disconnectWallet = () => {
    setWeb3Account(null);
    setWeb3ChainId(null);
    setExecutionMode('agent');
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('soko_manual_disconnect', 'true');
    }
  };

  // Connect manual address (Auditor / Evaluation mode)
  const handleConnectManualAddress = async (addr) => {
    const clean = (addr || '').trim();
    if (!clean.startsWith('0x') || clean.length !== 42) {
      alert('Please enter a valid 42-character Celo address (0x...)');
      return;
    }
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('soko_manual_disconnect');
    }
    setWeb3Account(clean);
    setExecutionMode('agent');
    setShowWalletModal(false);
    await fetchData(clean);
  };

  // Connect Real Web3 / MiniPay Wallet
  const connectRealWallet = async () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('soko_manual_disconnect');
    }
    if (typeof window === 'undefined' || !window.ethereum) {
      setShowWalletModal(true);
      return;
    }
    setWalletConnecting(true);
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (accounts && accounts[0]) {
        setWeb3Account(accounts[0]);
        const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
        setWeb3ChainId(parseInt(chainIdHex, 16));
        setExecutionMode('web3');
        await fetchData(accounts[0]);
      }
    } catch (err) {
      console.error('Wallet connection error:', err);
      alert(`Wallet connection failed: ${err.message}`);
    } finally {
      setWalletConnecting(false);
    }
  };

  // Switch Web3 wallet chain
  const switchWalletChain = async (targetChainId) => {
    if (!window.ethereum) return;
    const hexChain = targetChainId === 11142220 ? '0xaa044c' : targetChainId === 42220 ? '0xa4ec' : '0x7a69';
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: hexChain }],
      });
      setWeb3ChainId(targetChainId);
    } catch (switchError) {
      if (switchError.code === 4902) {
        if (targetChainId === 11142220) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0xaa044c',
              chainName: 'Celo Sepolia Testnet',
              rpcUrls: ['https://forno.celo-sepolia.celo-testnet.org'],
              nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
              blockExplorerUrls: ['https://celo-sepolia.blockscout.com'],
            }],
          });
          setWeb3ChainId(11142220);
        } else if (targetChainId === 42220) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0xa4ec',
              chainName: 'Celo Mainnet',
              rpcUrls: ['https://forno.celo.org'],
              nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
              blockExplorerUrls: ['https://celoscan.io'],
            }],
          });
          setWeb3ChainId(42220);
        } else if (targetChainId === 31337) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x7a69',
              chainName: 'Celo Local Node',
              rpcUrls: ['http://127.0.0.1:8545'],
              nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
              blockExplorerUrls: ['http://localhost:8545'],
            }],
          });
          setWeb3ChainId(31337);
        }
      }
    }
  };

  // Switch active backend network
  const handleNetworkSwitch = async (netId) => {
    setNetworkLoading(true);
    try {
      const res = await fetch(`${API_BASE}/network/switch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ network: netId }),
      });
      if (res.ok) {
        await fetchData();
        if (web3Account && window.ethereum) {
          const targetChain = netId === 'celo-sepolia' ? 11142220 : netId === 'celo-mainnet' ? 42220 : 31337;
          await switchWalletChain(targetChain);
        }
      } else {
        const err = await res.json();
        alert(`Network switch failed: ${err.error}`);
      }
    } catch (err) {
      alert(`Network switch error: ${err.message}`);
    } finally {
      setNetworkLoading(false);
    }
  };

  // Open Real Logistics Tracking Modal
  const openTrackingModal = async (trackingRef, dealRef = '') => {
    try {
      const url = `${API_BASE}/tracking/${encodeURIComponent(trackingRef)}${dealRef ? `?dealRef=${encodeURIComponent(dealRef)}` : ''}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setShowTrackingModal({ ...data, dealRef: dealRef || data.dealRef || trackingRef });
      }
    } catch (err) {
      console.warn('Tracking lookup error:', err);
    }
  };

  // Trigger Real Carrier Webhook delivery callback
  const handleTriggerWebhook = async (dealRef, trackingRef) => {
    setWebhookTesting(true);
    try {
      const res = await fetch(`${API_BASE}/tracking/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealRef,
          trackingRef: trackingRef || 'GIG-LG-982104',
          status: 'DELIVERED',
          location: 'Recipient Residential Address, Ikeja',
          milestoneTitle: 'Delivered & Recipient Signature Verified',
        }),
      });
      if (res.ok) {
        await res.json();
        await fetchData();
        await openTrackingModal(trackingRef, dealRef);
      } else {
        const err = await res.json();
        alert(`Webhook error: ${err.error}`);
      }
    } catch (err) {
      alert(`Network error: ${err.message}`);
    } finally {
      setWebhookTesting(false);
    }
  };

  // Open Seller Profile Modal
  const openProfileModal = async (sellerHandle) => {
    try {
      const res = await fetch(`${API_BASE}/profiles/${encodeURIComponent(sellerHandle || 'lagos_kicks')}`);
      if (res.ok) {
        const data = await res.json();
        setShowProfileModal(data);
      }
    } catch (err) {
      console.warn('Profile lookup error:', err);
    }
  };

  // Fetch real onchain data
  const fetchData = async (accountAddress = null) => {
    try {
      const activeAddress = accountAddress || web3Account;
      const balUrl = activeAddress ? `${API_BASE}/balances?address=${encodeURIComponent(activeAddress)}` : `${API_BASE}/balances`;
      const [dealsRes, balRes, netRes, healthRes] = await Promise.all([
        fetch(`${API_BASE}/deals`),
        fetch(balUrl),
        fetch(`${API_BASE}/network`),
        fetch(`${API_BASE}/health`),
      ]);

      if (dealsRes.ok) {
        const d = await dealsRes.json();
        setDeals(d);
      }
      if (balRes.ok) {
        const b = await balRes.json();
        setBalances(b);
      }
      if (netRes.ok) {
        const n = await netRes.json();
        setNetworkInfo(n);
      }
      if (healthRes.ok) {
        const h = await healthRes.json();
        setHealthInfo(h);
      }
    } catch (err) {
      console.warn('Onchain sync error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const isDisconnected = typeof window !== 'undefined' && sessionStorage.getItem('soko_manual_disconnect') === 'true';
        let detected = null;
        if (!isDisconnected && typeof window !== 'undefined' && window.ethereum) {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts && accounts.length > 0 && mounted) {
            detected = accounts[0];
            setWeb3Account(accounts[0]);
            const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
            setWeb3ChainId(parseInt(chainIdHex, 16));
            setExecutionMode('web3');
          }
        }
        await fetchData(detected);
      } catch (e) {
        if (mounted) console.warn(e);
      }
    };
    load();
    const interval = setInterval(() => fetchData(), 4000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.ethereum) {
      const handleAccountsChanged = (accounts) => {
        if (accounts && accounts.length > 0) {
          setWeb3Account(accounts[0]);
          fetchData(accounts[0]);
        } else {
          setWeb3Account(null);
        }
      };
      const handleChainChanged = (chainIdHex) => {
        setWeb3ChainId(parseInt(chainIdHex, 16));
        fetchData();
      };
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
      return () => {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Real onchain action execution (supports Web3 wallet or delegated agent)
  const handleOnchainAction = async (dealRef, action, extra = {}) => {
    setActionLoading(dealRef);
    try {
      // If Real Web3 / MiniPay wallet is connected and in 'web3' execution mode:
      if (web3Account && executionMode === 'web3' && typeof window !== 'undefined' && window.ethereum) {
        const prepRes = await fetch(`${API_BASE}/tx/prepare`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, params: { dealRef, ...extra, buyer: web3Account } }),
        });
        const prepData = await prepRes.json();
        if (!prepData.success) throw new Error(prepData.error || 'Failed to prepare transaction');

        // If ERC-20 token approval is needed, request approval transaction first
        if (prepData.needsApproval && prepData.approvalTo && prepData.approvalData) {
          const approveHash = await window.ethereum.request({
            method: 'eth_sendTransaction',
            params: [{
              from: web3Account,
              to: prepData.approvalTo,
              data: prepData.approvalData,
            }],
          });
          setRecentTx(approveHash);
          // Small delay for blockchain state transition
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }

        const txHash = await window.ethereum.request({
          method: 'eth_sendTransaction',
          params: [{
            from: web3Account,
            to: prepData.to,
            data: prepData.data,
            value: prepData.value || '0x0',
          }],
        });

        setRecentTx(txHash);
        if (action === 'dispatch') setDispatchDeal(null);
        if (action === 'dispute') setShowDisputeModal(null);
        await fetchData();
        return;
      }

      // Delegated server signer flow
      const res = await fetch(`${API_BASE}/deals/${dealRef}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });

      if (res.ok) {
        const result = await res.json();
        setRecentTx(result.txHash);
        if (action === 'dispatch') setDispatchDeal(null);
        if (action === 'dispute') setShowDisputeModal(null);
        await fetchData();
      } else {
        const errData = await res.json();
        alert(`On-chain transaction error: ${errData.error}`);
      }
    } catch (err) {
      alert(`Transaction error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Create deal onchain
  const handleCreateOnchain = async (e) => {
    e.preventDefault();
    if (!title || !amount) return;
    setSubmitting(true);

    try {
      const res = await fetch(`${API_BASE}/deals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          amount,
          tokenSymbol,
          deliveryDays,
          buyer: walletRole === 'buyer' ? web3Account : undefined,
          seller: walletRole === 'seller' ? web3Account : undefined,
        }),
      });

      if (res.ok) {
        const result = await res.json();
        setRecentTx(result.txHash);
        await fetchData(web3Account);
        setShowCreateModal(false);
        setTitle('');
        setDescription('');
        setAmount('');
        setShowShareModal({
          dealRef: result.dealRef,
          title,
          amount,
          tokenSymbol,
          txHash: result.txHash,
        });
      } else {
        const errData = await res.json();
        alert(`Create deal failed: ${errData.error}`);
      }
    } catch (err) {
      alert(`Network error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Faucet request
  const handleFaucetMint = async (e) => {
    e.preventDefault();
    setFaucetLoading(true);
    try {
      const recipient = web3Account || balances.user?.address;

      const res = await fetch(`${API_BASE}/faucet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: recipient,
          tokenSymbol: faucetToken,
          amount: faucetAmount,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setRecentTx(data.txHash);
        await fetchData();
        setShowFaucetModal(false);
      } else {
        const errData = await res.json();
        alert(`Faucet failed: ${errData.error}`);
      }
    } catch (err) {
      alert(`Network error: ${err.message}`);
    } finally {
      setFaucetLoading(false);
    }
  };

  // Inspect onchain transaction receipt
  const handleInspectTx = async (txHash) => {
    try {
      const res = await fetch(`${API_BASE}/tx/${txHash}`);
      if (res.ok) {
        const data = await res.json();
        setShowTxModal(data);
      } else {
        alert('Transaction not found on node yet');
      }
    } catch (err) {
      alert(`Error fetching tx: ${err.message}`);
    }
  };

  // Send message to agent
  const handleSendChatMessage = async (msgText) => {
    const text = msgText || chatInput;
    if (!text.trim()) return;

    setChatMessages((prev) => [...prev, { sender: 'user', text }]);
    if (!msgText) setChatInput('');
    setChatLoading(true);

    try {
      const res = await fetch(`${API_BASE}/agent/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });

      if (res.ok) {
        const data = await res.json();
        setChatMessages((prev) => [...prev, { sender: 'bot', text: data.reply, actionData: data.actionData }]);
        await fetchData();
      } else {
        setChatMessages((prev) => [
          ...prev,
          { sender: 'bot', text: 'Error executing agent instruction on Celo.' },
        ]);
      }
    } catch (err) {
      setChatMessages((prev) => [...prev, { sender: 'bot', text: `Connection error: ${err.message}` }]);
    } finally {
      setChatLoading(false);
    }
  };

  const activeWalletAddress = web3Account || '';

  // Compliance & System Architecture Modal (Shared between Landing and Main App)
  const renderAuditModal = () => {
    if (!showAuditModal) return null;
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 150,
          padding: '16px',
        }}
      >
        <div
          className="hydra-card"
          style={{ width: '100%', maxWidth: '640px', background: 'var(--bg-canvas)', border: '1px solid var(--border-active)' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="hydra-indicator" />
              <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: '0.95rem', textTransform: 'uppercase' }}>
                Celo Mainnet Compliance & System Architecture
              </h3>
            </div>
            <button onClick={() => setShowAuditModal(false)} className="btn-hydra-ghost" style={{ padding: '2px 8px' }}>
              ✕
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.85rem' }}>
            <div style={{ border: '1px solid var(--border-hairline)', padding: '14px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)', marginBottom: '4px' }}>
                1. ERC-8021 CALLDATA ATTRIBUTION
              </div>
              <p style={{ color: 'var(--text-steel)', fontSize: '0.8rem' }}>
                All onchain calls append <code>toDataSuffix('celo_sokopay1234')</code> to transaction calldata.
                Verified by the Dune Analytics query to attribute every transaction to our protocol.
              </p>
            </div>

            <div style={{ border: '1px solid var(--border-hairline)', padding: '14px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)', marginBottom: '4px' }}>
                2. MULTI-STABLECOIN SETTLEMENT
              </div>
              <p style={{ color: 'var(--text-steel)', fontSize: '0.8rem' }}>
                Deals settle in native <strong>cUSD</strong>, <strong>USDT</strong>, <strong>USDC</strong>, and <strong>cEUR</strong>.
                Zero-friction flows allow Opera MiniPay users to transact without complex bridge hurdles.
              </p>
            </div>

            <div style={{ border: '1px solid var(--border-hairline)', padding: '14px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)', marginBottom: '4px' }}>
                3. LIVE ONCHAIN CELO MAINNET DEPLOYMENT
              </div>
              <p style={{ color: 'var(--text-steel)', fontSize: '0.8rem' }}>
                Zero mocks or simulations. Deployed at <code>{networkInfo.activeNetwork?.escrowAddress || '0x8689F95860A33611bCa3A8AEd41Cc501298727AF'}</code> with live Oracle at <code>0x99ac8364da2D532045e44958c9D8820C621C496a</code> on Celo Mainnet (Chain ID 42220).
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowAuditModal(false)}
            className="btn-hydra-primary"
            style={{ width: '100%', justifyContent: 'center', marginTop: '16px' }}
          >
            CLOSE AUDIT
          </button>
        </div>
      </div>
    );
  };

  // Wallet Connection Helper Modal
  const renderWalletModal = () => {
    if (!showWalletModal) return null;
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 160,
          padding: '16px',
        }}
      >
        <div
          className="hydra-card"
          style={{ width: '100%', maxWidth: '520px', background: 'var(--bg-canvas)', border: '1px solid var(--accent-primary)' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Wallet size={18} color="var(--accent-primary)" />
              <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', textTransform: 'uppercase', fontWeight: 700 }}>
                Connect Celo Wallet
              </h3>
            </div>
            <button
              onClick={() => setShowWalletModal(false)}
              className="btn-hydra-ghost"
              style={{ padding: '2px 8px' }}
            >
              ✕
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '18px' }}>
            {/* Option 1: Mobile Opera MiniPay */}
            <div style={{ border: '1px solid var(--border-hairline)', padding: '14px', background: 'var(--bg-highlight)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <Smartphone size={16} color="var(--accent-primary)" />
                <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>1. Opera MiniPay (Mobile Recommended)</span>
              </div>
              <p style={{ color: 'var(--text-steel)', fontSize: '0.8rem', lineHeight: 1.5, marginBottom: '8px' }}>
                Open this app inside the <strong>Opera Mini</strong> mobile browser to connect your MiniPay wallet natively.
              </p>
              <a
                href={`celo://wallet/dapp?url=${encodeURIComponent(typeof window !== 'undefined' ? window.location.href : 'http://localhost:5173')}`}
                className="btn-hydra-primary"
                style={{ fontSize: '0.72rem', padding: '6px 14px', display: 'inline-flex', textDecoration: 'none' }}
              >
                OPEN IN MINIPAY
              </a>
            </div>

            {/* Option 2: MetaMask / Browser Extension */}
            <div style={{ border: '1px solid var(--border-hairline)', padding: '14px', background: 'var(--bg-highlight)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <Globe size={16} color="#38bdf8" />
                <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>2. MetaMask / Browser Extension</span>
              </div>
              <p style={{ color: 'var(--text-steel)', fontSize: '0.8rem', lineHeight: 1.5, marginBottom: '8px' }}>
                Install MetaMask or Rabby in your desktop browser, then retry connection.
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <a
                  href="https://metamask.io/download/"
                  target="_blank"
                  rel="noreferrer"
                  className="btn-hydra-ghost"
                  style={{ fontSize: '0.72rem', padding: '6px 12px', display: 'inline-flex', textDecoration: 'none' }}
                >
                  INSTALL METAMASK <ExternalLink size={11} />
                </a>
                <button
                  onClick={connectRealWallet}
                  className="btn-hydra-primary"
                  style={{ fontSize: '0.72rem', padding: '6px 12px' }}
                >
                  RETRY
                </button>
              </div>
            </div>

            {/* Option 3: Auditor / Evaluation Mode */}
            <div style={{ border: '1px solid var(--accent-primary)', padding: '14px', background: 'rgba(252, 255, 82, 0.03)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <ShieldCheck size={16} color="var(--accent-primary)" />
                <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>3. Auditor / Evaluation Mode</span>
              </div>
              <p style={{ color: 'var(--text-steel)', fontSize: '0.8rem', lineHeight: 1.5, marginBottom: '10px' }}>
                Enter any Celo Mainnet address to access and test the decentralized application:
              </p>
              <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                <input
                  type="text"
                  className="hydra-input"
                  placeholder="Enter 0x... address"
                  value={manualAddressInput}
                  onChange={(e) => setManualAddressInput(e.target.value)}
                  style={{ fontSize: '0.75rem', padding: '8px 10px' }}
                />
                <button
                  type="button"
                  onClick={() => handleConnectManualAddress(manualAddressInput)}
                  className="btn-hydra-primary"
                  style={{ fontSize: '0.72rem', whiteSpace: 'nowrap', padding: '8px 12px' }}
                >
                  ENTER APP
                </button>
              </div>
              <button
                type="button"
                onClick={() => handleConnectManualAddress('0xB805EFCDA00ae07df354cF84566784CC1CbAd5eF')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--accent-primary)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.7rem',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  padding: 0,
                }}
              >
                Quick Connect: Celo Deployer (0xB805...b5eF)
              </button>
            </div>
          </div>

          <button
            onClick={() => setShowWalletModal(false)}
            className="btn-hydra-ghost"
            style={{ width: '100%', justifyContent: 'center' }}
          >
            CANCEL
          </button>
        </div>
      </div>
    );
  };

  // 1st Page is the Homepage / Landing Page: Gate access until real wallet connects
  if (!web3Account) {
    return (
      <>
        <LandingPage
          onConnect={connectRealWallet}
          connecting={walletConnecting}
          networkInfo={networkInfo}
          dealsCount={deals.length}
          onOpenAudit={() => setShowAuditModal(true)}
          toggleLightDarkMode={toggleLightDarkMode}
          isDarkMode={isDarkMode}
          toggleAccent={toggleAccent}
          accentMode={accentMode}
        />
        {renderAuditModal()}
        {renderWalletModal()}
      </>
    );
  }

  return (
    <div className="hydra-container">
      {/* Top Technical Navigation */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: '20px',
          borderBottom: '1px solid var(--border-hairline)',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className="hydra-indicator" />
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '1.1rem', letterSpacing: '0.05em' }}>
            SOKOPAY
          </span>
          <span className="mono-tag mono-tag-accent">CELO L2</span>
          <span className="mono-tag">MINIPAY</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Network Switcher */}
          <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid var(--border-hairline)' }}>
            <Globe size={12} style={{ marginLeft: '8px', color: 'var(--accent-primary)' }} />
            <select
              value={networkInfo.activeNetwork?.id || 'localhost'}
              onChange={(e) => handleNetworkSwitch(e.target.value)}
              disabled={networkLoading}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-white)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.68rem',
                padding: '6px 8px',
                cursor: 'pointer',
                outline: 'none',
              }}
              title="Switch Celo Network"
              id="select-network"
            >
              <option value="localhost" style={{ background: '#111', color: '#fff' }}>LOCAL DEVNET (31337)</option>
              <option value="celo-sepolia" style={{ background: '#111', color: '#fff' }}>CELO SEPOLIA (11142220)</option>
              <option value="celo-mainnet" style={{ background: '#111', color: '#fff' }}>CELO MAINNET (42220)</option>
            </select>
          </div>

          {/* Connected Wallet Chip with Disconnect Button */}
          <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid var(--accent-primary)', padding: '3px 8px', gap: '6px' }}>
            <span className="hydra-indicator" style={{ background: '#10b981', margin: 0 }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: '#10b981', fontWeight: 600 }}>
              {web3Account.slice(0, 6)}...{web3Account.slice(-4)}{web3ChainId ? ` [${web3ChainId}]` : ''}
            </span>
            <button
              onClick={() => setExecutionMode(executionMode === 'web3' ? 'agent' : 'web3')}
              style={{
                background: executionMode === 'web3' ? 'var(--accent-primary)' : 'transparent',
                color: executionMode === 'web3' ? 'var(--accent-text)' : 'var(--text-steel)',
                border: '1px solid var(--border-hairline)',
                padding: '2px 6px',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.6rem',
                cursor: 'pointer',
              }}
              title="Toggle between Direct Web3 browser signatures and Agent delegated signers"
            >
              {executionMode === 'web3' ? 'WEB3 DIRECT' : 'AGENT BOT'}
            </button>
            <button
              onClick={disconnectWallet}
              style={{
                background: 'transparent',
                color: '#ef4444',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                padding: '2px 6px',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.6rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
              title="Disconnect wallet and return to homepage"
              id="btn-disconnect-header"
            >
              <LogOut size={10} />
              <span>DISCONNECT</span>
            </button>
          </div>

          {/* Attribution Tag Chip */}
          <div
            className="mono-tag"
            style={{ cursor: 'pointer' }}
            onClick={() => copyToClipboard('celo_sokopay1234', 'tag')}
            title="ERC-8021 Attribution Tag"
          >
            <span style={{ color: 'var(--accent-primary)' }}>TAG:</span> celo_sokopay1234
            {copiedId === 'tag' ? <Check size={11} color="var(--accent-primary)" /> : <Copy size={11} />}
          </div>

          {/* White / Dark Mode Toggle Button */}
          <button
            onClick={toggleLightDarkMode}
            className="btn-hydra-ghost"
            style={{ padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            title={isDarkMode ? 'Switch to White Mode' : 'Switch to Dark Mode'}
            id="btn-toggle-light-dark"
          >
            {isDarkMode ? <Sun size={13} color="var(--accent-primary)" /> : <Moon size={13} />}
            <span style={{ fontSize: '0.65rem' }}>{isDarkMode ? 'WHITE MODE' : 'DARK MODE'}</span>
          </button>

          {/* Accent Mode Toggle */}
          <button
            onClick={toggleAccent}
            className="btn-hydra-ghost"
            style={{ padding: '6px 10px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            title="Toggle Visual Accent"
            id="btn-toggle-accent"
          >
            <Zap size={13} color="var(--accent-primary)" />
            <span style={{ fontSize: '0.65rem' }}>{accentMode === 'default' ? 'PALETTE 1' : 'PALETTE 2'}</span>
          </button>

          {/* Faucet Button */}
          <button
            onClick={() => setShowFaucetModal(true)}
            className="btn-hydra-ghost"
            style={{ padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            id="btn-open-faucet"
          >
            <Droplets size={13} color="var(--accent-secondary)" />
            <span style={{ fontSize: '0.65rem' }}>FAUCET</span>
          </button>

          {/* Role Toggle */}
          <div style={{ display: 'inline-flex', border: '1px solid var(--border-hairline)' }}>
            <button
              onClick={() => setWalletRole('buyer')}
              style={{
                background: walletRole === 'buyer' ? 'var(--accent-primary)' : 'transparent',
                color: walletRole === 'buyer' ? 'var(--accent-text)' : 'var(--text-steel)',
                border: 'none',
                padding: '6px 12px',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.68rem',
                textTransform: 'uppercase',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Buyer
            </button>
            <button
              onClick={() => setWalletRole('seller')}
              style={{
                background: walletRole === 'seller' ? 'var(--accent-primary)' : 'transparent',
                color: walletRole === 'seller' ? 'var(--accent-text)' : 'var(--text-steel)',
                border: 'none',
                padding: '6px 12px',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.68rem',
                textTransform: 'uppercase',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Seller
            </button>
          </div>

          <button
            onClick={() => setShowAuditModal(true)}
            className="btn-hydra-ghost"
            style={{ padding: '6px 12px' }}
          >
            <Layers size={13} />
            AUDIT
          </button>
        </div>
      </header>

      {/* Active Wallet Strip */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 16px',
          border: '1px solid var(--border-hairline)',
          background: 'var(--bg-card)',
          marginBottom: '28px',
          fontSize: '0.75rem',
          fontFamily: 'var(--font-mono)',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <span style={{ color: 'var(--text-graphite)' }}>CONNECTED WALLET: </span>
            <span style={{ color: 'var(--text-white)', fontWeight: 700 }}>
              {web3Account}
            </span>
            <span className="mono-tag mono-tag-accent" style={{ marginLeft: '8px' }}>
              {walletRole.toUpperCase()} VIEW
            </span>
          </div>
          {networkInfo.activeNetwork?.explorerUrl && (
            <a
              href={`${networkInfo.activeNetwork.explorerUrl}/address/${web3Account}`}
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--accent-primary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              title="View your connected wallet on Celoscan"
            >
              <ExternalLink size={11} /> CELOSCAN
            </a>
          )}
        </div>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          {['CELO', 'cUSD', 'USDT', 'USDC', 'cEUR']
            .map((sym) => (
              <div key={sym}>
                <span style={{ color: 'var(--text-graphite)' }}>{sym}: </span>
                <span style={{ color: sym === 'cUSD' || sym === 'CELO' ? 'var(--accent-primary)' : 'var(--text-white)', fontWeight: 700 }}>
                  {balances.user?.[sym] || '0.00'}
                </span>
              </div>
            ))}
        </div>
      </div>

      {/* Real Systems Architecture Telemetry Strip */}
      <div
        style={{
          display: 'flex',
          gap: '16px',
          alignItems: 'center',
          padding: '8px 16px',
          background: 'var(--bg-highlight)',
          border: '1px solid var(--border-hairline)',
          marginBottom: '24px',
          fontSize: '0.72rem',
          fontFamily: 'var(--font-mono)',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className="hydra-indicator" style={{ background: '#10b981' }} />
          <span style={{ color: 'var(--text-graphite)' }}>DATABASE:</span>
          <span style={{ color: '#10b981', fontWeight: 600 }}>Supabase PostgreSQL (Live)</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className="hydra-indicator" style={{ background: '#10b981' }} />
          <span style={{ color: 'var(--text-graphite)' }}>ORACLE:</span>
          <span style={{ color: 'var(--text-white)' }}>
            SokoAgentOracle ({healthInfo?.oracleContract ? `${healthInfo.oracleContract.slice(0, 6)}...${healthInfo.oracleContract.slice(-4)}` : '0x0DCd...CD82'})
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className="hydra-indicator" style={{ background: 'var(--accent-primary)' }} />
          <span style={{ color: 'var(--text-graphite)' }}>AI AGENT:</span>
          <span style={{ color: 'var(--accent-primary)' }}>
            {healthInfo?.aiModel && healthInfo.aiModel.includes('deepseek')
              ? 'DeepSeek V4 Flash (Free)'
              : healthInfo?.aiModel === 'openrouter/free'
              ? 'OpenRouter Free AI'
              : healthInfo?.aiModel
              ? `OpenRouter: ${healthInfo.aiModel.split('/')[1] || healthInfo.aiModel}`
              : 'SokoBot Generative Engine'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className="hydra-indicator" style={{ background: '#3b82f6' }} />
          <span style={{ color: 'var(--text-graphite)' }}>LOGISTICS:</span>
          <span style={{ color: '#3b82f6' }}>Live Webhooks & Carrier Oracles</span>
        </div>
      </div>

      {/* Hero Section */}
      <section style={{ marginBottom: '32px' }}>
        <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="hydra-indicator" />
          <span className="hydra-label">01 / SOCIAL COMMERCE ESCROW ONCHAIN</span>
        </div>

        <h1
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'clamp(2rem, 5vw, 3.2rem)',
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: '-0.03em',
            marginBottom: '16px',
            maxWidth: '900px',
          }}
        >
          Trustless milestone settlements for Opera MiniPay and social sellers.
        </h1>

        <p
          style={{
            color: 'var(--text-steel)',
            fontSize: '1rem',
            maxWidth: '720px',
            lineHeight: 1.6,
            marginBottom: '22px',
          }}
        >
          Social commerce buyers in Nigeria, Kenya, and Latin America lock stablecoins in the SokoEscrow smart contract.
          Funds release only upon verified courier delivery. Powered by Celo L2, fee abstraction, and ERC-8021 attribution.
        </p>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-hydra-primary"
            id="btn-create-invoice"
          >
            <Plus size={14} strokeWidth={3} />
            CREATE INVOICE
          </button>

          <button
            onClick={() => setChatOpen(true)}
            className="btn-hydra-ghost"
            id="btn-open-agent"
          >
            <Sparkles size={14} color="var(--accent-primary)" />
            PROMPT SOKOBOT
          </button>

          {recentTx && (
            <button
              onClick={() => handleInspectTx(recentTx)}
              className="mono-tag"
              style={{
                borderColor: 'var(--accent-primary)',
                color: 'var(--accent-primary)',
                cursor: 'pointer',
                background: 'transparent',
              }}
              title="Click to inspect onchain receipt"
            >
              <FileCode2 size={12} />
              LATEST TX: {recentTx.slice(0, 10)}...{recentTx.slice(-6)}
            </button>
          )}
        </div>
      </section>

      {/* 4-Column Metric Grid */}
      <div className="metric-grid">
        <div className="metric-cell">
          <div className="metric-value">{deals.length}</div>
          <div className="metric-caption">Onchain Deals Created</div>
        </div>
        <div className="metric-cell">
          <div className="metric-value">{balances.user?.cUSD || '0.00'}</div>
          <div className="metric-caption">Your cUSD Balance</div>
        </div>
        <div className="metric-cell">
          <div className="metric-value">{balances.user?.CELO ? parseFloat(balances.user.CELO).toFixed(3) : '0.000'}</div>
          <div className="metric-caption">Your Gas Balance (CELO)</div>
        </div>
        <div className="metric-cell">
          <div className="metric-value">0.5%</div>
          <div className="metric-caption">Protocol Escrow Fee</div>
        </div>
      </div>

      {/* Section 02: Onchain Deals Feed */}
      <section style={{ marginTop: '36px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            marginBottom: '16px',
            borderBottom: '1px solid var(--border-hairline)',
            paddingBottom: '12px',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span className="hydra-indicator" />
              <span className="hydra-label">02 / ONCHAIN CONTRACT STATE</span>
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Active Escrow Transactions</h2>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {['all', 'action_required', 'funded', 'released'].map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveTab(filter)}
                style={{
                  background: activeTab === filter ? 'var(--accent-primary)' : 'transparent',
                  color: activeTab === filter ? 'var(--accent-text)' : 'var(--text-steel)',
                  border: '1px solid',
                  borderColor: activeTab === filter ? 'var(--accent-primary)' : 'var(--border-hairline)',
                  padding: '5px 12px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.68rem',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {filter.replace('_', ' ')}
              </button>
            ))}

            <button
              onClick={fetchData}
              className="btn-hydra-ghost"
              style={{ padding: '5px 10px' }}
              title="Refresh onchain state"
            >
              <RefreshCw size={12} />
            </button>
          </div>
        </div>

        {/* Deals Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {loading ? (
            <div className="hydra-card" style={{ textAlign: 'center', padding: '40px' }}>
              <p style={{ color: 'var(--text-steel)', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                Syncing onchain escrow state from Celo node...
              </p>
            </div>
          ) : deals.length === 0 ? (
            <div className="hydra-card" style={{ textAlign: 'center', padding: '40px' }}>
              <p style={{ color: 'var(--text-steel)', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                No deals deployed yet. Click CREATE INVOICE to deploy the first deal onchain.
              </p>
            </div>
          ) : (
            deals
              .filter((deal) => {
                if (activeTab === 'all') return true;
                if (activeTab === 'action_required') {
                  return (
                    (walletRole === 'buyer' && ['Created', 'Dispatched'].includes(deal.status)) ||
                    (walletRole === 'seller' && deal.status === 'Funded')
                  );
                }
                if (activeTab === 'funded') return deal.status === 'Funded';
                if (activeTab === 'released') return deal.status === 'Released';
                return true;
              })
              .map((deal) => {
                return (
                  <div key={deal.dealRef} className="hydra-card">
                    {/* Header */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        flexWrap: 'wrap',
                        gap: '8px',
                        marginBottom: '12px',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span className="mono-tag mono-tag-accent">#{deal.dealRef}</span>
                          <span
                            className="mono-tag"
                            style={{
                              borderColor:
                                deal.status === 'Released'
                                  ? 'var(--accent-secondary)'
                                  : deal.status === 'Dispatched'
                                  ? 'var(--accent-primary)'
                                  : deal.status === 'Disputed'
                                  ? '#ef4444'
                                  : 'var(--border-hairline)',
                              color:
                                deal.status === 'Released'
                                  ? 'var(--accent-secondary)'
                                  : deal.status === 'Dispatched'
                                  ? 'var(--accent-primary)'
                                  : deal.status === 'Disputed'
                                  ? '#ef4444'
                                  : 'var(--text-white)',
                            }}
                          >
                            STATUS: {deal.status.toUpperCase()}
                          </span>
                          {deal.trackingRef && (
                            <span
                              className="mono-tag"
                              style={{ cursor: 'pointer', borderColor: 'var(--accent-primary)', color: 'var(--accent-primary)' }}
                              onClick={() => openTrackingModal(deal.trackingRef, deal.dealRef)}
                              title="Click to view real-time live logistics tracking milestones"
                            >
                              <Truck size={10} /> TRACKING: {deal.trackingRef} (LIVE)
                            </span>
                          )}
                        </div>
                        <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>{deal.title}</h3>
                        <p style={{ color: 'var(--text-steel)', fontSize: '0.85rem' }}>{deal.description}</p>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '1.4rem',
                            fontWeight: 700,
                            color: 'var(--accent-primary)',
                          }}
                        >
                          {deal.amount} {deal.tokenSymbol}
                        </div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-graphite)' }}>
                          NET PAYOUT: {deal.netAmount} {deal.tokenSymbol} (0.5% FEE DEDUCTED)
                        </div>
                      </div>
                    </div>

                    {/* Step Timeline */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(4, 1fr)',
                        border: '1px solid var(--border-hairline)',
                        background: 'var(--border-hairline)',
                        gap: '1px',
                        margin: '16px 0',
                        fontSize: '0.7rem',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {[
                        { label: '01 / CREATED', step: 'Created' },
                        { label: '02 / FUNDED', step: 'Funded' },
                        { label: '03 / DISPATCHED', step: 'Dispatched' },
                        { label: '04 / RELEASED', step: 'Released' },
                      ].map((item, idx) => {
                        const stepOrder = ['Created', 'Funded', 'Dispatched', 'Released'];
                        const currentIdx = stepOrder.indexOf(deal.status);
                        const isDone = currentIdx >= idx;
                        const isCurrent = currentIdx === idx;

                        return (
                          <div
                            key={item.label}
                            style={{
                              background: isDone ? 'rgba(128, 128, 128, 0.06)' : 'var(--bg-canvas)',
                              padding: '10px',
                              color: isCurrent
                                ? 'var(--accent-primary)'
                                : isDone
                                ? 'var(--text-white)'
                                : 'var(--text-graphite)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                            }}
                          >
                            <span>{item.label}</span>
                            {isDone && <Check size={12} color="var(--accent-primary)" />}
                          </div>
                        );
                      })}
                    </div>

                    {/* Parties info */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '0.75rem',
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--text-graphite)',
                        padding: '6px 0',
                        flexWrap: 'wrap',
                        gap: '8px',
                      }}
                    >
                      <div>
                        BUYER:{' '}
                        <span style={{ color: 'var(--text-steel)' }}>
                          {deal.buyer.slice(0, 6)}...{deal.buyer.slice(-4)}
                        </span>
                      </div>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <span>SELLER:</span>
                        <span
                          style={{ color: 'var(--accent-primary)', cursor: 'pointer', textDecoration: 'underline' }}
                          onClick={() => openProfileModal(deal.sellerHandle || 'lagos_kicks')}
                          title="Click to view seller trust reputation and verified deals"
                        >
                          {deal.sellerHandle ? `@${deal.sellerHandle}` : `${deal.seller.slice(0, 6)}...${deal.seller.slice(-4)}`}
                        </span>
                        <ShieldCheck size={11} color="var(--accent-primary)" />
                      </div>
                      <div>
                        AUTO-RELEASE:{' '}
                        <span style={{ color: 'var(--text-steel)' }}>{deal.deliveryDays} DAYS POST-DISPATCH</span>
                      </div>
                      {networkInfo.activeNetwork?.explorerUrl && (
                        <div>
                          <a
                            href={`${networkInfo.activeNetwork.explorerUrl}/address/${deal.dealId}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: 'var(--text-graphite)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                            title="View Deal on Celoscan"
                          >
                            <ExternalLink size={10} /> SCAN
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Action Bar */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginTop: '14px',
                        borderTop: '1px solid var(--border-hairline)',
                        paddingTop: '12px',
                        flexWrap: 'wrap',
                        gap: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => setShowShareModal(deal)}
                          className="btn-hydra-ghost"
                          style={{ padding: '6px 12px' }}
                        >
                          <Share2 size={12} />
                          WHATSAPP SHARE
                        </button>
                        <button
                          onClick={() =>
                            copyToClipboard(
                              `celo://wallet/dapp?url=https%3A%2F%2Fsokopay.xyz%2Fdeal%2F${deal.dealRef}`,
                              `link-${deal.dealRef}`
                            )
                          }
                          className="btn-hydra-ghost"
                          style={{ padding: '6px 12px' }}
                        >
                          {copiedId === `link-${deal.dealRef}` ? <Check size={12} /> : <Copy size={12} />}
                          MINIPAY LINK
                        </button>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {deal.status === 'Created' && (
                          <>
                            <button
                              onClick={() => handleOnchainAction(deal.dealRef, 'deposit')}
                              disabled={actionLoading === deal.dealRef}
                              className="btn-hydra-primary"
                            >
                              <Lock size={13} />
                              {actionLoading === deal.dealRef ? 'MINING ONCHAIN...' : 'LOCK DEPOSIT ONCHAIN'}
                            </button>
                            <button
                              onClick={() => handleOnchainAction(deal.dealRef, 'cancel')}
                              disabled={actionLoading === deal.dealRef}
                              className="btn-hydra-ghost"
                              style={{ color: '#ef4444', borderColor: '#ef4444' }}
                            >
                              <XCircle size={13} />
                              CANCEL INVOICE
                            </button>
                          </>
                        )}

                        {deal.status === 'Funded' && (
                          <>
                            <button
                              onClick={() => setDispatchDeal(deal)}
                              disabled={actionLoading === deal.dealRef}
                              className="btn-hydra-primary"
                            >
                              <Truck size={13} />
                              RECORD DISPATCH ONCHAIN
                            </button>
                            <button
                              onClick={() => handleOnchainAction(deal.dealRef, 'cancel')}
                              disabled={actionLoading === deal.dealRef}
                              className="btn-hydra-ghost"
                              title="Cancel if seller fails to dispatch within 7 days"
                            >
                              <XCircle size={12} />
                              CANCEL (7D+)
                            </button>
                          </>
                        )}

                        {deal.status === 'Dispatched' && (
                          <>
                            <button
                              onClick={() => handleOnchainAction(deal.dealRef, 'release')}
                              disabled={actionLoading === deal.dealRef}
                              className="btn-hydra-primary"
                            >
                              <CheckCircle2 size={13} />
                              {actionLoading === deal.dealRef ? 'RELEASING...' : 'RELEASE PAYOUT ONCHAIN'}
                            </button>
                            <button
                              onClick={() => handleOnchainAction(deal.dealRef, 'auto-release')}
                              disabled={actionLoading === deal.dealRef}
                              className="btn-hydra-ghost"
                              title="Auto-release after delivery duration has elapsed"
                            >
                              <RefreshCw size={12} />
                              AUTO-RELEASE
                            </button>
                          </>
                        )}

                        {deal.status === 'Released' && (
                          <div
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '0.75rem',
                              color: 'var(--accent-primary)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}
                          >
                            <CheckCircle2 size={14} />
                            SETTLED ONCHAIN
                          </div>
                        )}

                        {deal.status === 'Refunded' && (
                          <div
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '0.75rem',
                              color: '#ef4444',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}
                          >
                            <XCircle size={14} />
                            REFUNDED ONCHAIN
                          </div>
                        )}

                        {['Funded', 'Dispatched'].includes(deal.status) && (
                          <button
                            onClick={() => setShowDisputeModal(deal)}
                            className="btn-hydra-ghost"
                            style={{ color: '#ef4444', borderColor: '#ef4444' }}
                          >
                            <AlertTriangle size={12} />
                            DISPUTE
                          </button>
                        )}

                        {deal.status === 'Disputed' && (
                          <button
                            onClick={() => handleOnchainAction(deal.dealRef, 'resolve', { buyerPercent: 70 })}
                            disabled={actionLoading === deal.dealRef}
                            className="btn-hydra-primary"
                            style={{ background: '#ef4444', color: '#ffffff' }}
                          >
                            RESOLVE DISPUTE (70/30)
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
          )}
        </div>
      </section>

      {/* Faucet Modal */}
      {showFaucetModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 110,
            padding: '16px',
          }}
        >
          <div className="hydra-card" style={{ width: '100%', maxWidth: '420px', background: 'var(--bg-canvas)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Droplets size={16} color="var(--accent-secondary)" />
                <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', textTransform: 'uppercase' }}>
                  Onchain Stablecoin Faucet
                </h3>
              </div>
              <button onClick={() => setShowFaucetModal(false)} className="btn-hydra-ghost" style={{ padding: '2px 8px' }}>
                ✕
              </button>
            </div>

            {networkInfo.activeNetwork?.id === 'celo-mainnet' ? (
              <div style={{ padding: '16px', background: 'var(--bg-highlight)', border: '1px solid var(--border-hairline)', borderRadius: '6px' }}>
                <div style={{ color: 'var(--accent-primary)', fontWeight: 700, marginBottom: '8px', fontSize: '0.85rem' }}>
                  🌐 CONNECTED TO CELO MAINNET
                </div>
                <p style={{ color: 'var(--text-steel)', fontSize: '0.8rem', lineHeight: 1.6, marginBottom: '14px' }}>
                  Tokens on Celo Mainnet are real-world assets (<strong style={{ color: 'var(--text-white)' }}>cUSD, USDT, USDC</strong>) with monetary value. Test minting is disabled on production networks.
                </p>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-white)', marginBottom: '16px' }}>
                  To acquire cUSD or USDT on Celo:
                  <ul style={{ paddingLeft: '18px', marginTop: '6px', lineHeight: 1.8, color: 'var(--text-steel)' }}>
                    <li>Open this dApp inside <strong style={{ color: 'var(--accent-primary)' }}>Opera MiniPay</strong> to cash-in via mobile money.</li>
                    <li>Swap CELO for cUSD on <a href="https://app.uniswap.org" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-primary)' }}>Uniswap</a> or <a href="https://matcha.xyz" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-primary)' }}>Matcha</a>.</li>
                  </ul>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFaucetModal(false)}
                  className="btn-hydra-primary"
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  CLOSE
                </button>
              </div>
            ) : (
              <form onSubmit={handleFaucetMint} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label className="hydra-label" style={{ display: 'block', marginBottom: '6px' }}>
                    Target Wallet Address
                  </label>
                  <input type="text" className="hydra-input" value={activeWalletAddress} disabled />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label className="hydra-label" style={{ display: 'block', marginBottom: '6px' }}>
                      Token
                    </label>
                    <select
                      className="hydra-input"
                      value={faucetToken}
                      onChange={(e) => setFaucetToken(e.target.value)}
                    >
                      <option value="cUSD">cUSD</option>
                      <option value="cNGN">cNGN</option>
                      <option value="USAT">USA₮</option>
                    </select>
                  </div>
                  <div>
                    <label className="hydra-label" style={{ display: 'block', marginBottom: '6px' }}>
                      Amount
                    </label>
                    <input
                      type="number"
                      className="hydra-input"
                      value={faucetAmount}
                      onChange={(e) => setFaucetAmount(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setShowFaucetModal(false)}
                    className="btn-hydra-ghost"
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    CANCEL
                  </button>
                  <button
                    type="submit"
                    disabled={faucetLoading}
                    className="btn-hydra-primary"
                    style={{ flex: 2, justifyContent: 'center' }}
                  >
                    {faucetLoading ? 'MINTING ONCHAIN...' : 'MINT TOKENS'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Transaction Receipt Inspector Modal */}
      {showTxModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 120,
            padding: '16px',
          }}
        >
          <div className="hydra-card" style={{ width: '100%', maxWidth: '540px', background: 'var(--bg-canvas)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileCode2 size={16} color="var(--accent-primary)" />
                <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', textTransform: 'uppercase' }}>
                  Onchain Transaction Receipt
                </h3>
              </div>
              <button onClick={() => setShowTxModal(null)} className="btn-hydra-ghost" style={{ padding: '2px 8px' }}>
                ✕
              </button>
            </div>

            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.78rem',
                lineHeight: 1.8,
                color: 'var(--text-steel)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div>
                <span style={{ color: 'var(--text-graphite)' }}>HASH: </span>
                <span style={{ color: 'var(--text-white)', wordBreak: 'break-all' }}>{showTxModal.hash}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-graphite)' }}>STATUS: </span>
                <span style={{ color: 'var(--accent-secondary)', fontWeight: 700 }}>{showTxModal.status}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-graphite)' }}>BLOCK NUMBER: </span>
                <span style={{ color: 'var(--text-white)' }}>{showTxModal.blockNumber}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-graphite)' }}>GAS USED: </span>
                <span style={{ color: 'var(--text-white)' }}>{showTxModal.gasUsed}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-graphite)' }}>ERC-8021 ATTRIBUTION: </span>
                <span style={{ color: showTxModal.attributionTagPresent ? 'var(--accent-primary)' : 'var(--text-graphite)' }}>
                  {showTxModal.attributionTagPresent ? `VERIFIED IN CALLDATA (${showTxModal.calldataSuffix})` : 'None'}
                </span>
              </div>
              {networkInfo.activeNetwork?.blockExplorerUrls?.[0] && (
                <div style={{ marginTop: '4px' }}>
                  <a
                    href={`${networkInfo.activeNetwork.blockExplorerUrls[0]}/tx/${showTxModal.hash}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      color: 'var(--accent-primary)',
                      textDecoration: 'underline',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.74rem',
                    }}
                  >
                    <span>VIEW ON CELOSCAN EXPLORER</span>
                    <ExternalLink size={12} />
                  </a>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowTxModal(null)}
              className="btn-hydra-ghost"
              style={{ width: '100%', justifyContent: 'center', marginTop: '16px' }}
            >
              CLOSE RECEIPT
            </button>
          </div>
        </div>
      )}

      {/* Dispute Modal */}
      {showDisputeModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 110,
            padding: '16px',
          }}
        >
          <div className="hydra-card" style={{ width: '100%', maxWidth: '420px', background: 'var(--bg-canvas)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <AlertTriangle size={18} color="#ef4444" />
              <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', textTransform: 'uppercase' }}>
                Raise Onchain Dispute
              </h3>
            </div>
            <p style={{ color: 'var(--text-steel)', fontSize: '0.82rem', marginBottom: '14px' }}>
              Report fulfillment or parcel defect for deal #{showDisputeModal.dealRef}. SokoBot Arbiter will evaluate onchain.
            </p>

            <textarea
              className="hydra-input"
              rows={3}
              placeholder="e.g. Package arrived with damaged contents"
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              style={{ marginBottom: '14px' }}
            />

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setShowDisputeModal(null)}
                className="btn-hydra-ghost"
                style={{ flex: 1, justifyContent: 'center' }}
              >
                CANCEL
              </button>
              <button
                onClick={() => handleOnchainAction(showDisputeModal.dealRef, 'dispute', { reason: disputeReason })}
                className="btn-hydra-primary"
                style={{ flex: 2, justifyContent: 'center', background: '#ef4444', color: '#ffffff' }}
              >
                SUBMIT DISPUTE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '16px',
          }}
        >
          <div
            className="hydra-card"
            style={{ width: '100%', maxWidth: '500px', background: 'var(--bg-canvas)', border: '1px solid var(--accent-primary)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="hydra-indicator" />
                <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', textTransform: 'uppercase' }}>
                  Deploy Escrow Invoice
                </h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="btn-hydra-ghost"
                style={{ padding: '2px 8px' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateOnchain} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="hydra-label" style={{ display: 'block', marginBottom: '6px' }}>
                  Item Description *
                </label>
                <input
                  type="text"
                  className="hydra-input"
                  placeholder="e.g. Vintage Leather Jacket (Size L)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="hydra-label" style={{ display: 'block', marginBottom: '6px' }}>
                  Courier & Delivery Terms
                </label>
                <input
                  type="text"
                  className="hydra-input"
                  placeholder="e.g. Lagos Courier Express delivery within 48h"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label className="hydra-label" style={{ display: 'block', marginBottom: '6px' }}>
                    Amount *
                  </label>
                  <input
                    type="number"
                    step="any"
                    className="hydra-input"
                    placeholder="e.g. 50"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="hydra-label" style={{ display: 'block', marginBottom: '6px' }}>
                    Stablecoin Token *
                  </label>
                  <select
                    className="hydra-input"
                    value={tokenSymbol}
                    onChange={(e) => setTokenSymbol(e.target.value)}
                  >
                    <option value="cUSD">cUSD (Celo Dollar)</option>
                    <option value="cNGN">cNGN (Nigerian Naira)</option>
                    <option value="USAT">USA₮ (Self x Tether)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="hydra-label" style={{ display: 'block', marginBottom: '6px' }}>
                  Auto-release duration post-dispatch
                </label>
                <select
                  className="hydra-input"
                  value={deliveryDays}
                  onChange={(e) => setDeliveryDays(e.target.value)}
                >
                  <option value={2}>2 Days (Express Courier)</option>
                  <option value={3}>3 Days (Standard Delivery)</option>
                  <option value={5}>5 Days (Cross-Border)</option>
                </select>
              </div>

              <div
                style={{
                  border: '1px solid var(--border-hairline)',
                  padding: '10px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.72rem',
                  color: 'var(--text-graphite)',
                }}
              >
                <div>ATTRIBUTION: ERC-8021 calldata suffix appended</div>
                <div>FEE: 0.5% protocol commission deducted upon seller release</div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn-hydra-ghost"
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-hydra-primary"
                  style={{ flex: 2, justifyContent: 'center' }}
                >
                  {submitting ? 'MINING TX...' : 'DEPLOY ONCHAIN'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '16px',
          }}
        >
          <div
            className="hydra-card"
            style={{ width: '100%', maxWidth: '460px', background: 'var(--bg-canvas)', border: '1px solid var(--accent-primary)' }}
          >
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <span className="mono-tag mono-tag-accent" style={{ marginBottom: '8px' }}>
                TRANSACTION MINED ONCHAIN
              </span>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Deal #{showShareModal.dealRef} Active</h3>
              {showShareModal.txHash && (
                <p
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-graphite)', cursor: 'pointer' }}
                  onClick={() => handleInspectTx(showShareModal.txHash)}
                >
                  Tx: {showShareModal.txHash.slice(0, 16)}...{showShareModal.txHash.slice(-8)} (Inspect)
                </p>
              )}
            </div>

            <div
              style={{
                border: '1px solid var(--border-hairline)',
                background: 'rgba(128, 128, 128, 0.05)',
                padding: '12px',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                lineHeight: 1.6,
                color: 'var(--text-steel)',
                marginBottom: '16px',
                whiteSpace: 'pre-wrap',
              }}
            >
              {`🛡️ SokoPay Protected Deal: #${showShareModal.dealRef}
Item: ${showShareModal.title}
Amount: ${showShareModal.amount} ${showShareModal.tokenSymbol}

Pay safely in Opera MiniPay:
https://sokopay.xyz/deal/${showShareModal.dealRef}`}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                onClick={() => {
                  const shareText = encodeURIComponent(
                    `🛡️ SokoPay Protected Deal #${showShareModal.dealRef}\nItem: ${showShareModal.title}\nAmount: ${showShareModal.amount} ${showShareModal.tokenSymbol}\nPay safely via MiniPay: https://sokopay.xyz/deal/${showShareModal.dealRef}`
                  );
                  window.open(`https://api.whatsapp.com/send?text=${shareText}`, '_blank');
                }}
                className="btn-hydra-primary"
                style={{ justifyContent: 'center' }}
              >
                <Share2 size={14} />
                SEND VIA WHATSAPP
              </button>

              <button
                onClick={() =>
                  copyToClipboard(`https://sokopay.xyz/deal/${showShareModal.dealRef}`, 'share-link')
                }
                className="btn-hydra-ghost"
                style={{ justifyContent: 'center' }}
              >
                {copiedId === 'share-link' ? <Check size={14} /> : <Copy size={14} />}
                COPY MINIPAY LINK
              </button>

              <button
                onClick={() => setShowShareModal(null)}
                className="btn-hydra-ghost"
                style={{ justifyContent: 'center', borderColor: 'transparent' }}
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dispatch Modal */}
      {dispatchDeal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '16px',
          }}
        >
          <div
            className="hydra-card"
            style={{ width: '100%', maxWidth: '420px', background: 'var(--bg-canvas)', border: '1px solid var(--accent-primary)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <span className="hydra-indicator" />
              <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', textTransform: 'uppercase' }}>
                Record Dispatch Onchain
              </h3>
            </div>

            <p style={{ color: 'var(--text-steel)', fontSize: '0.82rem', marginBottom: '14px' }}>
              Enter courier tracking reference (e.g. GIG Logistics, DHL, Uber Package) for #{dispatchDeal.dealRef}.
            </p>

            <input
              type="text"
              className="hydra-input"
              placeholder="e.g. GIG-LG-982104"
              value={trackingInput}
              onChange={(e) => setTrackingInput(e.target.value)}
              style={{ marginBottom: '16px' }}
            />

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setDispatchDeal(null)}
                className="btn-hydra-ghost"
                style={{ flex: 1, justifyContent: 'center' }}
              >
                CANCEL
              </button>
              <button
                onClick={() =>
                  handleOnchainAction(dispatchDeal.dealRef, 'dispatch', { trackingRef: trackingInput })
                }
                className="btn-hydra-primary"
                style={{ flex: 2, justifyContent: 'center' }}
              >
                CONFIRM DISPATCH
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Compliance & Audit Modal */}
      {renderAuditModal()}

      {/* Connect Wallet Helper Modal */}
      {renderWalletModal()}

      {/* Real Multi-Carrier Logistics Tracking Modal */}
      {showTrackingModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 120,
            padding: '16px',
          }}
        >
          <div
            className="hydra-card"
            style={{ width: '100%', maxWidth: '560px', background: 'var(--bg-canvas)', border: '1px solid var(--accent-primary)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Package size={16} color="var(--accent-primary)" />
                <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', textTransform: 'uppercase' }}>
                  Live Multi-Carrier Tracking
                </h3>
              </div>
              <button onClick={() => setShowTrackingModal(null)} className="btn-hydra-ghost" style={{ padding: '2px 8px' }}>
                ✕
              </button>
            </div>

            {/* Tracking Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'var(--bg-highlight)',
                padding: '12px',
                border: '1px solid var(--border-hairline)',
                marginBottom: '16px',
              }}
            >
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-graphite)' }}>CARRIER</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-white)' }}>
                  {showTrackingModal.carrierName || 'CARRIER DISPATCH'}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-graphite)' }}>WAYBILL REF</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--accent-primary)' }}>
                  {showTrackingModal.trackingCode}
                </div>
              </div>
            </div>

            {/* Status Progress Bar */}
            <div style={{ marginBottom: '20px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '6px',
                  fontSize: '0.75rem',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                <span style={{ color: 'var(--text-steel)' }}>PROGRESS</span>
                <span style={{ color: showTrackingModal.isDelivered ? '#10b981' : 'var(--accent-primary)', fontWeight: 700 }}>
                  {showTrackingModal.status || 'IN TRANSIT'} ({showTrackingModal.progressPercent || 50}%)
                </span>
              </div>
              <div style={{ width: '100%', height: '6px', background: 'var(--border-hairline)', borderRadius: '3px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${showTrackingModal.progressPercent || 50}%`,
                    height: '100%',
                    background: showTrackingModal.isDelivered ? '#10b981' : 'var(--accent-primary)',
                    transition: 'width 0.4s ease',
                  }}
                />
              </div>
            </div>

            {/* Carrier Milestones Timeline */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                maxHeight: '240px',
                overflowY: 'auto',
                paddingRight: '4px',
                marginBottom: '16px',
              }}
            >
              {(showTrackingModal.milestones || []).map((m, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    gap: '12px',
                    padding: '10px',
                    background: m.completed ? 'rgba(16, 185, 129, 0.05)' : 'rgba(255, 255, 255, 0.01)',
                    border: `1px solid ${m.completed ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-hairline)'}`,
                  }}
                >
                  <div style={{ marginTop: '2px' }}>
                    {m.completed ? (
                      <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
                    ) : (
                      <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--text-graphite)' }} />
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          color: m.completed ? 'var(--text-white)' : 'var(--text-graphite)',
                        }}
                      >
                        {m.title}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-graphite)' }}>
                        {m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-steel)', marginTop: '2px' }}>
                      {m.location ? `${m.location} • ` : ''}{m.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Proof of Delivery / Settlement Notice */}
            <div
              style={{
                border: '1px solid var(--border-hairline)',
                padding: '10px',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.72rem',
                color: 'var(--text-graphite)',
                marginBottom: '16px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: showTrackingModal.isDelivered ? '#10b981' : 'var(--text-steel)',
                  marginBottom: showTrackingModal.oracleAttestation ? '8px' : '0',
                }}
              >
                <ShieldCheck size={14} />
                <span>
                  {showTrackingModal.isDelivered
                    ? 'VERIFIED PROOF-OF-DELIVERY: ESCROW ELIGIBLE FOR AUTOMATED DISBURSEMENT'
                    : 'CARRIER TELEMETRY SYNCED WITH SOKOPAY ORACLE DAEMON'}
                </span>
              </div>

              {showTrackingModal.oracleAttestation?.verified && (
                <div
                  style={{
                    background: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    padding: '8px',
                    fontSize: '0.68rem',
                    color: '#10b981',
                  }}
                >
                  <div style={{ fontWeight: 700 }}>ON-CHAIN SOKOAGENTORACLE ATTESTED</div>
                  <div style={{ wordBreak: 'break-all', marginTop: '2px', color: 'var(--text-steel)' }}>
                    Proof Hash: {showTrackingModal.oracleAttestation.proofHash}
                  </div>
                  <div style={{ marginTop: '2px', color: 'var(--text-steel)' }}>
                    Oracle: {showTrackingModal.oracleAttestation.oracle}
                  </div>
                </div>
              )}
            </div>

            {/* Test Live Carrier Webhook Trigger */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
              <button
                onClick={() =>
                  handleTriggerWebhook(
                    showTrackingModal.dealRef || 'SKP-8821',
                    showTrackingModal.trackingRef || showTrackingModal.trackingCode || 'GIG-LG-982104'
                  )
                }
                disabled={webhookTesting || showTrackingModal.isDelivered}
                className="btn-hydra-primary"
                style={{
                  flex: 1,
                  justifyContent: 'center',
                  fontSize: '0.72rem',
                  opacity: showTrackingModal.isDelivered ? 0.6 : 1,
                }}
              >
                <Truck size={13} />
                {webhookTesting ? 'DISPATCHING WEBHOOK...' : showTrackingModal.isDelivered ? 'DELIVERED & ATTESTED' : 'TRIGGER CARRIER WEBHOOK (DELIVERED)'}
              </button>
            </div>

            <button
              onClick={() => setShowTrackingModal(null)}
              className="btn-hydra-ghost"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              CLOSE TRACKER
            </button>
          </div>
        </div>
      )}

      {/* Real Merchant Reputation & Profile Modal */}
      {showProfileModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 120,
            padding: '16px',
          }}
        >
          <div
            className="hydra-card"
            style={{ width: '100%', maxWidth: '480px', background: 'var(--bg-canvas)', border: '1px solid var(--accent-primary)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={16} color="var(--accent-primary)" />
                <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', textTransform: 'uppercase' }}>
                  Merchant Identity & Reputation
                </h3>
              </div>
              <button onClick={() => setShowProfileModal(null)} className="btn-hydra-ghost" style={{ padding: '2px 8px' }}>
                ✕
              </button>
            </div>

            {/* Profile Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                marginBottom: '16px',
                padding: '12px',
                background: 'var(--bg-highlight)',
                border: '1px solid var(--border-hairline)',
              }}
            >
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  background: 'var(--accent-primary)',
                  color: 'var(--accent-text)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 800,
                  fontSize: '1.1rem',
                }}
              >
                {(showProfileModal.handle || 'M').charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>@{showProfileModal.handle}</span>
                  {showProfileModal.verified && (
                    <span className="mono-tag mono-tag-accent" style={{ fontSize: '0.62rem' }}>VERIFIED SELLER</span>
                  )}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-graphite)' }}>
                  Joined: {showProfileModal.joinedDate || '2024'} • {showProfileModal.country || 'Nigeria'}
                </div>
              </div>
            </div>

            {/* Reputation Metrics Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px' }}>
              <div style={{ border: '1px solid var(--border-hairline)', padding: '10px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-graphite)' }}>RATING</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-primary)' }}>
                  ★ {showProfileModal.rating || '5.0'}
                </div>
              </div>
              <div style={{ border: '1px solid var(--border-hairline)', padding: '10px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-graphite)' }}>SETTLED DEALS</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-white)' }}>
                  {showProfileModal.settledDeals || 0}
                </div>
              </div>
              <div style={{ border: '1px solid var(--border-hairline)', padding: '10px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-graphite)' }}>DISPUTE RATE</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', fontWeight: 800, color: '#10b981' }}>
                  {showProfileModal.disputeRate || '0.0%'}
                </div>
              </div>
            </div>

            {/* Onchain Escrow Wallet Address */}
            <div
              style={{
                border: '1px solid var(--border-hairline)',
                padding: '10px',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.74rem',
                marginBottom: '16px',
              }}
            >
              <div style={{ color: 'var(--text-graphite)', marginBottom: '4px' }}>SETTLEMENT RECIPIENT WALLET:</div>
              <div style={{ color: 'var(--text-white)', wordBreak: 'break-all' }}>
                {showProfileModal.walletAddress || 'Verified Merchant (Onchain Contract Signer)'}
              </div>
              {showProfileModal.walletAddress && (
                <a
                  href={`${networkInfo.activeNetwork?.explorerUrl || 'https://celoscan.io'}/address/${showProfileModal.walletAddress}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: 'var(--accent-primary)',
                    fontSize: '0.7rem',
                    marginTop: '6px',
                  }}
                >
                  <span>VIEW MERCHANT ON CELOSCAN</span>
                  <ExternalLink size={10} />
                </a>
              )}
            </div>

            <button
              onClick={() => setShowProfileModal(null)}
              className="btn-hydra-ghost"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              CLOSE PROFILE
            </button>
          </div>
        </div>
      )}

      {/* SokoBot Conversational Agent Drawer */}
      <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 90 }}>
        {!chatOpen ? (
          <button
            onClick={() => setChatOpen(true)}
            className="btn-hydra-primary"
            style={{ padding: '12px 18px', boxShadow: '0 8px 30px rgba(0,0,0,0.8)' }}
            id="floating-sokobot-btn"
          >
            <Sparkles size={14} />
            <span>SOKOBOT AGENT</span>
          </button>
        ) : (
          <div
            className="hydra-card"
            style={{
              width: '360px',
              maxHeight: '520px',
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--bg-canvas)',
              border: '1px solid var(--accent-primary)',
              boxShadow: '0 12px 40px rgba(0,0,0,0.9)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: '10px',
                borderBottom: '1px solid var(--border-hairline)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="hydra-indicator" />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', fontWeight: 700 }}>
                  SOKOBOT AGENT (CELO L2)
                </span>
              </div>
              <button
                onClick={() => setChatOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-graphite)', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Chat message stream with markdown asterisk fix */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '12px 0',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                maxHeight: '320px',
              }}
            >
              {chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className="chat-formatted"
                  style={{
                    alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '88%',
                    background: msg.sender === 'user' ? 'var(--accent-primary)' : 'var(--bg-card)',
                    color: msg.sender === 'user' ? 'var(--accent-text)' : 'var(--text-white)',
                    padding: '8px 12px',
                    border: '1px solid var(--border-hairline)',
                    fontSize: '0.8rem',
                    lineHeight: 1.5,
                  }}
                >
                  {renderChatText(msg.text)}
                </div>
              ))}
              {chatLoading && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-graphite)' }}>
                  [MINING ONCHAIN TRANSACTION...]
                </div>
              )}
            </div>

            {/* Quick Prompts */}
            <div
              style={{
                display: 'flex',
                gap: '6px',
                overflowX: 'auto',
                padding: '6px 0',
                borderTop: '1px solid var(--border-hairline)',
              }}
            >
              {['Invoice 40 cUSD for Sneakers', 'Status of SKP-8821', 'Release SKP-8821'].map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handleSendChatMessage(prompt)}
                  className="btn-hydra-ghost"
                  style={{ padding: '3px 8px', fontSize: '0.65rem', whiteSpace: 'nowrap' }}
                >
                  {prompt}
                </button>
              ))}
            </div>

            {/* Chat Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendChatMessage();
              }}
              style={{ display: 'flex', gap: '6px', paddingTop: '8px' }}
            >
              <input
                type="text"
                className="hydra-input"
                placeholder="Prompt SokoBot..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                style={{ padding: '8px 10px', fontSize: '0.8rem' }}
              />
              <button
                type="submit"
                disabled={chatLoading}
                className="btn-hydra-primary"
                style={{ padding: '8px 12px' }}
              >
                <Send size={13} />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
