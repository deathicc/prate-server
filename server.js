const express = require('express');
const { createServer } = require('http')
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4')
const mongoose = require('mongoose');
require('dotenv').config();
const jwt = require('jsonwebtoken')
const {useServer} = require("graphql-ws/lib/use/ws")
const {WebSocketServer} = require('ws');
const {makeExecutableSchema} = require('@graphql-tools/schema')
const { ApolloServerPluginDrainHttpServer } = require('@apollo/server/plugin/drainHttpServer');
// Import your GraphQL schema and resolvers
const typeDefs = require('./graphql/typeDefs');
const resolvers = require('./graphql/resolvers');
const VerifyToken = require('./helper/VerifyToken');
const createIndexIfNeeded = require('./helper/createIndexIfNeeded')
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 4000;
const httpServer = createServer(app);
// Connect to MongoDB
mongoose.set('strictQuery', false); // Set strictQuery to false to prepare for future changes
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('MongoDB connected...')
    createIndexIfNeeded();
  })
  .catch((err) => console.error('Could not connect to MongoDB...', err));

// Create an instance of ApolloServer with your schema and resolvers
const schema = makeExecutableSchema({ typeDefs, resolvers });
// ...

// Creating the WebSocket server
const wsServer = new WebSocketServer({
  // This is the `httpServer` we created in a previous step.
  server: httpServer,
  // Pass a different path here if your ApolloServer serves at
  // a different path.
  path: '/graphql',
});

// Hand in the schema we just created and have the
// WebSocketServer start listening.
const serverCleanup = useServer({ schema }, wsServer);

// (function generateAnonymousToken(){
//   const secretKey = "2d02f5f52e3a8f20402ae5356c4ee162";
//   const payload = {
//     userId: Math.random().toString(36).substring(2), // Generate a random userId
//     anonymous: true,
//   };
//   const options = { expiresIn: '24h' };
//   const key = jwt.sign(payload, secretKey, options);
//   console.log(key)
// })();
const server = new ApolloServer({
  schema,
  csrfPrevention: true,
  cache: "bounded",
  plugins: [
    // Proper shutdown for the HTTP server.
    ApolloServerPluginDrainHttpServer({ httpServer }),

    // Proper shutdown for the WebSocket server.
    {
      async serverWillStart() {
        return {
          async drainServer() {
            await serverCleanup.dispose();
          },
        };
      },
    },
  ],
});

// app.use(VerifyToken);

httpServer.listen(PORT, async () => {
  await server.start()
  app.use('/graphql', cors(), express.json(), expressMiddleware(server));

  console.log(`Server is running on port ${PORT}`);
  console.log(`GraphQL Playground available at http://localhost:${PORT}${server}`);
});
