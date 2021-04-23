const mongoose = require("mongoose");
const {ChallengeSchema} = require("./challenge");
const Schema = mongoose.Schema;

const FriendsSchema = new Schema({
  userID1: {
    type: String,
    required: true
  },
  userID2: {
    type: String,
    required: true
  },
  battleHistory: [
    ChallengeSchema,
  ],
  battleWon:{
    type: Number,
    default: 0,
  },
  battleLost:{
    type: Number,
    default: 0,
  },
  battleDraw:{
    type: Number,
    default: 0,
  },
});

module.exports = Friends = mongoose.model("friends", FriendsSchema);
