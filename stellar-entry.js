// stellar-entry.js - Stellar SDK bundle for browser use
console.log('stellar-entry.js starting...');

(async () => {
  try {
    // Import Stellar SDK components
    const { 
      StellarSdk,
      TransactionBuilder,
      Account,
      Operation,
      Asset,
      Networks,
      BASE_FEE,
      Memo,
      Keypair,
      Server,
      SorobanRpc,
      TimeoutInfinite,
      xdr
    } = await import('@stellar/stellar-sdk');

    // Initialize Stellar SDK global object
    window.StellarSdk = {
      // Core classes
      TransactionBuilder,
      Account,
      Operation,
      Asset,
      Networks,
      BASE_FEE,
      Memo,
      Keypair,
      Server,
      SorobanRpc,
      TimeoutInfinite,
      xdr,
      
      // Convenience methods for common operations
      createPaymentTransaction: async (sourceAccount, destination, amount, asset = 'XLM', memo = null) => {
        const server = new Server('https://horizon.stellar.org');
        const account = await server.loadAccount(sourceAccount);
        
        const transaction = new TransactionBuilder(account, {
          fee: BASE_FEE,
          networkPassphrase: Networks.PUBLIC
        })
        .addOperation(Operation.payment({
          destination: destination,
          asset: asset === 'XLM' ? Asset.native() : Asset.fromOperation(asset),
          amount: amount.toString()
        }))
        .setTimeout(30);
        
        if (memo) {
          transaction.addMemo(Memo.text(memo));
        }
        
        return transaction.build();
      },
      
      createPathPaymentStrictSend: async (sourceAccount, sendAsset, sendAmount, destination, destAsset, destMin, path = []) => {
        const server = new Server('https://horizon.stellar.org');
        const account = await server.loadAccount(sourceAccount);
        
        const transaction = new TransactionBuilder(account, {
          fee: BASE_FEE,
          networkPassphrase: Networks.PUBLIC
        })
        .addOperation(Operation.pathPaymentStrictSend({
          sendAsset: sendAsset === 'XLM' ? Asset.native() : Asset.fromOperation(sendAsset),
          sendAmount: sendAmount.toString(),
          destination: destination,
          destAsset: destAsset === 'XLM' ? Asset.native() : Asset.fromOperation(destAsset),
          destMin: destMin.toString(),
          path: path.map(asset => asset === 'XLM' ? Asset.native() : Asset.fromOperation(asset))
        }))
        .setTimeout(30);
        
        return transaction.build();
      },
      
      createPathPaymentStrictReceive: async (sourceAccount, sendAsset, sendMax, destination, destAsset, destAmount, path = []) => {
        const server = new Server('https://horizon.stellar.org');
        const account = await server.loadAccount(sourceAccount);
        
        const transaction = new TransactionBuilder(account, {
          fee: BASE_FEE,
          networkPassphrase: Networks.PUBLIC
        })
        .addOperation(Operation.pathPaymentStrictReceive({
          sendAsset: sendAsset === 'XLM' ? Asset.native() : Asset.fromOperation(sendAsset),
          sendMax: sendMax.toString(),
          destination: destination,
          destAsset: destAsset === 'XLM' ? Asset.native() : Asset.fromOperation(destAsset),
          destAmount: destAmount.toString(),
          path: path.map(asset => asset === 'XLM' ? Asset.native() : Asset.fromOperation(asset))
        }))
        .setTimeout(30);
        
        return transaction.build();
      },
      
      // Asset management operations
      createTrustline: async (sourceAccount, asset, limit = '922337203685.4775807') => {
        const server = new Server('https://horizon.stellar.org');
        const account = await server.loadAccount(sourceAccount);
        
        const transaction = new TransactionBuilder(account, {
          fee: BASE_FEE,
          networkPassphrase: Networks.PUBLIC
        })
        .addOperation(Operation.changeTrust({
          asset: Asset.fromOperation(asset),
          limit: limit
        }))
        .setTimeout(30);
        
        return transaction.build();
      },
      
      removeTrustline: async (sourceAccount, asset) => {
        const server = new Server('https://horizon.stellar.org');
        const account = await server.loadAccount(sourceAccount);
        
        const transaction = new TransactionBuilder(account, {
          fee: BASE_FEE,
          networkPassphrase: Networks.PUBLIC
        })
        .addOperation(Operation.changeTrust({
          asset: Asset.fromOperation(asset),
          limit: '0'
        }))
        .setTimeout(30);
        
        return transaction.build();
      },
      
      // Account operations
      createAccount: async (sourceAccount, destination, startingBalance = '1') => {
        const server = new Server('https://horizon.stellar.org');
        const account = await server.loadAccount(sourceAccount);
        
        const transaction = new TransactionBuilder(account, {
          fee: BASE_FEE,
          networkPassphrase: Networks.PUBLIC
        })
        .addOperation(Operation.createAccount({
          destination: destination,
          startingBalance: startingBalance
        }))
        .setTimeout(30);
        
        return transaction.build();
      },
      
      // Utility functions
      validateStellarAddress: (address) => {
        try {
          Keypair.fromPublicKey(address);
          return true;
        } catch {
          return false;
        }
      },
      
      getAccountInfo: async (address) => {
        const server = new Server('https://horizon.stellar.org');
        return await server.loadAccount(address);
      },
      
      getAccountBalances: async (address) => {
        const server = new Server('https://horizon.stellar.org');
        const account = await server.loadAccount(address);
        return account.balances;
      },
      
      // Fee estimation
      estimateFee: async (operations = 1) => {
        return BASE_FEE * operations;
      },
      
      // Network utilities
      getNetworkPassphrase: () => Networks.PUBLIC,
      getTestnetPassphrase: () => Networks.TESTNET,
      
      // XDR utilities
      fromXDR: (xdrString, type) => {
        return xdr[type].fromXDR(xdrString, 'base64');
      },
      
      toXDR: (object) => {
        return object.toXDR();
      }
    };

    console.log('stellar-entry.js finished – window.StellarSdk set.');
  } catch (error) {
    console.error('Error in stellar-entry.js:', error);
  }
})();
