const express = require("express");
const app = express();
const path = require("path");
const cors = require('cors')

const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const {Chat} = require('./models/Chat');

const server = require('http').createServer(app);
const io = require('socket.io')(server);

const config = require("./config/key");

const mongoose = require("mongoose");
const mongoURI = config.mongoURI ? config.mongoURI.replace(/&?w=majority/i, '') : '';
console.log("URI provided:", mongoURI ? "Yes" : "No");

const connect = mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB Connected...'))
  .catch(err => console.log(err));

app.use(cors())

//to not get any deprecation warning or error
//support parsing of application/x-www-form-urlencoded post data
app.use(bodyParser.urlencoded({ extended: true }));
//to get json data
// support parsing of application/json type post data
app.use(bodyParser.json());
app.use(cookieParser());

app.use('/api/users', require('./routes/users'));
app.set('io', io);
app.use('/api/chat', require('./routes/chat'));

//socket io implication
io.on("connection", socket => {

  socket.on("joinRoom", ({ roomId }) => {
    socket.join(roomId);
  });

  socket.on("leaveRoom", ({ roomId }) => {
    socket.leave(roomId);
  });

  // Each user joins a personal room keyed by their userId for targeted events
  socket.on("joinUserRoom", ({ userId }) => {
    if (userId) socket.join(`user_${userId}`);
  });

  socket.on("Input Chat Message", msg => {

    connect.then(db => {
      try {
          const isPrivateGroup = msg.groupId && msg.groupId !== 'general';

          const proceed = (allowed, originalHiddenBy = []) => {
            if (!allowed) {
              socket.emit("notGroupMember", { groupId: msg.groupId });
              return;
            }

            let chat = new Chat({ 
                message: msg.chatMessage, 
                sender: msg.userId, 
                type: msg.type,
                group: isPrivateGroup ? msg.groupId : null
            });

            chat.save((err, doc) => {
              if(err) {
                  console.error("Error saving chat:", err);
                  return;
              }

              Chat.find({ "_id": doc._id })
              .populate("sender")
              .exec((err, doc)=>{
                  const targetRoom = isPrivateGroup ? msg.groupId : 'general';
                  io.to(targetRoom).emit("Output Chat Message", doc);

                  // Also emit directly to the personal socket rooms of restored users
                  if (originalHiddenBy && originalHiddenBy.length > 0) {
                      originalHiddenBy.forEach(memberId => {
                          io.to(`user_${memberId}`).emit("Output Chat Message", doc);
                      });
                  }
              })
            })
          };

          if (isPrivateGroup) {
            const { Group } = require('./models/Group');
            Group.findById(msg.groupId, (err, group) => {
              if (err || !group) return proceed(false);
              const isMember = group.members.some(m => m.toString() === msg.userId);

              if (isMember) {
                // If this group was hidden for any member, restore it for them
                if (group.hiddenBy && group.hiddenBy.length > 0) {
                    const originalHiddenBy = [...group.hiddenBy];
                    group.hiddenBy = [];
                    group.save((saveErr, savedGroup) => {
                        if (!saveErr && io) {
                            originalHiddenBy.forEach(memberId => {
                                io.to(`user_${memberId}`).emit("chatRestored", { group: savedGroup });
                            });
                        }
                    });
                    proceed(isMember, originalHiddenBy);
                } else {
                    proceed(isMember, []);
                }
              } else {
                proceed(isMember, []);
              }
            });
          } else {
            proceed(true, []);
          }

      } catch (error) {
        console.error(error);
      }
    })
   })

})


//use this to show the image you have in node js server to client (react js)
//https://stackoverflow.com/questions/48914987/send-image-path-from-node-js-express-server-to-react-client
app.use('/uploads', express.static('uploads'));

// Serve static assets if in production
if (process.env.NODE_ENV === "production") {

  // Set static folder   
  // All the javascript and css files will be read and served from this folder
  app.use(express.static("client/build"));

  // index.html for all page routes    html or routing and naviagtion
  app.get("*", (req, res) => {
    res.sendFile(path.resolve(__dirname, "../client", "build", "index.html"));
  });
}

const port = process.env.PORT || 5000;

server.listen(port, "0.0.0.0", () => {
  console.log(`Server Listening on port ${port}`);
});