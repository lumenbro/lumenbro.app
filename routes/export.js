// routes/export.js - Export functionality routes
const express = require('express');
const router = express.Router();
const pool = require('../db');

// Serve the export page
router.get('/export', (req, res) => {
    res.sendFile('export.html', { root: './public' });
});

// Get wallet information for export
router.post('/api/wallet-info', async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ 
                success: false, 
                error: 'Email is required' 
            });
        }

        // Query database for user and wallet information
        const userQuery = `
            SELECT u.telegram_id, u.user_email, tw.turnkey_sub_org_id, tw.turnkey_key_id, tw.public_key
            FROM users u
            LEFT JOIN turnkey_wallets tw ON u.telegram_id = tw.telegram_id
            WHERE u.user_email = $1 AND tw.is_active = TRUE
        `;
        
        const userResult = await pool.query(userQuery, [email]);
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'User not found or no active wallet' 
            });
        }

        const user = userResult.rows[0];
        
        // For now, we'll return placeholder data
        // In production, you'd query Turnkey API to get the actual wallet account info
        const walletInfo = {
            subOrgId: user.turnkey_sub_org_id,
            walletId: 'fbd53f01-730c-52b0-81dd-18a59940a17d', // This would come from Turnkey API
            walletAccountId: '4abb07f0-4670-411b-a157-e48ca0f4f15f', // This would come from Turnkey API
            stellarAddress: 'GCRIE4GIELZQT6E2LWY7NIAG3WOEFA7ZV7ZVKKDON7XQ7AZJ37B3RFHI' // This would come from Turnkey API
        };

        res.json({
            success: true,
            walletInfo
        });

    } catch (error) {
        console.error('Error getting wallet info:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error' 
        });
    }
});

// Get actual wallet information from Turnkey (for production)
router.post('/api/wallet-info-turnkey', async (req, res) => {
    try {
        const { email, apiPublicKey, apiPrivateKey } = req.body;
        
        if (!email || !apiPublicKey || !apiPrivateKey) {
            return res.status(400).json({ 
                success: false, 
                error: 'Email and API keys are required' 
            });
        }

        // Get user's sub-org ID from database
        const userQuery = `
            SELECT tw.turnkey_sub_org_id
            FROM users u
            LEFT JOIN turnkey_wallets tw ON u.telegram_id = tw.telegram_id
            WHERE u.user_email = $1 AND tw.is_active = TRUE
        `;
        
        const userResult = await pool.query(userQuery, [email]);
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'User not found or no active wallet' 
            });
        }

        const subOrgId = userResult.rows[0].turnkey_sub_org_id;

        // Initialize Turnkey client with user's API keys
        const { Turnkey } = require('@turnkey/sdk-server');
        const userClient = new Turnkey({
            apiBaseUrl: "https://api.turnkey.com",
            apiPublicKey: apiPublicKey,
            apiPrivateKey: apiPrivateKey,
            defaultOrganizationId: subOrgId,
        });

        // Get wallets
        const wallets = await userClient.apiClient().getWallets({
            organizationId: subOrgId
        });

        if (!wallets.wallets || wallets.wallets.length === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'No wallets found' 
            });
        }

        const wallet = wallets.wallets[0];
        const stellarAddress = wallet.addresses?.[0];

        if (!stellarAddress) {
            return res.status(404).json({ 
                success: false, 
                error: 'No Stellar address found' 
            });
        }

        // Get wallet accounts
        const accounts = await userClient.apiClient().getWalletAccounts({
            organizationId: subOrgId,
            walletId: wallet.walletId
        });

        if (!accounts.accounts || accounts.accounts.length === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'No wallet accounts found' 
            });
        }

        const walletAccount = accounts.accounts[0];

        const walletInfo = {
            subOrgId: subOrgId,
            walletId: wallet.walletId,
            walletAccountId: walletAccount.walletAccountId,
            stellarAddress: stellarAddress
        };

        res.json({
            success: true,
            walletInfo
        });

    } catch (error) {
        console.error('Error getting Turnkey wallet info:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error: ' + error.message 
        });
    }
});

module.exports = router;
