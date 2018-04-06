var TwitterPackage = require("twitter");
var secret = require("./secret");
var fs = require('fs');

var Twitter = new TwitterPackage(secret);

var publicFilter = encodeURIComponent("@TISilent700");

var newline = "\r\n";

var state = {
    active: true,
    messages: 0,
    tweets: 0
}

var tty = process.argv[2];
var ttyStream = fs.createWriteStream(tty);

function getTweetParam(tweet, action) {
    var paramIndex = tweet.text.substring(tweet.text.indexOf(action));

    if (paramIndex != -1) {
        return tweet.text.substring(tweet.text.indexOf(action) + action.length);
    }
    else {
        return "";
    }

}

var publicActions = [
    {
        action: "#print",
        handler: function(tweet) {
            ttyStream.write(getTweetParam(tweet, this.action) + newline);
            state.tweets++;
            return "";
        }
    },
    {
        action: "#reply",
        handler: function(tweet) {
            state.tweets++;
            return "Ok " + tweet.user.screen_name + ": " + getTweetParam(tweet, this.action);
        }
    },
    {
        action: "#stats",
        handler: function(tweet) {
            var statsString = "";
            for (stat in state) {
                if (state.hasOwnProperty(stat)) {
                    if (statsString.length) {
                        statsString += " ";
                    }
                    statsString += stat + ": " + state[stat];
                }
            }
            ;
            return statsString;
        }
    }
];

var messageActions = [
    {
        action: "start",
        handler: function(tweet) {
            state.active = true;
            state.messages++;
            return "Started";
        }
    },
    {
        action: "stop",
        handler: function(tweet) {
            state.active = false;
            state.messages++;
            return "Stopped";
        }
    },

]

// Con't call twitter until we have our ttyStream
ttyStream.once('open', function() {

    ttyStream.write("TTY OPEN" + newline);

    // Call the stream function and pass in "statuses/filter", our filter object, and our callback
    Twitter.stream("statuses/filter", {track: publicFilter}, function(stream) {

        console.log("Monitoring {track:" + publicFilter + "}");

        // ... when we get tweet data...
        stream.on("data", function(tweet) {

            if (state.active == true) {
                var decodedTweet = decodeURIComponent(tweet.text);

                // print out the text of the tweet that came in
                console.log("Recevied: '" + tweet.text + "' Decoded: '" + decodedTweet + "'");

                publicActions.forEach(function(element) {
                    if (decodedTweet.indexOf(element.action) != -1) {

                        var reply = element.handler(tweet);

                        if (reply.length) {
                            var statusObj = {status: reply};

                            //call the post function to tweet something
                            Twitter.post("statuses/update", statusObj, function(error, tweetReply, response) {

                                //if we get an error print it out
                                if (error) {
                                    console.log(error);
                                }

                                //print the text of the tweet we sent out
                                console.log(tweetReply.text);
                            });

                        }
                    }
                });
            }
        });

        // ... when we get an error...
        stream.on("error", function(error) {
            //print out the error
            console.log(error);
        });
    });

// Monitor user stream
    Twitter.stream("user", function(stream) {
        console.log("Monitoring 'user'");

        stream.on("direct_message", function(eventMsg) {
            var msg = decodeURIComponent(eventMsg.direct_message.text);
            var screenName = eventMsg.direct_message.sender.screen_name;
            var userId = eventMsg.direct_message.sender.id;

            console.log(screenName + " says: " + msg);

            messageActions.forEach(function(element) {
                if (msg.indexOf(element.action)) {

                    var reply = element.handler(eventMsg);

                    if (reply.length) {
                        // reply object
                        var replyTo = {
                            user_id: userId,
                            text: reply,
                            screen_name: screenName
                        };

                        // avoid replying to yourself when the recipient is you
                        if (screenName != eventMsg.direct_message.recipient_screen_name) {

                            //post reply
                            Twitter.post("direct_messages/new", replyTo, function(err, data, response) {
                                console.info(data);
                            });
                        }

                    }
                }
            });

            // ... when we get an error...
            stream.on("error", function(error) {
                //print out the error
                console.log(error);
            });
        });
    });
});
