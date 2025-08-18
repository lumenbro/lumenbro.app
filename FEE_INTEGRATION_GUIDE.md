# 💰 Fee Integration Guide

## 🎯 **New Fee Endpoints Added to Node.js Backend**

I've added **3 new endpoints** to your existing `auth.js` that provide fee calculation functionality:

### **1. Get User Fee Status by Telegram ID**
```http
GET /mini-app/user-fee-status/:telegram_id
```

**Response:**
```json
{
  "success": true,
  "user": {
    "telegram_id": 123456789,
    "email": "user@example.com",
    "public_key": "G...",
    "pioneer_status": true,
    "referral_code": "123456",
    "is_referral": false
  },
  "fee_status": {
    "discount_type": "pioneer",
    "discount_rate": 0.90,
    "discount_description": "Pioneer/Founder (90% discount)",
    "base_fee_rate": 0.01,
    "final_fee_rate": 0.001
  }
}
```

### **2. Get User Fee Status by Org ID**
```http
GET /mini-app/user-fee-status-by-org/:orgId
```

**Use case:** When wallet has `orgId` but needs fee status

### **3. Calculate Fees for Transaction**
```http
POST /mini-app/calculate-fees
```

**Request:**
```json
{
  "telegram_id": 123456789,
  "transaction_amount": 100.50,
  "transaction_type": "payment"
}
```

**Response:**
```json
{
  "success": true,
  "calculation": {
    "transaction_amount": 100.50,
    "transaction_type": "payment",
    "base_fee_rate": 0.01,
    "base_fee": 1.005,
    "discount_type": "pioneer",
    "discount_rate": 0.90,
    "discount_amount": 0.9045,
    "final_fee": 0.1005,
    "total_amount": 100.6005
  },
  "user_status": {
    "telegram_id": 123456789,
    "pioneer_status": true,
    "referral_code": "123456",
    "is_referral": false
  }
}
```

## 🔄 **Integration Options**

### **Option A: Python Bot Calls Node.js (Recommended)**

**Why this is best:**
- ✅ **Single source of truth** - All user logic in Node.js
- ✅ **No duplication** - Reuse existing database connections
- ✅ **Consistent architecture** - Node.js handles users, Python handles trading
- ✅ **Easy maintenance** - One place to update fee logic

**Python Bot Integration:**
```python
import aiohttp

async def get_user_fee_status(telegram_id):
    """Get user fee status from Node.js backend"""
    async with aiohttp.ClientSession() as session:
        async with session.get(f'http://your-nodejs-server/mini-app/user-fee-status/{telegram_id}') as response:
            if response.status == 200:
                data = await response.json()
                return data['fee_status']
            else:
                raise Exception(f"Failed to get fee status: {response.status}")

async def calculate_fees(telegram_id, transaction_amount, transaction_type='payment'):
    """Calculate fees using Node.js backend"""
    async with aiohttp.ClientSession() as session:
        payload = {
            'telegram_id': telegram_id,
            'transaction_amount': transaction_amount,
            'transaction_type': transaction_type
        }
        async with session.post('http://your-nodejs-server/mini-app/calculate-fees', json=payload) as response:
            if response.status == 200:
                data = await response.json()
                return data['calculation']
            else:
                raise Exception(f"Failed to calculate fees: {response.status}")

# Use in your existing /api/sign endpoint
@app.post('/api/sign')
async def sign_transaction(request):
    telegram_id = request.get('telegram_id')
    xdr = request.get('xdr')
    amount = request.get('amount', 0)
    
    # Get fee calculation from Node.js
    fee_calculation = await calculate_fees(telegram_id, amount)
    
    # Add fee operation to transaction
    transaction_with_fees = add_fee_operation(xdr, fee_calculation['final_fee'])
    
    # Continue with existing signing logic...
```

### **Option B: Wallet Calls Node.js Directly**

**For client-side fee preview:**
```javascript
// In your wallet interface
async function previewFees(transaction, context) {
  const response = await fetch(`/mini-app/calculate-fees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      telegram_id: getCurrentUserId(),
      transaction_amount: context.amount,
      transaction_type: context.type
    })
  });
  
  return await response.json();
}

// Show fee preview to user
const feePreview = await previewFees(transaction, context);
showFeePreview(feePreview);
```

### **Option C: Hybrid Approach (Best of Both)**

**Wallet:** Calls Node.js for fee preview
**Python Bot:** Calls Node.js for fee calculation during signing

## 🎯 **Where to Draw the Line**

### **✅ Node.js Handles:**
- User authentication and sessions
- User status (pioneer, referral, etc.)
- Fee calculations and discounts
- Database user queries
- Mini-app functionality

### **✅ Python Bot Handles:**
- Stellar transaction signing
- Network submission
- Trading logic
- Copy trading automation
- Market data processing

### **🔄 Shared:**
- Fee calculation calls (Python → Node.js)
- User status lookups (Python → Node.js)

## 🚀 **Implementation Steps**

### **1. Test the New Endpoints**
```bash
# Test fee status lookup
curl http://localhost:3000/mini-app/user-fee-status/123456789

# Test fee calculation
curl -X POST http://localhost:3000/mini-app/calculate-fees \
  -H "Content-Type: application/json" \
  -d '{"telegram_id": 123456789, "transaction_amount": 100}'
```

### **2. Update Python Bot**
Add the fee calculation calls to your existing `/api/sign` endpoint.

### **3. Update Wallet Interface**
Add fee preview functionality using the new endpoints.

### **4. Test Complete Flow**
1. User initiates transaction in wallet
2. Wallet shows fee preview (calls Node.js)
3. User approves and signs
4. Python bot calculates fees (calls Node.js)
5. Transaction includes fee payment

## ✅ **Benefits of This Approach**

### **Architecture Benefits:**
- **No duplication** - Single source of truth for user status
- **Clear separation** - Node.js = users, Python = trading
- **Easy maintenance** - One place to update fee logic
- **Consistent** - Reuses existing database connections

### **Development Benefits:**
- **Fast implementation** - Uses existing infrastructure
- **Testable** - Can test endpoints independently
- **Scalable** - Easy to add new discount types
- **Secure** - Reuses existing authentication

This approach gives you **the best of both worlds**: **clean architecture** with **minimal duplication**! 🎉

