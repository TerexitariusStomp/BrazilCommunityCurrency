import { useState } from 'react';
import { useAccount, useContractWrite } from 'wagmi';
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
                    </div>
                )}
            </div>
        </div>
    );
};

export default TokenLauncher;