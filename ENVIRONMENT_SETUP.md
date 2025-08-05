# Environment Setup Guide

## Local Development

### 1. Local Environment Variables (.env)
```env
# Database Configuration (Docker)
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=lumenbro_charts
DB_HOST=localhost
DB_PORT=5432

# Redis Configuration (Docker)
REDIS_URL=redis://localhost:6379

# Environment
NODE_ENV=development

# AWS Configuration (for KMS)
AWS_REGION=us-west-1
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
KMS_KEY_ID=27958fe3-0f3f-44d4-b21d-9d820d5ad96c

# Telegram Bot (existing)
TELEGRAM_BOT_TOKEN=your_telegram_bot_token

# Turnkey (existing)
# Add your existing Turnkey environment variables here
```

### 2. Local Setup Commands
```bash
# Start Docker containers
docker-compose up -d

# Run migrations
npm run migrate

# Start development server
npm run dev

# Test API
npm run test-api
```

## Production Deployment

### 1. Production Environment Variables (.env)
```env
# Database Configuration (RDS)
DB_USER=your_rds_username
DB_PASSWORD=your_rds_password
DB_NAME=lumenbro_charts_prod
DB_HOST=your-rds-endpoint.amazonaws.com
DB_PORT=5432

# Redis Configuration (ElastiCache or external Redis)
REDIS_URL=redis://your-redis-endpoint:6379

# Environment
NODE_ENV=production

# SSL Configuration (optional)
SSL_CA_PATH=/path/to/rds-ca-2019-root.pem

# Telegram Bot (existing)
TELEGRAM_BOT_TOKEN=your_telegram_bot_token

# Turnkey (existing)
# Add your existing Turnkey environment variables here
```

### 2. Production Setup Commands
```bash
# Run production migrations
npm run migrate:prod

# Start production server
npm start

# Or with PM2
pm2 start ecosystem.config.js
```

## Database Separation Strategy

### Current Setup
- **Telegram Bot Database**: Your existing RDS instance for user registration and wallet management
- **Chart Data Database**: New separate database for chart data (can be on same RDS instance or different)

### Recommended Approach

#### Option 1: Same RDS Instance, Different Database
```env
# For Telegram Bot (existing)
DB_USER=botadmin
DB_PASSWORD=CopyTrading123
DB_NAME=postgres
DB_HOST=lumenbro-turnkey.cz2imkksk7b4.us-west-1.rds.amazonaws.com
DB_PORT=5434

# For Chart Data (new)
DB_USER=botadmin
DB_PASSWORD=CopyTrading123
DB_NAME=lumenbro_charts_prod
DB_HOST=lumenbro-turnkey.cz2imkksk7b4.us-west-1.rds.amazonaws.com
DB_PORT=5434
```

#### Option 2: Separate RDS Instance (Recommended for Scale)
```env
# For Chart Data (new dedicated instance)
DB_USER=chartadmin
DB_PASSWORD=secure_password
DB_NAME=lumenbro_charts_prod
DB_HOST=your-charts-rds-endpoint.amazonaws.com
DB_PORT=5432
```

## SSL Configuration for RDS

### Option 1: With CA Certificate (Most Secure)
1. Download RDS CA certificate: https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem
2. Set environment variable:
```env
SSL_CA_PATH=/path/to/global-bundle.pem
```

### Option 2: Without CA Certificate (Simpler)
```env
# No SSL_CA_PATH needed
# The code will automatically use rejectUnauthorized: false
```

## Migration Process

### Local to Production Migration
1. **Test locally first**:
   ```bash
   npm run migrate
   npm run test-api
   ```

2. **Deploy to production**:
   ```bash
   # Set production environment variables
   export NODE_ENV=production
   
   # Run production migration
   npm run migrate:prod
   ```

3. **Verify production setup**:
   ```bash
   # Test production endpoints
   curl https://your-domain.com/api/charts/health
   ```

## Environment-Specific Configuration

### Development
- Uses Docker containers for PostgreSQL and Redis
- No SSL required
- Local file system for logs
- Development error handling

### Production
- Uses RDS for PostgreSQL
- Uses ElastiCache or external Redis
- SSL encryption for database connections
- Production logging and monitoring
- Background sync services enabled

## Troubleshooting

### Common Issues

1. **SSL Connection Errors**
   - Ensure `SSL_CA_PATH` points to correct certificate file
   - Try without CA certificate first: remove `SSL_CA_PATH`

2. **Database Connection Timeout**
   - Check RDS security groups allow connections from your EC2
   - Verify database credentials
   - Check if RDS instance is running

3. **TimescaleDB Extension Error**
   - Ensure your RDS instance supports TimescaleDB
   - Consider using Aurora PostgreSQL with TimescaleDB

4. **Redis Connection Issues**
   - Check Redis endpoint and port
   - Verify Redis security groups
   - Test Redis connection separately

### Debug Commands
```bash
# Test database connection
node scripts/test-db.js

# Test Redis connection
node -e "const redis = require('redis'); const client = redis.createClient({url: process.env.REDIS_URL}); client.connect().then(() => console.log('Redis OK')).catch(console.error)"

# Check environment variables
node -e "console.log('NODE_ENV:', process.env.NODE_ENV); console.log('DB_HOST:', process.env.DB_HOST)"
``` 