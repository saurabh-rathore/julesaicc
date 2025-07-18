require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const callRoutes = require('./routes/callRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const fineTuningRoutes = require('./routes/fineTuningRoutes');
const { connectDB } = require('./config/db');
const amiService = require('./services/amiService'); // Import AMI Service
const callService = require('./services/callService'); // Import Call Service

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Connect to Database
connectDB();

// Connect to Asterisk Manager Interface
amiService.connect();

// AMI Event Handlers
amiService.on('connect', () => {
  console.log('Successfully connected to Asterisk AMI from index.js.');
  // You might want to set up specific event listeners or actions upon connection here
});

amiService.on('new_channel', async (event) => {
  console.log('New channel event received in index.js:', event);
  // Basic check if this channel is relevant (e.g., specific context or extension)
  // This logic will need refinement based on your dialplan (extensions.conf)
  if (event.context === 'ai-call-handler' || event.exten === 's' /* More specific checks needed */) {
    try {
      const callData = {
        sip_call_id: event.uniqueid, // Or event.linkedid depending on what's more appropriate
        customer_phone_number: event.calleridnum,
        status: 'initiated', // Or 'ringing' depending on the exact event timing
        direction: event.channelstatedesc === 'Ring' ? 'inbound' : 'outbound', // This is a guess, adjust based on actual event data
        start_time: new Date(), // Or parse from event if available
        // initial_language_preference: event.language, // If available in the event
      };
      const newCall = await callService.createCall(callData);
      console.log('New call logged from AMI event:', newCall.id);
      // Further actions for this call (like passing to AI handler) would go here or be triggered by other events.
    } catch (error) {
      console.error('Error logging call from AMI new_channel event:', error);
    }
  }
});

amiService.on('error', (error) => {
  console.error('AMI Service emitted an error in index.js:', error.message);
});

amiService.on('close', () => {
  console.log('AMI connection closed in index.js.');
});


// Routes
app.use('/api/auth', authRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/fine-tuning', fineTuningRoutes);
const feedbackRoutes = require('./routes/feedbackRoutes'); // Import feedback routes
app.use('/api/feedback', feedbackRoutes); // Mount feedback routes
const internalRoutes = require('./routes/internalRoutes'); // Import internal routes
app.use('/api/internal', internalRoutes); // Mount internal routes

app.get('/', (req, res) => {
  res.send('AI Call Center Backend Running');
});

const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Graceful shutdown
const gracefulShutdown = () => {
  console.log('Attempting graceful shutdown...');
  amiService.disconnect(); // Disconnect from AMI
  server.close(() => {
    console.log('HTTP server closed.');
    // Close database connection if your DB library requires it
    // e.g., require('./config/db').promisePool.end(); // If using mysql2 pool directly
    console.log('Exiting process.');
    process.exit(0);
  });

  // Force close server after 5 seconds if it hasn't shut down
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 5000);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Swagger API Documentation Setup
// Ensure swagger-jsdoc and swagger-ui-express are installed:
// npm install swagger-jsdoc swagger-ui-express
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swaggerDef'); // Your swagger definition

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
console.log(`API documentation available at /api-docs`);


module.exports = app; // For potential testing
