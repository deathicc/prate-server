const gql = require('graphql-tag');

const typeDefs = gql`
  type User {
    _id: ID!
    name: String!
    email: String!
    image: String
    timestamp: String
    friends: [User]
    chats: [Chat]
    requests: [User]
    isFriend: Boolean
    isRequestSent: Boolean
    hasIncomingRequest: Boolean  
  }

  type Chat {
    _id: ID!
    users: [User]
    messages: [Message]
  }

  type Message {
    _id: ID!
    text: String!
    owner: ID!
    timestamp: String
  }

  type UserResponse {
    user: User
    errorMessage: String
  }

  type AcceptFriendRequestResponse {
    success: Boolean!
    message: String
  }

  type UserWithStatus {
    user: User
    isFriend: Boolean
    isRequestSent: Boolean
  }
  
  type DeleteFriendRequestResponse {
    success: Boolean!
    message: String!
  }

  type ChatResponse {
    _id: String
    error: String
  }

  input UserInput {
    name: String
    email: String!
    image: String
  }

  input SendMessageInput {
    chatId: ID!
    text: String!
    ownerId: ID!
  }

  input GetChatInput {
    userId: String!
    chatId: String!
  }

  type Query {
    getUserId(email: String!): ID
    getUserByEmail(email: String!): User
    getChat(input: GetChatInput!,limit: Int, offset: Int): Chat
    getMessage(_id: ID!): Message
    getChats(userId: ID!): [Chat]
    getRequests(userId: ID!): [User]
    getFriends(userId: ID!): [User]
    getUserBySearch(searchString: String!, limit: Int!, currentUserId: String!): [User]    
  }

  type Mutation {
    upsertUser(input: UserInput!): User
    sendFriendRequest(senderId: ID!, receiverId: ID!): UserResponse
    acceptFriendRequest(requestId: ID!, userId: ID!): AcceptFriendRequestResponse
    deleteFriendRequest(requestId:ID!, userId: ID!):DeleteFriendRequestResponse
    createChat(userIds: [ID!]!): Chat
    sendMessage(input: SendMessageInput!): String
  }

  type Subscription {
    messageAdded(chatId: ID!, userId: ID!): Message
  }
  
`;

module.exports = typeDefs;
