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
        const activeFriends = [];
        for(let i = 0; i < user.friends.length; i++) {
            const friend = await User.findOne({ name: user.friends[i].name });
            if(!!friend.room) {
                activeFriends.push(friend.name);
                const friendRoom = "reception-" + friend.name;
                io.to(friendRoom).emit("friendJoined", {
                    name: user.name
                })
            }
        }
        io.to(room).emit('roomData', {
            onlineFriends: activeFriends
        })
        callback()
    })

    socket.on("chat", async ({ token, friendName }, callback) => {
        const decoded = jwt.verify(token, jwtSecret);
        const user = await User.findOne({ _id: decoded._id, 'tokens.token': data.token });
        if(!user) {
            return callback("ERROR: User was not found!")
        }
        const friendExists = await User.findOne({ name: friendName })
        const isAFriend = user.friends.find((friend) => friend.name === friendName);
        if(!friendExists || !isAFriend) {
            return callback("ERROR: Friend was not found!")
        }
        if(friendExists.room === friendName + "-" + user.name) {
            user.room = friendExists.room;
            await user.save();
            socket.join(friendExists.room);
        } else {
            user.room = user.name + "-" + friendName;
            await user.save();
            socket.join(user.room);
        }
        socket.emit("conversation", { messages: isAFriend.messages })
    } )

    socket.on("sendMessage", async ({ token, message, friendName }, callback) => {
        const decoded = jwt.verify(token, jwtSecret);
        const user = await User.findOne({ _id: decoded._id, 'tokens.token': data.token });
        if(!user) {
            return callback("ERROR: User was not found!")
        }
        const friendExists = await User.findOne({ name: friendName })
        const isAFriend = user.friends.find((friend) => friend.name === friendName);
        if(!friendExists || !isAFriend) {
            return callback("ERROR: Friend was not found!")
        }
        const filter = new Filter();
        if(filter.isProfane(message.content)) {
            return callback("ERROR: This message was not sent as it contained profanity!")
        }
        io.to(user.room).emit("newMessage", { message });
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
        callback();
    } )

    socket.on('disconnect', async (token) => {
        const decoded = jwt.verify(token, jwtSecret);
        const user = await User.findOne({ _id: decoded._id, 'tokens.token': data.token });
        user.room = '';
        await user.save();
        user.friends.forEach((friend) => {
            const friendRoom = "reception-" + friend.name;
            io.to(friendRoom).emit("friendDisconnected", {
                name: user.name
            })
        })
    })
})