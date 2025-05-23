import React, { useState, useEffect, useCallback } from 'react';
import { Wallet, Send, Pickaxe, Users, Info, Plus, ArrowRight, Eye, Copy, Check, X } from 'lucide-react';

// 类型定义
interface ITransaction {
    fromAddress: string | null;
    toAddress: string;
    amount: number;
    fee: number;
    timestamp: number;
    hash: string;
    signature: string | null;
}

interface IBlock {
    index: number;
    timestamp: number;
    transactions: ITransaction[];
    previousHash: string;
    validator: string;
    hash: string;
}

interface IValidator {
    address: string;
    stake: number;
    isActive: boolean;
    missedBlocks: number;
    totalBlocks: number;
}

interface IWallet {
    privateKey: string;
    address: string;
}

interface IChainInfo {
    blockHeight: number;
    totalSupply: number;
    activeValidators: number;
    pendingTransactions: number;
}

interface INotification {
    id: number;
    message: string;
    type: 'success' | 'error' | 'info';
}

interface ITransferForm {
    toAddress: string;
    amount: string;
    fee: string;
}

interface IStakingForm {
    validatorAddress: string;
    amount: string;
}

// 工具类
class SimpleHash {
    static create(data: string | object): string {
        let hash = 0;
        const str = typeof data === 'string' ? data : JSON.stringify(data);
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16);
    }
}

// 交易类
class Transaction implements ITransaction {
    public fromAddress: string | null;
    public toAddress: string;
    public amount: number;
    public fee: number;
    public timestamp: number;
    public hash: string;
    public signature: string | null;

    constructor(fromAddress: string | null, toAddress: string, amount: number, fee: number = 0) {
        this.fromAddress = fromAddress;
        this.toAddress = toAddress;
        this.amount = amount;
        this.fee = fee;
        this.timestamp = Date.now();
        this.hash = this.calculateHash();
        this.signature = null;
    }

    calculateHash(): string {
        return SimpleHash.create(
            `${this.fromAddress}${this.toAddress}${this.amount}${this.fee}${this.timestamp}`
        );
    }

    signTransaction(privateKey: string): void {
        if (this.fromAddress === null) return;
        this.signature = SimpleHash.create(this.hash + privateKey);
    }

    isValid(): boolean {
        if (this.fromAddress === null) return true;
        return this.signature !== null;
    }
}

// 区块类
class Block implements IBlock {
    public index: number;
    public timestamp: number;
    public transactions: ITransaction[];
    public previousHash: string;
    public validator: string;
    public hash: string;

    constructor(index: number, transactions: ITransaction[], previousHash: string, validator: string, timestamp: number = Date.now()) {
        this.index = index;
        this.timestamp = timestamp;
        this.transactions = transactions;
        this.previousHash = previousHash;
        this.validator = validator;
        this.hash = this.calculateHash();
    }

    calculateHash(): string {
        return SimpleHash.create(
            `${this.index}${this.previousHash}${this.timestamp}${JSON.stringify(this.transactions)}${this.validator}`
        );
    }
}

// 钱包类
class SimpleWallet implements IWallet {
    public privateKey: string;
    public address: string;

    constructor() {
        this.privateKey = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        this.address = SimpleHash.create(this.privateKey).substring(0, 12);
    }

    signTransaction(transaction: Transaction): void {
        transaction.signTransaction(this.privateKey);
    }
}

// 验证者类
class Validator implements IValidator {
    public address: string;
    public stake: number;
    public isActive: boolean;
    public missedBlocks: number;
    public totalBlocks: number;

    constructor(address: string, stake: number) {
        this.address = address;
        this.stake = stake;
        this.isActive = true;
        this.missedBlocks = 0;
        this.totalBlocks = 0;
    }

    increaseStake(amount: number): void {
        this.stake += amount;
    }

    decreaseStake(amount: number): void {
        if (this.stake >= amount) {
            this.stake -= amount;
        }
    }
}

// 区块链类
class CosmosBlockchain {
    public chain: IBlock[];
    public pendingTransactions: ITransaction[];
    public miningReward: number;
    public validators: Map<string, Validator>;
    public balances: Map<string, number>;
    public stakingPool: Map<string, Map<string, number>>;
    public totalSupply: number;

    constructor() {
        this.chain = [this.createGenesisBlock()];
        this.pendingTransactions = [];
        this.miningReward = 100;
        this.validators = new Map();
        this.balances = new Map();
        this.stakingPool = new Map();
        this.totalSupply = 0;

        this.initializeGenesisValidators();
    }

    createGenesisBlock(): Block {
        return new Block(0, [], "0", "genesis");
    }

    initializeGenesisValidators(): void {
        const genesisValidators = [
            { address: 'validator1', stake: 1000000 },
            { address: 'validator2', stake: 800000 },
            { address: 'validator3', stake: 600000 }
        ];

        genesisValidators.forEach(v => {
            this.validators.set(v.address, new Validator(v.address, v.stake));
            this.balances.set(v.address, v.stake);
            this.totalSupply += v.stake;
        });
    }

    getLatestBlock(): IBlock {
        return this.chain[this.chain.length - 1];
    }

    createTransaction(transaction: Transaction): void {
        if (!transaction.isValid()) {
            throw new Error('无效的交易');
        }
        this.pendingTransactions.push(transaction);
    }

    selectValidator(): Validator {
        const activeValidators = Array.from(this.validators.values()).filter(v => v.isActive && v.stake > 0);
        if (activeValidators.length === 0) {
            throw new Error('没有活跃的验证者');
        }

        const totalStake = activeValidators.reduce((sum, v) => sum + v.stake, 0);
        const random = Math.random() * totalStake;

        let currentSum = 0;
        for (const validator of activeValidators) {
            currentSum += validator.stake;
            if (random <= currentSum) {
                return validator;
            }
        }

        return activeValidators[0];
    }

    minePendingTransactions(): Block {
        const validator = this.selectValidator();

        const rewardTransaction = new Transaction(null, validator.address, this.miningReward);
        this.pendingTransactions.push(rewardTransaction);

        const validTransactions = this.pendingTransactions.filter(tx => this.isTransactionValid(tx));

        const block = new Block(
            this.chain.length,
            validTransactions,
            this.getLatestBlock().hash,
            validator.address
        );

        for (const transaction of validTransactions) {
            if (transaction.fromAddress !== null) {
                this.balances.set(transaction.fromAddress,
                    this.getBalance(transaction.fromAddress) - transaction.amount - transaction.fee);
                this.balances.set(transaction.toAddress,
                    this.getBalance(transaction.toAddress) + transaction.amount);
                this.balances.set(validator.address,
                    this.getBalance(validator.address) + transaction.fee);
            } else {
                this.balances.set(transaction.toAddress,
                    this.getBalance(transaction.toAddress) + transaction.amount);
                this.totalSupply += transaction.amount;
            }
        }

        this.chain.push(block);
        validator.totalBlocks++;
        this.pendingTransactions = [];

        return block;
    }

    isTransactionValid(transaction: ITransaction): boolean {
        if (!transaction.fromAddress) return true;

        const balance = this.getBalance(transaction.fromAddress);
        return balance >= transaction.amount + transaction.fee;
    }

    getBalance(address: string): number {
        return this.balances.get(address) || 0;
    }

    delegate(delegatorAddress: string, validatorAddress: string, amount: number): void {
        if (!this.validators.has(validatorAddress)) {
            throw new Error('验证者不存在');
        }
        if (this.getBalance(delegatorAddress) < amount) {
            throw new Error('余额不足');
        }

        this.balances.set(delegatorAddress, this.getBalance(delegatorAddress) - amount);

        if (!this.stakingPool.has(delegatorAddress)) {
            this.stakingPool.set(delegatorAddress, new Map());
        }

        const delegatorStaking = this.stakingPool.get(delegatorAddress)!;
        const currentStake = delegatorStaking.get(validatorAddress) || 0;
        delegatorStaking.set(validatorAddress, currentStake + amount);

        const validator = this.validators.get(validatorAddress)!;
        validator.increaseStake(amount);
    }

    getChainInfo(): IChainInfo {
        return {
            blockHeight: this.chain.length - 1,
            totalSupply: this.totalSupply,
            activeValidators: Array.from(this.validators.values()).filter(v => v.isActive).length,
            pendingTransactions: this.pendingTransactions.length
        };
    }

    getStakingInfo(address: string): Map<string, number> {
        return this.stakingPool.get(address) || new Map();
    }
}

// React组件
const BlockchainApp: React.FC = () => {
    const [blockchain] = useState<CosmosBlockchain>(() => new CosmosBlockchain());
    const [wallets, setWallets] = useState<SimpleWallet[]>([]);
    const [selectedWallet, setSelectedWallet] = useState<SimpleWallet | null>(null);
    const [activeTab, setActiveTab] = useState<string>('wallet');
    const [chainInfo, setChainInfo] = useState<IChainInfo>(blockchain.getChainInfo());
    const [notifications, setNotifications] = useState<INotification[]>([]);

    // 转账表单
    const [transferForm, setTransferForm] = useState<ITransferForm>({
        toAddress: '',
        amount: '',
        fee: '1'
    });

    // 质押表单
    const [stakingForm, setStakingForm] = useState<IStakingForm>({
        validatorAddress: 'validator1',
        amount: ''
    });

    // 更新链信息
    useEffect(() => {
        const interval = setInterval(() => {
            setChainInfo(blockchain.getChainInfo());
        }, 1000);
        return () => clearInterval(interval);
    }, [blockchain]);

    // 添加通知
    const addNotification = useCallback((message: string, type: INotification['type'] = 'info') => {
        const id = Date.now();
        setNotifications(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== id));
        }, 3000);
    }, []);

    // 创建钱包
    const createWallet = useCallback(() => {
        const wallet = new SimpleWallet();
        blockchain.balances.set(wallet.address, 1000); // 给新钱包一些初始余额
        blockchain.totalSupply += 1000;
        setWallets(prev => [...prev, wallet]);
        addNotification(`创建新钱包: ${wallet.address}`, 'success');
    }, [blockchain, addNotification]);

    // 处理转账
    const handleTransfer = useCallback(() => {
        if (!selectedWallet) {
            addNotification('请先选择钱包', 'error');
            return;
        }

        if (!transferForm.toAddress || !transferForm.amount) {
            addNotification('请填写完整的转账信息', 'error');
            return;
        }

        try {
            const transaction = new Transaction(
                selectedWallet.address,
                transferForm.toAddress,
                parseFloat(transferForm.amount),
                parseFloat(transferForm.fee)
            );

            selectedWallet.signTransaction(transaction);
            blockchain.createTransaction(transaction);

            addNotification('交易已创建并添加到待处理池', 'success');
            setTransferForm({ toAddress: '', amount: '', fee: '1' });
        } catch (error) {
            addNotification(`交易失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
        }
    }, [selectedWallet, transferForm, blockchain, addNotification]);

    // 处理挖矿
    const handleMining = useCallback(() => {
        try {
            const block = blockchain.minePendingTransactions();
            addNotification(`成功挖出区块 #${block.index}，包含 ${block.transactions.length} 笔交易`, 'success');
            setChainInfo(blockchain.getChainInfo());
        } catch (error) {
            addNotification(`挖矿失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
        }
    }, [blockchain, addNotification]);

    // 处理质押
    const handleStaking = useCallback(() => {
        if (!selectedWallet) {
            addNotification('请先选择钱包', 'error');
            return;
        }

        if (!stakingForm.amount) {
            addNotification('请输入质押金额', 'error');
            return;
        }

        try {
            blockchain.delegate(
                selectedWallet.address,
                stakingForm.validatorAddress,
                parseFloat(stakingForm.amount)
            );
            addNotification(`成功质押 ${stakingForm.amount} 代币给 ${stakingForm.validatorAddress}`, 'success');
            setStakingForm({ validatorAddress: 'validator1', amount: '' });
        } catch (error) {
            addNotification(`质押失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
        }
    }, [selectedWallet, stakingForm, blockchain, addNotification]);

    // 复制到剪贴板
    const copyToClipboard = useCallback((text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            addNotification('已复制到剪贴板', 'success');
        }).catch(() => {
            addNotification('复制失败', 'error');
        });
    }, [addNotification]);

    // 导航项配置
    const navigationItems = [
        { id: 'wallet', name: '钱包管理', icon: Wallet },
        { id: 'transfer', name: '转账', icon: Send },
        { id: 'mining', name: '挖矿', icon: Pickaxe },
        { id: 'staking', name: '质押', icon: Users },
        { id: 'explorer', name: '区块浏览器', icon: Eye }
    ];

    return (
        <div className="min-h-screen bg-gray-100">
            {/* 通知系统 */}
            <div className="fixed top-4 right-4 z-50 space-y-2">
                {notifications.map(notification => (
                    <div
                        key={notification.id}
                        className={`px-4 py-2 rounded-lg text-white flex items-center space-x-2 ${
                            notification.type === 'success' ? 'bg-green-500' :
                                notification.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
                        }`}
                    >
                        {notification.type === 'success' && <Check size={16} />}
                        {notification.type === 'error' && <X size={16} />}
                        {notification.type === 'info' && <Info size={16} />}
                        <span>{notification.message}</span>
                    </div>
                ))}
            </div>

            {/* Header */}
            <div className="bg-white shadow-sm border-b">
                <div className="max-w-6xl mx-auto px-4 py-4">
                    <h1 className="text-2xl font-bold text-gray-900">Cosmos 区块链应用</h1>
                    <div className="mt-2 grid grid-cols-4 gap-4 text-sm">
                        <div className="bg-blue-50 p-2 rounded">
                            <div className="text-blue-600 font-medium">区块高度</div>
                            <div className="text-lg font-bold">{chainInfo.blockHeight}</div>
                        </div>
                        <div className="bg-green-50 p-2 rounded">
                            <div className="text-green-600 font-medium">总供应量</div>
                            <div className="text-lg font-bold">{chainInfo.totalSupply.toLocaleString()}</div>
                        </div>
                        <div className="bg-purple-50 p-2 rounded">
                            <div className="text-purple-600 font-medium">活跃验证者</div>
                            <div className="text-lg font-bold">{chainInfo.activeValidators}</div>
                        </div>
                        <div className="bg-orange-50 p-2 rounded">
                            <div className="text-orange-600 font-medium">待处理交易</div>
                            <div className="text-lg font-bold">{chainInfo.pendingTransactions}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <div className="bg-white shadow-sm">
                <div className="max-w-6xl mx-auto px-4">
                    <nav className="flex space-x-8">
                        {navigationItems.map(({ id, name, icon: Icon }) => (
                            <button
                                key={id}
                                onClick={() => setActiveTab(id)}
                                className={`flex items-center space-x-2 py-4 px-2 border-b-2 transition-colors ${
                                    activeTab === id
                                        ? 'border-blue-500 text-blue-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                <Icon size={20} />
                                <span>{name}</span>
                            </button>
                        ))}
                    </nav>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-6xl mx-auto px-4 py-6">
                {/* 钱包管理 */}
                {activeTab === 'wallet' && (
                    <div className="space-y-6">
                        <div className="bg-white rounded-lg shadow p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-semibold">钱包管理</h2>
                                <button
                                    onClick={createWallet}
                                    className="flex items-center space-x-2 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
                                >
                                    <Plus size={20} />
                                    <span>创建钱包</span>
                                </button>
                            </div>

                            <div className="grid gap-4">
                                {wallets.map((wallet, index) => (
                                    <div
                                        key={index}
                                        className={`p-4 border rounded-lg cursor-pointer transition-all ${
                                            selectedWallet?.address === wallet.address
                                                ? 'border-blue-500 bg-blue-50'
                                                : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                        onClick={() => setSelectedWallet(wallet)}
                                    >
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <div className="flex items-center space-x-2">
                                                    <span className="font-medium">钱包 #{index + 1}</span>
                                                    {selectedWallet?.address === wallet.address && (
                                                        <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded">已选中</span>
                                                    )}
                                                </div>
                                                <div className="flex items-center space-x-2 text-sm text-gray-600">
                                                    <span>地址: {wallet.address}</span>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            copyToClipboard(wallet.address);
                                                        }}
                                                        className="text-blue-500 hover:text-blue-700 transition-colors"
                                                    >
                                                        <Copy size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-lg font-semibold">
                                                    {blockchain.getBalance(wallet.address).toLocaleString()} ATOM
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {wallets.length === 0 && (
                                    <div className="text-center py-8 text-gray-500">
                                        还没有钱包，点击上方按钮创建一个
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* 转账 */}
                {activeTab === 'transfer' && (
                    <div className="bg-white rounded-lg shadow p-6">
                        <h2 className="text-xl font-semibold mb-4">发起转账</h2>

                        {selectedWallet ? (
                            <div className="space-y-4">
                                <div className="bg-gray-50 p-4 rounded-lg">
                                    <div className="text-sm text-gray-600">当前钱包</div>
                                    <div className="font-medium">{selectedWallet.address}</div>
                                    <div className="text-lg font-semibold text-green-600">
                                        余额: {blockchain.getBalance(selectedWallet.address).toLocaleString()} ATOM
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        接收地址
                                    </label>
                                    <input
                                        type="text"
                                        value={transferForm.toAddress}
                                        onChange={(e) => setTransferForm(prev => ({ ...prev, toAddress: e.target.value }))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="输入接收地址"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            转账金额
                                        </label>
                                        <input
                                            type="number"
                                            value={transferForm.amount}
                                            onChange={(e) => setTransferForm(prev => ({ ...prev, amount: e.target.value }))}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="0"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            手续费
                                        </label>
                                        <input
                                            type="number"
                                            value={transferForm.fee}
                                            onChange={(e) => setTransferForm(prev => ({ ...prev, fee: e.target.value }))}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>

                                <button
                                    onClick={handleTransfer}
                                    className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 flex items-center justify-center space-x-2 transition-colors"
                                >
                                    <Send size={20} />
                                    <span>发起转账</span>
                                </button>
                            </div>
                        ) : (
                            <div className="text-center py-8 text-gray-500">
                                请先在钱包管理页面选择一个钱包
                            </div>
                        )}
                    </div>
                )}

                {/* 挖矿 */}
                {activeTab === 'mining' && (
                    <div className="bg-white rounded-lg shadow p-6">
                        <h2 className="text-xl font-semibold mb-4">挖矿 / 出块</h2>

                        <div className="space-y-4">
                            <div className="bg-yellow-50 p-4 rounded-lg">
                                <div className="flex items-center space-x-2 text-yellow-800">
                                    <Info size={20} />
                                    <span className="font-medium">挖矿说明</span>
                                </div>
                                <p className="text-yellow-700 mt-2">
                                    在Cosmos网络中，验证者负责出块并获得奖励。点击下方按钮模拟验证者出块过程。
                                </p>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                {Array.from(blockchain.validators.values()).map((validator, index) => (
                                    <div key={index} className="bg-gray-50 p-4 rounded-lg">
                                        <div className="font-medium">{validator.address}</div>
                                        <div className="text-sm text-gray-600">
                                            权重: {validator.stake.toLocaleString()}
                                        </div>
                                        <div className="text-sm text-gray-600">
                                            余额: {blockchain.getBalance(validator.address).toLocaleString()} ATOM
                                        </div>
                                        <div className="text-sm text-gray-600">
                                            出块数: {validator.totalBlocks}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={handleMining}
                                className="w-full bg-orange-500 text-white py-3 px-4 rounded-lg hover:bg-orange-600 flex items-center justify-center space-x-2 transition-colors"
                            >
                                <Pickaxe size={20} />
                                <span>开始挖矿 (奖励: {blockchain.miningReward} ATOM)</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* 质押 */}
                {activeTab === 'staking' && (
                    <div className="bg-white rounded-lg shadow p-6">
                        <h2 className="text-xl font-semibold mb-4">质押委托</h2>

                        {selectedWallet ? (
                            <div className="space-y-4">
                                <div className="bg-gray-50 p-4 rounded-lg">
                                    <div className="text-sm text-gray-600">当前钱包</div>
                                    <div className="font-medium">{selectedWallet.address}</div>
                                    <div className="text-lg font-semibold text-green-600">
                                        可用余额: {blockchain.getBalance(selectedWallet.address).toLocaleString()} ATOM
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        选择验证者
                                    </label>
                                    <select
                                        value={stakingForm.validatorAddress}
                                        onChange={(e) => setStakingForm(prev => ({ ...prev, validatorAddress: e.target.value }))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        {Array.from(blockchain.validators.values()).map((validator, index) => (
                                            <option key={index} value={validator.address}>
                                                {validator.address} (权重: {validator.stake.toLocaleString()})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        质押金额
                                    </label>
                                    <input
                                        type="number"
                                        value={stakingForm.amount}
                                        onChange={(e) => setStakingForm(prev => ({ ...prev, amount: e.target.value }))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="输入质押金额"
                                    />
                                </div>

                                <button
                                    onClick={handleStaking}
                                    className="w-full bg-purple-500 text-white py-2 px-4 rounded-lg hover:bg-purple-600 flex items-center justify-center space-x-2 transition-colors"
                                >
                                    <Users size={20} />
                                    <span>委托质押</span>
                                </button>

                                {/* 显示当前质押信息 */}
                                <div className="bg-blue-50 p-4 rounded-lg">
                                    <h3 className="font-medium text-blue-800 mb-2">当前质押</h3>
                                    {blockchain.getStakingInfo(selectedWallet.address).size > 0 ? (
                                        <div className="space-y-1">
                                            {Array.from(blockchain.getStakingInfo(selectedWallet.address)).map(([validator, amount]) => (
                                                <div key={validator} className="flex justify-between text-sm">
                                                    <span>{validator}</span>
                                                    <span className="font-medium">{amount.toLocaleString()} ATOM</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-blue-600 text-sm">暂无质押</div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-8 text-gray-500">
                                请先在钱包管理页面选择一个钱包
                            </div>
                        )}
                    </div>
                )}

                {/* 区块浏览器 */}
                {activeTab === 'explorer' && (
                    <div className="space-y-6">
                        <div className="bg-white rounded-lg shadow p-6">
                            <h2 className="text-xl font-semibold mb-4">区块浏览器</h2>

                            <div className="space-y-4">
                                {blockchain.chain.slice().reverse().map((block) => (
                                    <div key={block.index} className="border rounded-lg p-4">
                                        <div className="flex justify-between items-center mb-2">
                                            <div className="font-medium">区块 #{block.index}</div>
                                            <div className="text-sm text-gray-500">
                                                {new Date(block.timestamp).toLocaleString()}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div>
                                                <span className="text-gray-600">哈希: </span>
                                                <span className="font-mono">{block.hash.substring(0, 16)}...</span>
                                            </div>
                                            <div>
                                                <span className="text-gray-600">验证者: </span>
                                                <span>{block.validator}</span>
                                            </div>
                                            <div>
                                                <span className="text-gray-600">前一区块: </span>
                                                <span className="font-mono">{block.previousHash.substring(0, 16)}...</span>
                                            </div>
                                            <div>
                                                <span className="text-gray-600">交易数量: </span>
                                                <span>{block.transactions.length}</span>
                                            </div>
                                        </div>

                                        {block.transactions.length > 0 && (
                                            <div className="mt-4">
                                                <div className="text-sm font-medium text-gray-700 mb-2">交易列表:</div>
                                                <div className="space-y-2">
                                                    {block.transactions.map((tx, txIndex) => (
                                                        <div key={txIndex} className="bg-gray-50 p-2 rounded text-sm">
                                                            <div className="flex items-center space-x-2">
                                                                {tx.fromAddress ? (
                                                                    <>
                                                                        <span>{tx.fromAddress}</span>
                                                                        <ArrowRight size={16} />
                                                                        <span>{tx.toAddress}</span>
                                                                        <span className="font-medium">{tx.amount} ATOM</span>
                                                                        {tx.fee > 0 && (
                                                                            <span className="text-gray-500">(手续费: {tx.fee})</span>
                                                                        )}
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <span className="text-green-600">挖矿奖励</span>
                                                                        <ArrowRight size={16} />
                                                                        <span>{tx.toAddress}</span>
                                                                        <span className="font-medium text-green-600">{tx.amount} ATOM</span>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BlockchainApp;