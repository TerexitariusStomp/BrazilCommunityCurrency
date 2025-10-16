import { useState } from 'react';
import { useAccount } from 'wagmi';
import axios from 'axios';

const TokenLauncher = () => {
    const { address } = useAccount();
    const [tokenData, setTokenData] = useState({
        name: '',
        symbol: '',
        masterMinter: '',
        pauser: '',
        blacklister: '',
        owner: ''
    });
    const [deploymentResult, setDeploymentResult] = useState(null);
    const [pluggyUrl, setPluggyUrl] = useState('');
    const [pixKey, setPixKey] = useState('');
    const [redeemPixKey, setRedeemPixKey] = useState('');
    const [redeemAmount, setRedeemAmount] = useState('');
    const [status, setStatus] = useState('');

    const deployToken = async () => {
        try {
            const response = await axios.post('/api/deploy-token', {
                ...tokenData,
                masterMinter: tokenData.masterMinter || address,
                pauser: tokenData.pauser || address,
                blacklister: tokenData.blacklister || address,
                owner: tokenData.owner || address
            });

            setDeploymentResult(response.data);

            const connection = await axios.post(`/api/connect-bank/${response.data.proxy}`);
            setPluggyUrl(connection.data.connectUrl);
        } catch (error) {
            console.error('Deployment failed:', error);
        }
    };

    const linkPix = async () => {
        try {
            if (!deploymentResult?.proxy) throw new Error('Deploy or select a token first');
            await axios.post('/api/pix/link', {
                tokenAddress: deploymentResult.proxy,
                pixKey,
                wallet: address
            });
            setStatus('PIX key linked to your wallet. Deposits will auto-mint.');
        } catch (e) {
            setStatus(`Link failed: ${e?.response?.data?.error || e.message}`);
        }
    };

    const redeem = async () => {
        try {
            if (!deploymentResult?.proxy) throw new Error('Deploy or select a token first');
            await axios.post(`/api/tokens/${deploymentResult.proxy}/redeem`, {
                pixKey: redeemPixKey,
                amount: redeemAmount
            });
            setStatus('Redemption initiated. PIX will be sent and tokens burned.');
        } catch (e) {
            setStatus(`Redeem failed: ${e?.response?.data?.error || e.message}`);
        }
    };

    return (
        <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold mb-6">Launch Community Token</h2>

            <div className="space-y-4">
                <input
                    type="text"
                    placeholder="Token Name"
                    value={tokenData.name}
                    onChange={(e) => setTokenData({...tokenData, name: e.target.value})}
                    className="w-full p-2 border rounded"
                />
                <input
                    type="text"
                    placeholder="Token Symbol"
                    value={tokenData.symbol}
                    onChange={(e) => setTokenData({...tokenData, symbol: e.target.value})}
                    className="w-full p-2 border rounded"
                />
                <button
                    onClick={deployToken}
                    className="w-full bg-blue-600 text-white rounded py-2 hover:bg-blue-700"
                >
                    Deploy Token
                </button>

                {deploymentResult && (
                    <div className="mt-4 p-4 bg-gray-100 rounded">
                        <p>Token Deployed: {deploymentResult.proxy}</p>
                        <p>Transaction: {deploymentResult.txHash}</p>
                        {pluggyUrl && (
                            <a href={pluggyUrl} className="text-blue-600">
                                Connect Bank Account
                            </a>
                        )}

                        <div className="mt-4">
                            <h3 className="font-semibold mb-2">Link PIX Key</h3>
                            <input
                                type="text"
                                placeholder="Your PIX key (CPF/email/phone)"
                                value={pixKey}
                                onChange={(e) => setPixKey(e.target.value)}
                                className="w-full p-2 border rounded mb-2"
                            />
                            <button onClick={linkPix} className="w-full bg-green-600 text-white rounded py-2 hover:bg-green-700">
                                Link PIX to Wallet
                            </button>
                        </div>

                        <div className="mt-4">
                            <h3 className="font-semibold mb-2">Redeem for BRL</h3>
                            <input
                                type="text"
                                placeholder="PIX key to receive BRL"
                                value={redeemPixKey}
                                onChange={(e) => setRedeemPixKey(e.target.value)}
                                className="w-full p-2 border rounded mb-2"
                            />
                            <input
                                type="number"
                                placeholder="Amount"
                                value={redeemAmount}
                                onChange={(e) => setRedeemAmount(e.target.value)}
                                className="w-full p-2 border rounded mb-2"
                            />
                            <button onClick={redeem} className="w-full bg-purple-600 text-white rounded py-2 hover:bg-purple-700">
                                Redeem
                            </button>
                        </div>

                        {status && <p className="mt-3 text-sm text-gray-700">{status}</p>}
                    </div>
                )}
            </div>
        </div>
    );
};

export default TokenLauncher;
