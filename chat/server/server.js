const io = require('../index');
const jwt = require('jsonwebtoken')
const User = require('../models/user');
const Filter = require('bad-words');

const jwtSecret = process.env.JWT_SECRET || 'Some-Secret-Key'

io.on('connection', (socket) => {

    socket.on('join', async (token, callback) => {
        const decoded = jwt.verify(token, jwtSecret);
        const user = await User.findOne({ _id: decoded._id, 'tokens.token': data.token })
        if(!user) {
            return callback('ERROR: User was not found!')
        }
        const room = "reception-" + user.name;
        user.room = room;
        await user.save();
        socket.join(room);
        const onlineFriends = [];
        for(let i = 0; i < user.friends.length; i++) {
            const friend = await User.findOne({ name: user.friends[i].name });
            if(!!friend.room) {
                onlineFriends.push(friend.name);
                io.to(friend.room).emit("friendJoined", {
                    name: user.name
                })
            }
        }
        const offlineFriends = [];
        user.friends.forEach((friend) => {
            if(!onlineFriends.find((onlineFriend) => onlineFriend.name === friend.name )) {
                offlineFriends.push(friend.name)
            }
        })
        io.to(room).emit('roomData', {
            onlineFriends,
            offlineFriends
        })
        callback()
    })

    socket.on("chat", async ({ token, friendName }, callback) => {
        const decoded = jwt.verify(token, jwtSecret);
        const user = await User.findOne({ _id: decoded._id, 'tokens.token': data.token });
        if(!user) {
            return callback("ERROR: User was not found!")
        }
        const friend = user.friends.find((friend) => friend.name === friendName);
        if(!friend) {
            return callback('ERROR: Friend was not found!')
        }
        io.to(user.room).emit("chatHistory", { messages: friend.messages });
        callback();
    } )

    socket.on("sendMessage", async ({ token, message, friendName }, callback) => {
        const decoded = jwt.verify(token, jwtSecret);
        const user = await User.findOne({ _id: decoded._id, 'tokens.token': data.token });
        if(!user) {
            return callback("ERROR: User was not found!")
        }
        message.sentBy = user.name;
        const friendExists = await User.findOne({ name: friendName })
        const isAFriend = user.friends.find((friend) => friend.name === friendName);
        if(!friendExists || !isAFriend) {
            return callback("ERROR: Friend was not found!")
        }
        const filter = new Filter();
        if(filter.isProfane(message.content)) {
            return callback("ERROR: This message was not sent as it contained profanity!")
        }
        friendExists.friends.forEach((friend, i) => {
            if(friend.name === user.name) {
                friend.messages.push(message);
                friendExists.markModified("friends." + i + ".messages." + friend.messages.length - 1);
                break;
            }
        })
        await friendExists.save();
        user.friends.forEach((friend, i) => {
            if(friend.name === friendName) {
                friend.messages.push(message);
                user.markModified("friends." + i + ".messages." + friend.messages.length - 1);
            }
        })
        await user.save();
        io.to(user.room).emit("newMessage", { message });
        if(!!friendExists.room) {
            io.to(friendExists.room).emit("newMessage", { message });
        }
        callback();
    } )

    socket.on('disconnect', async (token) => {
        const decoded = jwt.verify(token, jwtSecret);
        const user = await User.findOne({ _id: decoded._id, 'tokens.token': data.token });
        user.room = '';
        await user.save();
        user.friends.forEach((friend) => {
            if(!!friend.room) {
                io.to(friendRoom).emit("friendDisconnected", {
                    name: user.name
                })
            }
        })
    })
})
