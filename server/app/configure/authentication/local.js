'use strict';
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var db = require('../../../db');
var orders = db.model('order');

module.exports = function(app, db) {

    var User = db.model('user');

    // Define strategy function that will be passed to passport.use.
    var strategyFn = function(email, password, done) {

        // find the user in the database
        User.find({
                where: {
                    email: email
                }
            })
            .then(function(result) {

                // if the user already exists, LOGIN:
                if (result) {
                    let user = result;
                    // user.correctPassword is a method from the User schema.
                    if (!user || !user.correctPassword(password)) {
                        done(null, false);
                    } else {
                        // Properly authenticated.
                        done(null, user);
                    }

                    // if the user DOESN'T exist (new user SIGNUP), create one:
                } else {
                    return User.create({
                            email: email,
                            password: password
                        })
                        .then(function(user) {
                            // user.correctPassword is a method from the User schema.
                            if (!user || !user.correctPassword(password)) {
                                done(null, false);
                            } else {
                                // Properly authenticated.
                                done(null, user);
                            }
                        })

                }
            })
    };


    // Define how your authentication works (messages for invalid username or password, etc).
    passport.use(new LocalStrategy({
        usernameField: 'email',
        passwordField: 'password'
    }, strategyFn));




    // A POST /login route is created to handle login.
    // ALSO HANDLES SIGN UP
    app.post('/login', function(req, res, next) {
        var userId = req.user ? req.user.id : req.session.userId;
        var order;

        var authCb = function(err, user) {
            if (err) return next(err);

            if (!user) {
                var error = new Error("User doesn't exist. Please sign up.");
                error.status = 401;
                return next(error);
            }

            // req.logIn will establish our session.
            req.logIn(user, function(loginErr) {
                if (loginErr) return next(loginErr);
            
                // We respond with a response object that has user with _id and email.
                if(order){

                    //order.dataValues.userId = req.user.id; 
                    order.update({
                        userId: req.user.id
                        })
                    .then(function(updatedOrder){
                        return orders.findAll({
                            where:{
                                userId: req.user.id,
                                status: "Created"
                            },
                            order: [
                                ['createdAt', 'ASC']
                            ]
                        })
                        .then(function(returnedOrder){
                            if (returnedOrder.length > 1) return returnedOrder[0].destroy();
                        })
                        .then(function(){
                           req.session.userId = null;
                            res.status(200).send({
                                user: user.sanitize()
                            }); 
                        })
                    })
                }
                else{
                    req.session.userId = null;
                    res.status(200).send({
                        user: user.sanitize()
                    });
                }
                
            });
        };
        return orders.find({
            where:{ 
                userId: userId, 
                status: 'Created'
            }
        })
        .then(function(foundOrder){ 
            order = foundOrder;
            passport.authenticate('local', authCb)(req, res, next);    
            return order
        })
        
    });


    app.put('/login', function(req, res, next) {

        User.find({
                where: {
                    email: req.user.email
                }
            })
            .then(function(user) {
                if (!user) throw new Error('user not found')
                // Need to update BOTH password and salt because the updatePassword changes both of these properties.
                return user.update({ password: user.updatePassword(req.body.newpassword), salt: user.salt });
            })
            .then(function(me) {
                res.send({ message: "You just updated your password like a ROCK STAR!" });
            })
            .catch(next);

    });

}; // closes module.exports
