const User = require('../models/User');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const MESSAGE_ADDED = 'MESSAGE_ADDED';
const { PubSub  } = require('graphql-subscriptions');
const { withFilter  } = require('graphql-subscriptions');
const pubsub = new PubSub();
const resolvers = {
  Query: {
    getUserId: async (_, { email }) => {
      const user = await User.findOne({ email: email });
      if (!user) {
        return { error: 'User not found' };
      }
      return String(user._id);
    },
    getUserBySearch: async (_, { searchString, limit, currentUserId }) => {
      try {
        // Search for users matching either name or email
        const users = await User.find({
          $and: [
            { _id: { $ne: currentUserId } },
            {
              $or: [
                { name: { $regex: searchString, $options: "i" } }, // Case-insensitive regex match for name
                { email: { $regex: searchString, $options: "i" } } // Case-insensitive regex match for email
              ]
            }
          ]
        }).limit(limit);
        
        const currentUser = await User.findById(currentUserId);
        const usersWithStatus = users.map(user => ({
          ...user.toObject(),
          isFriend: user.friends.includes(currentUserId),
          isRequestSent: user.requests.includes(currentUserId),
          hasIncomingRequest: currentUser.requests.includes(user._id.toString())
        }));
    
        return usersWithStatus;
      } catch (error) {
        // Handle any errors that might occur
        console.error("Error searching for users:", error);
        throw new Error("Error searching for users");
      }
    },
    getChat: async (_, { input, limit = 20 , offset = 0 }) => {
      const chat = await Chat.findById(input.chatId);
      chat.messages = chat.messages.slice(offset, offset + limit);

      if (!chat) {
        throw new Error('Chat not found');
      }
      if (!chat.users.includes(input.userId)) {
        throw new Error('User not part of the chat');
      }
      return chat.populate('users');
    },
    getMessage: async (_, { _id }) => {
      return await Message.findById(_id);
    },
    getChats: async (_, { userId }) => {
      const user = await User.findById(userId).populate({
        path: 'chats',
        populate: [
          { path: 'users' },
          {
            path: 'messages',
            match: {},
            options: { limit: 1 },
          },
        ],
      });
    
      if (!user) {
        throw new Error('User not found');
      }
    
      // Modify each chat to only include the first message
      user.chats.forEach(chat => {
        chat.messages = chat.messages[0] ? [chat.messages[0]] : [];
      });
    
      return user.chats;
    },
    getRequests: async (_, { userId }) => {
      try {
        const user = await User.findById(userId);
        const requestsDetails = await Promise.all(user.requests.map(async requestId => {
          const userDetails = await User.findById(requestId);
          return userDetails;
        }));
        return requestsDetails;
      } catch (error) {
        console.error("Error fetching requests:", error);
        throw new Error("Error fetching requests");
      }
    },
    getFriends: async (_, { userId }) => {
      try {
        const user = await User.findById(userId);
        const friendsDetails = await Promise.all(user.friends.map(async friendId => {
          const friendDetails = await User.findById(friendId);
          return friendDetails;
        }));
        return friendsDetails;
      } catch (error) {
        console.error("Error fetching friends:", error);
        throw new Error("Error fetching friends");
      }
    },
  },
  Mutation: {
    upsertUser: async (_, { input }) => {
      try {
        // Prepare the update object with email and optionally name and image
        const updateObject = { $setOnInsert: { email: input.email } };
        if (input.name) updateObject.$setOnInsert.name = input.name;
        if (input.image) updateObject.$setOnInsert.image = input.image;
    
        // Use findOneAndUpdate with upsert option to search by email and either update or insert a document
        const updatedUser = await User.findOneAndUpdate(
          { email: input.email },
          updateObject,
          { upsert: true, new: true } // Upsert option creates a new document if not found
        );
        return updatedUser;
      } catch (error) {
        // Handle any errors that might occur
        return { error: 'Error upserting user: ' + error.message };
      }
    },   
    sendFriendRequest: async (_, { senderId, receiverId }) => {
      try {
        // Check if the sender and receiver exist
        const sender = await User.findById(senderId);
        const receiver = await User.findById(receiverId);
        if (!sender || !receiver) {
          return { error: 'One or both users not found' };
        }
      
        // Check if they are already friends
        if (receiver.friends.includes(senderId)) {
          return { error: 'Users are already friends' };
        }
      
        // Check if a friend request has already been sent
        if (receiver.requests.includes(senderId)) {
          return { errorMessage: 'Friend request already sent' };
        }
      
        // If no errors, send the friend request
        receiver.requests.push(senderId);
        await receiver.save();
        return { user: receiver, errorMessage: null };
      } catch (error) {
        console.error('Error sending friend request:', error);
        return { errorMessage: 'Error sending friend request', user: null };
      }
    },        
    acceptFriendRequest: async (_, { requestId, userId }) => {
      // Check if the user and requestUser exist
      const user = await User.findById(userId);
      const requestUser = await User.findById(requestId);
      if (!user || !requestUser) {
        return { success: false, message: 'One or both users not found' };
      }
    
      // Check if the friend request exists
      if (!user.requests.includes(requestId)) {
        return { success: false, message: 'Friend request not found' };
      }
    
      // Check if they are already friends
      if (user.friends.includes(requestId)) {
        return { success: false, message: 'Users are already friends' };
      }
    
      // If no errors, accept the friend request
      user.friends.push(requestUser);
      requestUser.friends.push(user);
      user.requests = user.requests.filter(request => request._id.toString() !== requestId);
      await user.save();
      await requestUser.save();
      
      return { success: true, message: 'Friend request accepted' };
    },
    deleteFriendRequest: async (_, { requestId, userId }) => {
      // Check if the user and requestUser exist
      const user = await User.findById(userId);
      const requestUser = await User.findById(requestId);
      if (!user || !requestUser) {
        return { success: false, message: 'One or both users not found' };
      };
    
      // Check if the friend request exists
      if (!user.requests.includes(requestId)) {
        return { success: false, message: 'Friend request not found' };
      };
    
      // If no errors, delete the friend request
      user.requests = user.requests.filter(request => request._id.toString() !== requestId);
      await user.save();
      
      return { success: true, message: 'Friend request deleted' };
    },    
    createChat: async (_, { userIds }) => {
      // Check if the users exist
      const users = await User.find({ _id: { $in: userIds } });
      if (users.length !== userIds.length) {
        return { _id: null ,error: 'One or more users not found' };
      }
    
      // Check if the users are friends
      if (!users[0].friends.includes(users[1]._id) || !users[1].friends.includes(users[0]._id)) {
        return { _id: null, error: 'Users are not friends' };
      }
    
      // Check if a chat already exists between the users in the Chat collection
      const existingChat = await Chat.findOne({ users: { $all: userIds } });
      if (existingChat) {
        const chat = await Chat.findById(existingChat._id).populate('users');
        return chat;
      }
    
      // If no existing chat, create a new one
      const newChat = new Chat({ users: userIds });
      try {
        const savedChat = await newChat.save();
    
        // Add the new chat's ID to each user's chat array
        for (const user of users) {
          user.chats.push(savedChat._id);
          await user.save();
        }
        const chat = await Chat.findById(savedChat._id).populate('users');
        return chat;
      } catch (error) {
        // Handle any other errors that might occur when saving the chat
        return { _id:null ,error: 'Error creating chat: ' + error.message };
      }
    },
    sendMessage: async (_, { input }) => {
      // Check if the chat exists
      const { chatId, ownerId, text } = input;
      const chat = await Chat.findById(chatId);
      if (!chat.users.includes(ownerId)) {
        return 'Chat not found';
      };
      if (!chat) {
        return 'Chat not found';
      };
      // Create the new message
      const newMessage = { text, owner: ownerId };
    
      // If no errors, send the message
      chat.messages.unshift(newMessage);
      chat.markModified('messages');
      try {
        const updatedChat = await chat.save();
        const savedMessage = updatedChat.messages[0];
        pubsub.publish(MESSAGE_ADDED, { messageAdded: savedMessage });
        return 'Message sent successfully';
      } catch (error) {
        // Handle any other errors that might occur when saving the chat
        return 'Error sending message: ' + error.message ;
      }
    }
  },
  Subscription: {
    messageAdded: {
      subscribe: () => pubsub.asyncIterator(MESSAGE_ADDED),
        // async (payload, variables) => {
        //   const { chatId, userId } = variables;
        //   const chat = await Chat.findById(chatId);
        //   if (!chat) {
        //     throw new Error('Chat not found');
        //   }
        //   return chat.users.includes(userId) && payload.messageAdded.chatId === chatId;
        // },
    },
  }
};

module.exports = resolvers;