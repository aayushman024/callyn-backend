import mongoose from 'mongoose';
const { Schema } = mongoose;

const mintDbSchema = new Schema({
  _id: Schema.Types.ObjectId,
  APPCODE: String,
  AUM: Number,
  "Birthday Wishes": Boolean,
  "CREATED AT": String, 
  "DATE OF BIRTH": String,
  DATE_MOVED_ON_DATE: String, 
  EMAIL: String,
  "FAMILY HEAD": String,
  "First Imported Date": String, 
  "IWELL CODE": Number,
  MOBILE: String,
  NAME: String,
  PAN: String,
  "RELATIONSHIP  MANAGER": String,
  "SERVICE  R M": Number, 
  "SOURCE": Number, 
  "SUB  BROKER": String, 
  USERNAME: String,
  "Upserted Timestamp": String,
  blog_subscription: Boolean,
  ipo_status: Boolean,
  serial_number: Number,
  "SECONDARY RELATIONSHIP MANAGER": String
}, {
  collection: 'MintDb',
  timestamps: false
});

const MintDbModel = mongoose.model('MintDb', mintDbSchema);

export default MintDbModel;