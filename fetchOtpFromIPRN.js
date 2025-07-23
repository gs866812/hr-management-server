// fetchOtpFromIPRN.js
const axios = require("axios");

const fetchOtpFromIPRN = async (phoneNumber, token) => {
    console.log(`🔎 Fetching OTP for number: ${phoneNumber}`);

    const maxPages = 2;
    const baseURL = "https://api.iprn.pro/api/public/v1/stock/edr-account";
    const headers = {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json"
    };

    const params = {
        type: "sms",
        stock_account: 0,
        perPage: 12,
        sortColumn: "created_at",
        sortDirection: "desc",
        [`period[0]`]: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(), // 7 days back
        [`period[1]`]: new Date().toISOString()
    };

    try {
        for (let page = 1; page <= maxPages; page++) {
            try {
                const response = await axios.get(baseURL, {
                    headers,
                    params: { ...params, page }
                });

                const messages = response.data?.data || [];

                for (let msg of messages) {
                    const bNum = msg.b_number?.replace(/\D/g, '');
                    const target = phoneNumber.replace(/\D/g, '');

                    if (bNum?.includes(target) && msg.message) {
                        const match = msg.message.match(/n\/(\d{5})/);
                        if (match) {
                            return match[1]; // return only the 5-digit OTP
                        } else {
                            return msg.message.trim(); // fallback if format unexpected
                        }
                    }
                }
            } catch (error) {
                // 👇 Token expiry alert added here
                if (error.response?.status === 401) {
                    console.error("🚨 Token expired or unauthorized. Please update your IPRN token.");
                }

                console.error(`❌ Error on page ${page}:`, error.response?.statusText || error.message);
            }
        }
    } catch (err) {
        console.error("❌ Final error:", err.message);
    }

    console.log(`📭 No OTM found for ${phoneNumber}`);
    return null;
};

module.exports = fetchOtpFromIPRN;
