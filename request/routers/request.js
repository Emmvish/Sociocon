const express = require('express');
const auth = require('../middleware/auth')
const User = require('../models/user')
const router = new express.Router()

const eventBusUrl = process.env.EVENT_BUS_URL || 'amqp://localhost'; 
const connection = require('amqplib').connect(eventBusUrl);
const requestQueue = process.env.REQUEST_QUEUE || 'Request';

let requestChannel;

connection.then(function(conn) {
    return conn.createChannel();
}).then(function(ch) {
    ch.assertQueue(requestQueue).then(function(ok) {
        requestChannel = ch;
    });
}).catch(console.warn);

router.post('/requests/send', auth, async (req, res)=>{
    try {
        const friendUser = await User.findOne({ name: req.body.request.otherUserName });
        const alreadyHaveThisFriend = req.user.friends.find((friend) => friend.name === friendUser.name)
        const friendRequestAlreadySent = req.user.sentRequests.find((request) => request.otherUserName === friendUser.name);
        const friendRequestAlreadyReceived = req.user.receivedRequests.find((request) => request.otherUserName === friendUser.name);
        const itsMe = req.user.name === friendUser.name;
        if(alreadyHaveThisFriend || friendRequestAlreadySent || friendRequestAlreadyReceived || itsMe) {
            throw new Error()
        }
        friendUser.receivedRequests = friendUser.receivedRequests.concat(req.body.request);
        await friendUser.save();
        req.user.sentRequests = req.user.sentRequests.concat(req.body.request);
        await req.user.save();
    } catch(e) {
        res.status(503).send({ error: 'Unable to send this friend request.' })
    }
})

router.get('/requests/sent', auth, async (req, res)=>{
    try {
        if(req.query.firstSearch === 'true') {
            const limit = req.query.limit ? parseInt(req.query.limit) : 10;
            const sentRequests = req.user.sentRequests.slice(0, limit);
            res.status(200).send({ sentRequests, totalResults: req.user.sentRequests.length })
        } else {
            const limit = req.query.limit ? parseInt(req.query.limit) : 10;
            const offset = (req.query.pageNo - 1)*limit;
            const sentRequests = req.user.sentRequests.slice(offset, limit+offset);
            res.status(200).send({ sentRequests });
        }
    } catch (e) {
        res.status(503).send({ error: e.message })
    } 
})

router.get('/requests/received', auth, async (req, res)=>{
    try {
        if(req.query.firstSearch === 'true') {
            const limit = req.query.limit ? parseInt(req.query.limit) : 10;
            const receivedRequests = req.user.receivedRequests.slice(0, limit);
            res.status(200).send({ receivedRequests, totalResults: req.user.receivedRequests.length })
        } else {
            const limit = req.query.limit ? parseInt(req.query.limit) : 10;
            const offset = (req.query.pageNo - 1)*limit;
            const receivedRequests = req.user.receivedRequests.slice(offset, limit+offset);
            res.status(200).send({ receivedRequests });
        }
    } catch(e) {
        res.status(503).send({ error: e.message })
    } 
})

router.post('/requests/reject', auth, async (req, res)=>{
    try {
        req.user.receivedRequests = req.user.receivedRequests.filter((request) => request.otherUserName !== req.body.request.otherUserName)
        await req.user.save();
        const otherUser = await User.findOne({ name: req.body.request.otherUserName })
        otherUser.sentRequests = otherUser.sentRequests.filter((request) => request.otherUserName !== req.body.request.otherUserName);
        await otherUser.save();
        res.status(200).send({ message: 'You have rejected this friend request!' })
    } catch(e) {
        res.status(503).send({ error: 'Unable to reject this friend request.' })
    }
})

router.post('/requests/remove', auth, async (req, res)=>{
    try {
        req.user.sentRequests = req.user.sentRequests.filter((request) => request.otherUserName !== req.body.request.otherUserName)
        await req.user.save();
        const otherUser = await User.findOne({ name: req.body.request.otherUserName })
        otherUser.receivedRequests = otherUser.receivedRequests.filter((request) => request.otherUserName !== req.body.request.otherUserName);
        await otherUser.save();
        res.status(200).send({ message: 'You have removed this friend request!' })
    } catch(e) {
        res.status(503).send({ error: 'Unable to remove this friend request.' })
    }
})

router.post('/requests/accept', auth, async (req, res)=>{
    try {
        req.user.receivedRequests = req.user.receivedRequests.filter((request) => request.otherUserName !== req.body.request.otherUserName)
        await req.user.save();
        const otherUser = await User.findOne({ name: req.body.request.otherUserName })
        otherUser.sentRequests = otherUser.sentRequests.filter((request) => request.otherUserName !== req.body.request.otherUserName);
        await otherUser.save();
        const event = { type: 'AddFriend', data: { token: req.token, friend: { name: req.body.request.otherUserName }  } }
        requestChannel.sendToQueue(requestQueue, Buffer.from(JSON.stringify(event)));
        res.status(200).send({ message: 'You have accepted this friend request!' })
    } catch(e) {
        res.status(503).send({ error: 'Unable to accept this friend request.' })
    }
})

module.exports = router