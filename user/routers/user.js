const express = require('express');
const nodemailer = require("nodemailer");
const { v4: uuidv4 } = require('uuid');

const eventBusUrl = process.env.EVENT_BUS_URL || 'amqp://localhost'; 
const connection = require('amqplib').connect(eventBusUrl);
const userQueue = process.env.USER_QUEUE || 'User';

let userChannel;

connection.then(function(conn) {
    return conn.createChannel();
}).then(function(ch) {
    ch.assertQueue(userQueue).then(function(ok) {
        userChannel = ch;
    });
}).catch(console.warn);

const myEmail = process.env.EMAIL || "mvtinder98@gmail.com"
const myEmailPassword = process.env.EMAIL_PASSWORD || '********'

const transport = nodemailer.createTransport({
	service: "gmail",
	auth: {
		user: myEmail,
		pass: myEmailPassword
	}
});

const message = {
	from: myEmail,
	to: "",
	subject: "",
	text: ""
};

const User = require('../models/user')
const auth = require('../middleware/auth')
const router = new express.Router()

router.post('/users/register', async (req, res) => {
    const user = new User(req.body)
    try {
        await user.save();
        const event = { type: 'UserAdded', data: { user: user.toJSON(), password: req.body.password } }
        userChannel.sendToQueue(userQueue, Buffer.from(JSON.stringify(event)));
        res.status(201).send({ user });
    } catch (e) {
        res.status(400).send({ error: 'This user account already exists. Please choose a different name!' })
    }
})

router.post("/users/forgotpassword", async (req,res)=>{
    const user = await User.findOne({name: req.body.name});
    if(!user){
        res.send({ error: 'User was not found!' });
        return;
    } else {
        try {
            const newPassword = uuidv4().split("-").join("");
            user.password = newPassword;
            await user.save();
            const event = { type: 'PasswordChanged', data: { name: user.name, newPassword } }
            userChannel.sendToQueue(userQueue, Buffer.from(JSON.stringify(event)));
            message.to = user.email;
            message.subject = "Team Manish Varma | Your new Password"
            message.text = `Hi, ${user.name}, Your New Password is: ${newPassword} . - Team Manish Varma`;
            transport.sendMail(message, function(err){
                if(err){
                    res.status(503).send({ error: 'This service is unavailable!' });
                }
            });
            res.status(201).send({ message });
        } catch(e){
            res.status(503).send({ error: 'This Service is Unavailable!' });
        }
    }
})

router.patch('/users/edit', auth, async (req, res) => {
    delete req.body.currentName;
    const allowedUpdates = ['name', 'password','email']
    const updates = Object.keys(req.body)

    const isValidOperation = updates.every((update) => allowedUpdates.includes(update))
    const isValidUpdateValue = true;
    allowedUpdates.forEach((field)=>{
        if(req.body[field] === '') {
            isValidUpdateValue = false;
        }
    })

    if (!isValidOperation || !isValidUpdateValue) {
        return res.status(400).send({ error: 'Invalid updates!' })
    }

    try {
        updates.forEach((update) => req.user[update] = req.body[update])
        await req.user.save()
        const event = { type: 'UserEdited', data: { updates: req.body, token: req.token } }
        userChannel.sendToQueue(userQueue, Buffer.from(JSON.stringify(event)));
        res.status(201).send({ user: req.user })
    } catch (e) {
        res.status(503).send({ error: 'Update could not be applied!' })
    }
})

router.delete('/users/delete', auth, async (req, res) => {
    try {
        const userToDelete = req.user.toJSON();
        await req.user.remove();
        const event = { type: 'UserRemoved', data: { user: userToDelete, token: req.token } }
        userChannel.sendToQueue(userQueue, Buffer.from(JSON.stringify(event)));
        res.status(201).send({ userToDelete });
    } catch (e) {
        res.status(503).send({ error: 'Deletion could not be performed!' })
    }
})

module.exports = router
