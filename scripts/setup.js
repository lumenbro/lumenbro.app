const fs = require('fs');
const path = require('path');

console.log('🚀 Lumenbro Chart API Setup');
console.log('============================\n');

// Check if .env file exists
const envPath = path.join(__dirname, '..', '.env');
if (!fs.existsSync(envPath)) {
  console.log('📝 Creating .env file...');
  
  const envContent = `# Database Configuration
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=lumenbro_charts
DB_HOST=localhost
DB_PORT=5432

# Redis Configuration
REDIS_URL=redis://localhost:6379

# Environment
NODE_ENV=development

# Production SSL (only needed in production)
# SSL_CA_PATH=/path/to/ssl/ca.crt

# Telegram Bot (existing)
TELEGRAM_BOT_TOKEN=your_telegram_bot_token

# Turnkey (existing)
# Add your existing Turnkey environment variables here
`;

  fs.writeFileSync(envPath, envContent);
  console.log('✅ .env file created successfully!');
  console.log('⚠️  Please update the .env file with your actual values');
} else {
  console.log('✅ .env file already exists');
}

console.log('\n📋 Setup Instructions:');
console.log('1. Start the database and Redis:');
console.log('   docker-compose up -d');
console.log('');
console.log('2. Run the database migration:');
console.log('   npm run migrate');
console.log('');
console.log('3. Start the development server:');
console.log('   npm run dev');
console.log('');
console.log('4. Test the API:');
console.log('   npm run test-api');
console.log('');
console.log('🌐 Your API will be available at:');
console.log('   http://localhost:3000/api/charts');
console.log('');
console.log('📊 WebSocket endpoint:');
console.log('   ws://localhost:3000/api/charts/stream');
console.log('');
console.log('🔗 For your Next.js app, use:');
console.log('   http://localhost:3000/api/charts as your API base URL'); 