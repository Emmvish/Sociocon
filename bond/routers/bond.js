const express = require('express');
const auth = require('../middleware/auth')
const User = require('../models/user')
const router = new express.Router()

const eventBusUrl = process.env.EVENT_BUS_URL || 'amqp://localhost'; 
const connection = require('amqplib').connect(eventBusUrl);
const bondQueue = process.env.BOND_QUEUE || 'Bond';

let bondChannel;

connection.then(function(conn) {
    return conn.createChannel();
}).then(function(ch) {
    ch.assertQueue(bondQueue).then(function(ok) {
        bondChannel = ch;
    });
}).catch(console.warn);

router.delete('/bond/friends', auth, async (req, res)=>{
    try {
        const friendUser = await User.findOne({ name: req.body.friend.name });
        friendUser.friends = friendUser.friends.filter((friend) => friend.name !== req.user.name);
        await friendUser.save();
        req.user.friends = req.user.friends.filter((friend) => friend.name !== req.body.friend.name);
        await req.user.save();
        const event = { type: 'BondBroken', data: { token: req.token, friend: { name: friendUser.name }  } }
        bondChannel.sendToQueue(bondQueue, Buffer.from(JSON.stringify(event)));
        res.status(200).send({ message: 'This person has been removed from your friend list!' })
    } catch(e) {
        res.status(503).send({ error: 'Unable to remove this friend right now!' })
    }
})

module.exports = router