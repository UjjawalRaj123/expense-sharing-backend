const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// CORS Configuration - Allow specific origins
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://expense-sharing-frontend.vercel.app',
      'https://expense-sharing-application-frontend.vercel.app',
      'https://expense-sharing-unique-application.vercel.app',
      process.env.FRONTEND_URL
    ].filter(Boolean);

    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

// Middleware
app.use(cors(corsOptions));

// Stripe webhook needs raw body, so we'll mount a raw parser on the webhook route later in the route definition.
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('✅ MongoDB connected successfully');
})
.catch(err => {
  console.error('❌ MongoDB connection error:', err.message);
  console.error('MongoDB URI:', process.env.MONGODB_URI);
});

// Routes
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/groups', require('./routes/groupRoutes'));
app.use('/api/expenses', require('./routes/expenseRoutes'));
app.use('/api/balances', require('./routes/balanceRoutes'));
app.use('/api/settlements', require('./routes/settlementRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));

// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'Expense Sharing App API' });
});

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(`Error: Port ${PORT} is already in use (EADDRINUSE).`);
    console.error(`Find the process using the port: run 'netstat -ano | findstr :${PORT}' (cmd) or 'Get-NetTCPConnection -LocalPort ${PORT} | Format-Table -Auto' (PowerShell).`);
    console.error(`Then stop it with 'taskkill /PID <pid> /F' or stop the service preventing the port.`);
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
});
