//js/config.js
export const CONFIG = {
    API_ENDPOINT: '/api/balance',
    STORAGE_KEY: 'nexaView_wallets',
    DONATION_WALLET_ADDRESS: 'nexa:nqtsq5g5v4c8h6scqupva6t2v5t3x5twgpzrjd324dady0k2'
};

export const state = {
    currentAddress: '',
    currentBalance: undefined,
    isLoading: false,
    savedWallets: []
};
