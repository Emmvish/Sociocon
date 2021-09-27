const mongoose = require('mongoose')
const validator = require('validator')

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        trim: true,
        unique: true,
        validate(value){
            if(!validator.isEmail(value)){
                throw new Error('Please Enter a Valid E-mail Address!')
            }
        }
    },
    name: {
        type: String,
        required: true,
        trim: true,
        unique: true
    },
    room: {
        type: String,
        default: ''
    },
    tokens: [{
        token: {
            type: String,
            required: true
        }
    }],
    friends: [{
        name: {
            type: String,
            required: true
        },
        messages: [{
            date: {
                type: Date,
                required: true
            },
            content: {
                type: String,
                required: true
            },
            sentBy: {
                type: String,
                required: true
            }
        }]
    }]
}, {
    timestamps: true
})

const User = mongoose.model('User', userSchema)

module.exports = User