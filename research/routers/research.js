const express = require('express');
const auth = require('../middleware/auth')
const User = require('../models/user')
const router = new express.Router()

router.get('/research/profiles', auth, async (req, res)=>{
    try {
        if(req.query.firstSearch === 'true') {
            const results = await User.find({ name: { $regex: req.query.searchTerm, $options: 'i' } }, { name: 1, email: 1 }).sort({ createdAt: -1 })
            const users = [];
            const limit = req.query.limit ? parseInt(req.query.limit) : 10;
            for( let i = 0; i < limit; i++ ) {
                if(results[i]) {
                    users.push(results[i]);
                }
            }
            res.status(200).send({ users, totalResults: results.length });
        } else {
            const offset = (req.query.pageNo - 1)*req.query.limit;
            const limit = req.query.limit ? parseInt(req.query.limit) : 10;
            const users = await User.find({ name: { $regex: req.query.searchTerm, $options: 'i' } }, { name: 1, email: 1 })
                                    .sort({ createdAt: -1 })
                                    .skip(offset)
                                    .limit(limit);
            res.status(200).send({ users });
        }
    } catch(e) {
        res.status(503).send({ error: 'Unable to perform search right now!' })
    }
})

router.get('/research/person', auth, async (req, res)=>{
    try {
        const person = await User.findOne({ name: req.query.name });
        res.status(200).send({ person })
    } catch(e) {
        res.status(503).send({ error: 'Unable to perform search right now!' })
    }
})

router.get('/research/friends/all', auth, (req, res)=>{
    try {
        if(req.query.firstSearch === 'true') {
            const results = req.user.friends;
            const friends = [];
            const limit = req.query.limit ? parseInt(req.query.limit) : 10;
            for( let i = 0; i < limit; i++ ) {
                if(results[i]) {
                    friends.push(results[i]);
                }
            }
            res.status(200).send({ friends, totalResults: results.length });
        } else {
            const limit = req.query.limit ? parseInt(req.query.limit) : 10;
            const offset = (req.query.pageNo - 1)*limit;
            const results = req.user.friends;
            const friends = [];
            for(let i = offset; i < (offset + limit); i++) {
                if(results[i]) {
                    friends.push(results[i])
                }
            }
            res.status(200).send({ friends });
        }
    } catch(e) {
        res.status(503).send({ error: 'Unable to perform search right now!' })
    }
})

module.exports = router