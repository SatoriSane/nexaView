//js/config.js
export const CONFIG = {
    API_ENDPOINT: '/api/balance',
    STORAGE_KEY: 'nexaView_wallets',
    DONATION_WALLET_ADDRESS: 'nexa:nqtsq5g57ryq398vhaqwlr6tpa2ekjlghus8z5yv6emmj3ux'
};

export const state = {
    currentAddress: '',
    currentBalance: undefined,
    isLoading: false,
    savedWallets: []
};
