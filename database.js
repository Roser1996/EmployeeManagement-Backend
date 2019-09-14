const mongoose = require('mongoose');
mongoose.Promise = global.Promise;
mongoose.connect('mongodb+srv://Roser:1sSWOw1pZbq4jrA4@userlist-slulr.mongodb.net/Employee?retryWrites=true', 
	{ useNewUrlParser: true }, (err) => {
		if (err) {
			console.log("Error");
		}
	})
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));

db.once('open', () => console.log('Mongodb connected.'));

const Schema = mongoose.Schema;
const employee = new Schema({
	avatarUrl: String,
	name: String,
	title: String,
	sex: String,
	startDate: Date,
	officePhone: String,
	cellPhone: String,
	sms: String, 
	email: String,
	manager: Schema.Types.ObjectId,
	directReports: [Schema.Types.ObjectId]
});
const Employees = mongoose.model('employees', employee, 'list');

module.exports = {
	Employees: Employees
}