# 💰 Fee Collection Architecture for Client-Side Signing

## 🎯 **The Challenge**

**Client-side signing** gives users full control but **no fee collection**. We need a hybrid approach:

### **Problem:**
- User signs transaction directly → No fees collected
- Server can't modify signed transaction → Can't add fee operations
- Need to calculate fees based on user status (referral, pioneer, etc.)

### **Solution:**
**Server calculates fees → Adds fee operations → User signs complete transaction**

## 🔧 **Enhanced Signing Flow**

### **1. Fee-Aware Client-Side Signing**

```javascript
// Enhanced client-side signing with fee collection
class FeeAwareClientSigner {
  async signTransactionWithFees(transaction, context) {
    try {
      // 1. Send transaction to server for fee calculation
      const feeCalculation = await this.calculateFees(transaction, context);
      
      // 2. Server returns transaction with fee operations added
      const transactionWithFees = feeCalculation.transaction;
      
      // 3. User signs the complete transaction (including fees)
      const signature = await this.clientSideSign(transactionWithFees);
      
      // 4. Submit signed transaction to network
      return await this.submitTransaction(signature);
      
    } catch (error) {
      throw new Error('Fee calculation failed: ' + error.message);
    }
  }
  
  async calculateFees(transaction, context) {
    const response = await fetch('/api/calculate-fees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transaction: transaction.toXDR(),
        context: context,
        user_id: this.getCurrentUserId()
      })
    });
    
    return await response.json();
  }
}
```

### **2. Server-Side Fee Calculation**

```python
# Python bot endpoint for fee calculation
@app.post('/api/calculate-fees')
async def calculate_fees(request):
    try:
        # 1. Parse the transaction
        xdr = request.get('transaction')
        context = request.get('context')
        user_id = request.get('user_id')
        
        # 2. Get user status from database
        user_status = await get_user_status(user_id)
        
        # 3. Calculate fees based on user status
        fee_amount = calculate_fee_amount(
            transaction_value=context.get('amount'),
            user_status=user_status
        )
        
        # 4. Add fee payment operation to transaction
        transaction_with_fees = add_fee_operation(xdr, fee_amount)
        
        # 5. Return enhanced transaction for client signing
        return {
            "success": True,
            "transaction": transaction_with_fees,
            "fee_amount": fee_amount,
            "user_status": user_status
        }
        
    except Exception as e:
        return {"error": str(e)}
```

### **3. Fee Calculation Logic**

```python
def calculate_fee_amount(transaction_value, user_status):
    """Calculate fees based on user status and transaction value"""
    
    # Base fee rate (1% of transaction value)
    base_fee_rate = 0.01
    
    # Apply discounts based on user status
    if user_status.get('is_pioneer'):
        discount_rate = 0.90  # 90% discount for pioneers
    elif user_status.get('is_referral'):
        discount_rate = 0.10  # 10% discount for referrals
    else:
        discount_rate = 0.00  # No discount
    
    # Calculate final fee
    base_fee = transaction_value * base_fee_rate
    discount_amount = base_fee * discount_rate
    final_fee = base_fee - discount_amount
    
    return final_fee

def add_fee_operation(xdr, fee_amount):
    """Add fee payment operation to existing transaction"""
    
    # Parse existing transaction
    transaction = Transaction.from_xdr(xdr)
    
    # Create fee payment operation
    fee_operation = Payment(
        source=transaction.source,
        destination="FEE_COLLECTION_ACCOUNT",  # Your fee collection account
        asset=Asset.native(),
        amount=str(fee_amount)
    )
    
    # Add fee operation to transaction
    transaction.operations.append(fee_operation)
    
    # Return updated transaction XDR
    return transaction.to_xdr()
```

## 🎯 **User Status Management**

### **Database Schema Enhancement**

```sql
-- Add fee-related fields to users table
ALTER TABLE users ADD COLUMN fee_discount_rate DECIMAL(3,2) DEFAULT 0.00;
ALTER TABLE users ADD COLUMN fee_discount_type VARCHAR(20) DEFAULT 'none';
ALTER TABLE users ADD COLUMN fee_discount_expiry TIMESTAMP;

-- Update existing users with pioneer status
UPDATE users 
SET fee_discount_rate = 0.90, 
    fee_discount_type = 'pioneer' 
WHERE pioneer_status = TRUE;

-- Update referral users
UPDATE users 
SET fee_discount_rate = 0.10, 
    fee_discount_type = 'referral' 
WHERE referral_code IS NOT NULL;
```

### **User Status Check**

```python
async def get_user_status(user_id):
    """Get user's fee discount status"""
    
    query = """
        SELECT 
            telegram_id,
            pioneer_status,
            referral_code,
            fee_discount_rate,
            fee_discount_type,
            fee_discount_expiry
        FROM users 
        WHERE telegram_id = %s
    """
    
    result = await pool.execute(query, [user_id])
    user = result.fetchone()
    
    if not user:
        return {"error": "User not found"}
    
    # Check if discount is still valid
    is_discount_valid = (
        user['fee_discount_expiry'] is None or 
        user['fee_discount_expiry'] > datetime.now()
    )
    
    return {
        "is_pioneer": user['pioneer_status'] and is_discount_valid,
        "is_referral": user['referral_code'] is not None and is_discount_valid,
        "discount_rate": user['fee_discount_rate'] if is_discount_valid else 0.00,
        "discount_type": user['fee_discount_type'] if is_discount_valid else 'none'
    }
```

## 🔄 **Enhanced Wallet Integration**

### **1. Update Wallet Interface**

```javascript
// Enhanced wallet with fee-aware signing
class EnhancedWallet {
  async signTransaction(transaction, context) {
    // Determine signing method based on context
    if (context.requiresFees) {
      // Use fee-aware client-side signing
      return await this.feeAwareClientSign(transaction, context);
    } else if (context.isAutomated) {
      // Use server-side signing (no user interaction)
      return await this.serverSideSign(transaction);
    } else {
      // Use regular client-side signing (no fees)
      return await this.clientSideSign(transaction);
    }
  }
  
  async feeAwareClientSign(transaction, context) {
    try {
      // 1. Show fee preview to user
      const feePreview = await this.previewFees(transaction, context);
      const userApproved = await this.showFeePreview(feePreview);
      
      if (!userApproved) {
        throw new Error('User cancelled fee payment');
      }
      
      // 2. Calculate and add fees server-side
      const transactionWithFees = await this.calculateFees(transaction, context);
      
      // 3. Show password prompt for signing
      const password = await this.showPasswordPrompt();
      
      // 4. Sign the complete transaction (including fees)
      const signature = await this.signWithPassword(transactionWithFees, password);
      
      // 5. Submit to network
      return await this.submitTransaction(signature);
      
    } catch (error) {
      throw new Error('Fee-aware signing failed: ' + error.message);
    }
  }
  
  async previewFees(transaction, context) {
    const response = await fetch('/api/preview-fees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transaction: transaction.toXDR(),
        context: context,
        user_id: this.getCurrentUserId()
      })
    });
    
    return await response.json();
  }
  
  async showFeePreview(feePreview) {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.innerHTML = `
        <div class="fee-preview-modal">
          <h3>💰 Fee Preview</h3>
          <div class="fee-breakdown">
            <p><strong>Transaction Amount:</strong> ${feePreview.transaction_amount} XLM</p>
            <p><strong>Base Fee:</strong> ${feePreview.base_fee} XLM</p>
            <p><strong>Your Discount:</strong> ${feePreview.discount_type} (${feePreview.discount_rate}%)</p>
            <p><strong>Final Fee:</strong> ${feePreview.final_fee} XLM</p>
            <p><strong>Total Amount:</strong> ${feePreview.total_amount} XLM</p>
          </div>
          <div class="fee-actions">
            <button onclick="approveFees()">✅ Approve & Sign</button>
            <button onclick="cancelFees()">❌ Cancel</button>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      
      window.approveFees = () => {
        document.body.removeChild(modal);
        resolve(true);
      };
      
      window.cancelFees = () => {
        document.body.removeChild(modal);
        resolve(false);
      };
    });
  }
}
```

### **2. Fee Preview Endpoint**

```python
@app.post('/api/preview-fees')
async def preview_fees(request):
    """Preview fees without modifying transaction"""
    try:
        xdr = request.get('transaction')
        context = request.get('context')
        user_id = request.get('user_id')
        
        # Get user status
        user_status = await get_user_status(user_id)
        
        # Calculate fees
        transaction_value = float(context.get('amount', 0))
        fee_amount = calculate_fee_amount(transaction_value, user_status)
        
        return {
            "success": True,
            "transaction_amount": transaction_value,
            "base_fee": transaction_value * 0.01,  # 1% base fee
            "discount_type": user_status.get('discount_type', 'none'),
            "discount_rate": user_status.get('discount_rate', 0.00) * 100,
            "final_fee": fee_amount,
            "total_amount": transaction_value + fee_amount
        }
        
    except Exception as e:
        return {"error": str(e)}
```

## 🎯 **Implementation Strategy**

### **Phase 1: Basic Fee Collection**
1. **Add fee calculation endpoints** to Python bot
2. **Update user database** with fee discount fields
3. **Test fee calculation** with different user types

### **Phase 2: Enhanced Wallet**
1. **Add fee preview UI** to wallet interface
2. **Implement fee-aware signing** flow
3. **Test complete flow** with real transactions

### **Phase 3: Optimization**
1. **Cache user status** for faster fee calculation
2. **Add fee analytics** and reporting
3. **Implement fee collection monitoring**

## ✅ **Benefits of This Approach**

### **Security**
- **User control**: User still signs their own transactions
- **Transparency**: User sees exact fees before signing
- **No key exposure**: Server never sees user's private keys

### **Flexibility**
- **Dynamic fees**: Fees calculated based on user status
- **Multiple discounts**: Pioneer, referral, and future discount types
- **Easy updates**: Fee rates and rules can be changed server-side

### **User Experience**
- **Clear preview**: User sees exactly what they're paying
- **Automatic discounts**: No manual coupon codes needed
- **Seamless flow**: Fee calculation happens automatically

## 🚀 **Next Steps**

1. **Implement fee calculation endpoints** in your Python bot
2. **Add fee-related fields** to your users table
3. **Update wallet interface** with fee preview
4. **Test with different user types** (pioneer, referral, regular)
5. **Deploy and monitor** fee collection

This approach gives you **the best of both worlds**: **user control** with **automatic fee collection**! 🎉
