const express = require('express')
const jwt = require('jsonwebtoken')

require('./db/mongoose')
const bondRouter = require('./routers/bond');

const serverPort = process.env.PORT || 4003

const User = require('./models/user')

const eventBusUrl = process.env.EVENT_BUS_URL || 'amqp://localhost'
const connection = require('amqplib').connect(eventBusUrl);
const userQueue = process.env.USER_QUEUE || 'User';
const bondQueue = process.env.BOND_QUEUE || 'Bond';
const requestQueue = process.env.REQUEST_QUEUE || 'Request';

connection.then(function(conn) {
    return conn.createChannel();
}).then(function(ch) {
    ch.assertQueue(userQueue).then(function(ok) {
        return ch.consume(userQueue, function(msg) {
        if (msg !== null) {
            const { type, data } = JSON.parse(msg.content.toString())
            handleEvent(type, data);
            ch.ack(msg);
        }
    });
});  
}).catch(console.warn);

connection.then(function(conn) {
    return conn.createChannel();
}).then(function(ch) {
    ch.assertQueue(requestQueue).then(function(ok) {
        return ch.consume(requestQueue, function(msg) {
        if (msg !== null) {
            const { type, data } = JSON.parse(msg.content.toString())
            handleEvent(type, data);
            ch.ack(msg);
        }
    });
});  
}).catch(console.warn);

let bondChannel;

connection.then(function(conn) {
    return conn.createChannel();
}).then(function(ch) {
    ch.assertQueue(bondQueue).then(function(ok) {
        bondChannel = ch;
    });
}).catch(console.warn);

const app = express();

app.use(express.json());

app.use(bondRouter);

async function handleEvent(type, data) {
    const jwtSecret = process.env.JWT_SECRET || 'Some-Secret-Key'

    switch(type) {

        case 'UserAdded':
            const user = new User(data.user);
            try {
                await user.save();
            } catch(e) {
                console.log(e.message)
            }
            break;

        case 'UserLoggedIn': 
            try {
                const user = await User.findOne({ name: data.name });
                if(!user) {
                    throw new Error('User Not Found!');
                }
                user.tokens = user.tokens.concat({ token: data.token });
                await user.save();
            } catch(e) {
                console.log(e.message)
            }
            break;

        case 'UserRemoved': 
            try {
                const decoded = jwt.verify(data.token, jwtSecret)
                const user = await User.findOne({ _id: decoded._id, 'tokens.token': data.token })
                if(!user) {
                    throw new Error('No such user exists!');
                }
                for( let i = 0; i < user.friends.length; i++ ) {
                    const friend = await User.findOne({ name: user.friends[i].name })
                    friend.friends = friend.friends.filter((f) => f.name !== user.name);
                    await friend.save();
                }
                await user.remove();
            } catch(e) {
                console.log(e.message)
            }
            break;

        case 'UserEdited':
            try {
                const decoded = jwt.verify(data.token, jwtSecret)
                const user = await User.findOne({ _id: decoded._id, 'tokens.token': data.token })
                const currentName = user.name;
                const allowedUpdates = ['name', 'email'];
                const updates = Object.keys(data.updates);
                const isValidOperation = updates.every((update) => allowedUpdates.includes(update))
                const isValidUpdateValue = true;
                allowedUpdates.forEach((field)=>{
                    if(data.updates[field] === '') {
                        isValidUpdateValue = false;
                    }
                })
                if (!isValidOperation || !isValidUpdateValue) {
                    throw new Error('Invalid updates!');
                }
                updates.forEach((update) => user[update] = data.updates[update])
                if(updates.includes('name')) {
                    for( let i = 0; i < user.friends; i++ ) {
                        const friend = await User.findOne({ name: user.friends[i] });
                        friend.friends.forEach((friend)=>{
                            if(friend.name === currentName) {
                                friend.name = data.updates.name;
                                return;
                            }
                        })
                    }
                }
                await user.save()
            } catch(e) {
                console.log(e.message)
            }
            break;

        case 'UserLoggedOut':
            try {
                const decoded = jwt.verify(data.token, jwtSecret)
                const user = await User.findOne({ _id: decoded._id, 'tokens.token': data.token })
                user.tokens = user.tokens.filter((token) => token.token !== data.token);
                await user.save();
            } catch(e) {
                console.log(e.message)
            }
            break;

        case 'AddFriend': 
            try {
                const decoded = jwt.verify(data.token, jwtSecret)
                const user = await User.findOne({ _id: decoded._id, 'tokens.token': data.token })
                if(!user) {
                    throw new Error('User was not found!')
                }
                const friend = await User.findOne({ name: data.friend.name });
                if(!friend) {
                    throw new Error('Friend was not found!')
                }
                user.friends = user.friends.concat({ name: data.friend.name });
                await user.save();
                friend.friends = friend.friends.concat({ name: user.name });
                await friend.save();
                const event = { type: 'BondCreated', data: { token: data.token, friend: { name: friend.name }  } }
                bondChannel.sendToQueue(bondQueue, Buffer.from(JSON.stringify(event)));
            } catch(e) {
                console.log(e.message)
            }
            break;
    }
}

app.listen(serverPort, ()=>{
    console.log('Listening at port: ' + serverPort)
})