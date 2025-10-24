//js/config.js
export const CONFIG = {
    API_ENDPOINT: '/api/balance',
    STORAGE_KEY: 'nexaView_wallets',
    DONATION_WALLET_ADDRESS: 'nexa:nqtsq5g5psnrfuy7mwwe7zelgjdcevme5re2lwuf7gnmy9ts'
};

export const state = {
    currentAddress: '',
    currentBalance: undefined,
    isLoading: false,
    savedWallets: []
};
