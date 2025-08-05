# Quick Setup Guide

## 1. Environment Setup

Run the setup script to create your `.env` file:
```bash
npm run setup
```

This will create a `.env` file with default values for local development.

## 2. Start Database and Redis

Start the required services using Docker:
```bash
docker-compose up -d
```

This will start:
- PostgreSQL with TimescaleDB on port 5432
- Redis on port 6379

## 3. Run Database Migration

Create the database tables:
```bash
npm run migrate
```

## 4. Start Development Server

Start the Node.js backend:
```bash
npm run dev
```

## 5. Test the API

Test the endpoints:
```bash
npm run test-api
```

## 6. Connect Your Next.js App

In your Next.js application, configure the API base URL:

```javascript
// In your Next.js app
const API_BASE_URL = 'http://localhost:3000/api/charts';

// Example usage
const response = await fetch(`${API_BASE_URL}/single?base=XLM&counter=USDC&resolution=1h&hours=24`);
```

## Environment Variables

The `.env` file contains:

```env
# Database Configuration
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=lumenbro_charts
DB_HOST=localhost
DB_PORT=5432

# Redis Configuration
REDIS_URL=redis://localhost:6379

# Environment
NODE_ENV=development
```

## API Endpoints

- `GET /api/charts/single` - Single chart data
- `POST /api/charts/batch` - Multiple charts in one request
- `GET /api/charts/popular` - Popular trading pairs
- `WS /api/charts/stream` - Real-time WebSocket updates

## Troubleshooting

1. **Database connection error**: Make sure Docker containers are running
2. **Migration error**: Check that PostgreSQL is accessible on port 5432
3. **Redis connection error**: Ensure Redis is running on port 6379

## Production Deployment

For production, you'll need to:
1. Set `NODE_ENV=production`
2. Configure proper SSL certificates
3. Use production database credentials
4. Set up proper Redis configuration 