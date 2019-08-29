'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const users = new mongoose.Schema({
  username: {type:String, required:true, unique:true},
  password: {type:String, required:true},
  email: {type: String},
  role: {type: String, default:'user', enum: ['admin','editor','user']},
});

let previousTokens = [];

users.pre('save', function(next) {
  bcrypt.hash(this.password, 10)
    .then(hashedPassword => {
      this.password = hashedPassword;
      next();
    })
    .catch(console.error);
});

users.statics.createFromOauth = function(email) {

  if(! email) { return Promise.reject('Validation Error'); }

  return this.findOne( {email} )
    .then(user => {
      if( !user ) { throw new Error('User Not Found'); }
      console.log('Welcome Back', user.username);
      return user;
    })
    .catch( error => {
      console.log('Creating new user');
      let username = email;
      let password = 'none';
      return this.create({username, password, email});
    });

};

users.statics.authenticateBasic = function(auth) {
  let query = {username:auth.username};
  return this.findOne(query)
    .then( user => user && user.comparePassword(auth.password) )
    .catch(error => {throw error;});
};

users.statics.authenticateToken = function(token) {
  if (process.env.REMEMBER === 'yes'){
    const decryptedToken = jwt.verify(token, process.env.SECRET || 'secret');
    const query = {_id:decryptedToken.id};
    return this.findOne(query);
  } else {
    if(previousTokens.includes(token)){
      throw new Error('Invalid Token.');
    } else {
      previousTokens.push(token);
      const decryptedToken = jwt.verify(token, process.env.SECRET || 'secret');
      const query = {_id:decryptedToken.id};
      return this.findOne(query);
    }
  }
};

users.methods.comparePassword = function(password) {
  return bcrypt.compare( password, this.password )
    .then( valid => valid ? this : null);
};

// Original Token
users.methods.generateToken = function() {
  let token = {
    id: this._id,
    role: this.role,
  };
  return jwt.sign(token, process.env.SECRET || 'secret');
};

// Time Sensitive Token
users.methods.generateTimedToken = function() {
  let token = {
    id: this._id,
    role: this.role,
  };
  return jwt.sign(token, process.env.SECRET || 'secret', {expiresIn: 10});
};

// Auth Key Token
users.methods.generateAuthKey = function() {
  return this.generateToken();
};

module.exports = mongoose.model('users', users);
