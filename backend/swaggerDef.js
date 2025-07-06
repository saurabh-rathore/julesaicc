const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'AI Call Center API',
      version: '1.0.0',
      description: 'API documentation for the AI Call Center backend services.',
      contact: {
        name: 'API Support',
        // url: 'http://www.example.com/support',
        // email: 'support@example.com',
      },
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 3000}/api`,
        description: 'Development server',
      },
      // You can add more servers here (e.g., staging, production)
    ],
    // Components section is good for reusable schemas, security schemes etc.
    // Schemas defined in JSDoc comments within route files will be merged here.
    // We've already defined UserOutput, Call, Transcript, Feedback, etc. in the route files.
    // Security scheme for JWT was also defined in authRoutes.js.
  },
  // Path to the API docs
  // Looks for JSDoc comments in these files
  apis: ['./routes/*.js'], // Glob pattern to include all route files
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
