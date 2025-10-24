//js/config.js
export const CONFIG = {
    API_ENDPOINT: '/api/balance',
    STORAGE_KEY: 'nexaView_wallets',
    DONATION_WALLET_ADDRESS: 'nexa:nqtsq5g5vv8nww2wms2wcm2cna2r5lm4cj3avp397dkt4y7f'
};

export const state = {
    currentAddress: '',
    currentBalance: undefined,
    isLoading: false,
    savedWallets: []
};
