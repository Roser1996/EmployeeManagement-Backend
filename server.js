const express = require('express');
const multer = require('multer');
const bodyParser = require('body-parser');
const db = require('./database.js');
const fs = require('fs');

const app = express();
const PORT = 4000;
const PAGESIZE = 10;
const storage = multer.diskStorage({
	destination: './avatar',
	filename(req, file, cb) {
		cb(null, `${new Date().getTime()}-${file.originalname}`);
	},
});

const upload = multer({ storage });


app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());
app.use((req, res, next)=>{
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Resource-With, Content-Type, Accept");
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  console.log("requst url = " + req.url);
	next();
});

/*Get Employees with queries*/
app.get('/api/get', (req, res) => {
	const { pageStart, employeeNum, search, sortOrder, sortField } = req.query;
	console.log("pageStart: ", pageStart);
	console.log("employeeNum: ", employeeNum);
	console.log("search: ", search);
	console.log("sortOrder: ", sortOrder);
	console.log("sortField: ", sortField);
	if (sortField && sortOrder) {
		db.Employees
		.find({ 'name': {'$regex': `${search}`, '$options': 'i'} })
		.limit(parseInt(employeeNum))
		.skip(parseInt(pageStart))
		.sort({ [sortField]: `${sortOrder}` })
		.exec((err, employees) => {
			if (err) {
				console.log(err);
				res.status(500).json(err);
			}
			else {
				let result = {};
				result.employees = employees;
				result.employeeMap = {};
				addManagerNameToList(result, 0, res);
			}
		});
	}
	else {
		db.Employees
		.find({ 'name': {'$regex': `${search}`, '$options': 'i'} })
		.limit(parseInt(employeeNum))
		.skip(parseInt(pageStart))
		.exec((err, employees) => {
			if (err) {
				console.log(err);
				res.status(500).json(err);
			}
			else {
				let result = {};
				result.employees = employees;
				result.employeeMap = {};
				addManagerNameToList(result, 0, res);
			}
		})
	}
})

/*Get all potential managers for adding or editting a employee*/
app.get('/api/get/id', (req, res) => {
	const { _id } = req.query
	// when we add a new employee
	if (_id === '') {
		db.Employees
			.find()
			.select('name')
			.exec((err, employeeIds) => {
				if (err) {
					console.log(err);
					res.status(500).json(err);
				}
				else {
					res.status(200).json(employeeIds);
				}
			});
	}
	// when we edit a existed employee
	else {
		db.Employees
			.findOne({ '_id': _id })
			.select('name directReports')
			.exec((err, employee) => {
				if (err) {
					console.log(err);
					res.status(500).json(err);
				}
				else {
					let unValid = [{ '_id': employee._id, 'name': employee.name }];
					let traArray = employee.directReports;
					findValidManager(unValid, traArray, res);
				}
			});
	}
})

/*Get the manager of the employee based on the _id*/
app.get('/api/get/manager', (req, res) => {
	const { _id } = req.query;
	db.Employees
		.findOne({ '_id': _id })
		.exec((err, employee) => {
			if (err) {
				console.log(err);
				res.status(500).json(err);
			}
			else {
				res.status(200).json(employee);
			}
		});
})

/*Get the direct reports list of the employee*/
app.post('/api/get/direct_report', (req, res) => {
	const { directReports } = req.body;
	console.log(directReports);
	getEmployeeDirectReportsList(directReports, [], 0, res);
})

/* Add a New Employee */
app.post('/api/add', (req, res) => {
	const {
		avatarUrl,
		name, 
		title,
		sex,
		startDate,
		officePhone,
		cellPhone,
		sms,
		email,
		manager,
	} = req.body;
	db.Employees
		.create({
			avatarUrl: avatarUrl,
			name: name,
			title: title,
			sex: sex,
			startDate: startDate,
			officePhone: officePhone,
			cellPhone: cellPhone,
			sms: sms,
			email: email,
			manager: manager,
			directReports: []
		})
		.then((newEmployee) => {
			if (newEmployee) {
				if (manager) {
					db.Employees
						.findByIdAndUpdate(manager, 
							{ '$push': {'directReports': newEmployee._id } }, 
							{ 'new': true, 'upsert': true },
							(err, result) => {
								if (err) {
									console.log(err);
									res.status(500).json(err);
								}
								else {
									res.status(200).json(result);
								}
							});
				}
				else {
					res.status(200).json(newEmployee);
				}
			}
			else {
				res.status(500).json("Fail to add the new employee");
			}
		});
})

/* Edit a existed Employee*/
app.post('/api/edit', (req, res) => {
	const {
		avatarUrl,
		_id,
		name, 
		title,
		sex,
		startDate,
		officePhone,
		cellPhone,
		sms,
		email,
		manager,
	} = req.body;
	db.Employees
		.findOne({ '_id': _id })
		.exec((err, employee) => {
			if (err) {
				console.log(err);
				res.status(500).json(err);
			}
			else {
				let newAvatarUrl = avatarUrl ? avatarUrl : employee.avatarUrl;
				console.log('newAvatarUrl: ', newAvatarUrl);
				// situation one: original none manager, after none manager
				if (!employee.manager && !manager) {
					db.Employees
						.findByIdAndUpdate(_id,
							{
								'$set': 
								{ 
									'avatarUrl': newAvatarUrl, 
									'name': name,
									'title': title,
									'sex': sex,
									'startDate': startDate,
									'officePhone': officePhone,
									'cellPhone': cellPhone,
									'sms': sms,
									'email': email,
								}
							}, 
							{ 'new': true },
							(err, result) => {
								if (err) {
									console.log(err);
									res.status(500).json(err);
								}
								else {
									console.log(result);
									res.status(200).json(result);
								}
							});
				}
				// situation two: original none manager, after has manager
				else if (!employee.manager && manager) {
					db.Employees
						.findByIdAndUpdate(_id,
						{
							'$set': 
								{ 
									'avatarUrl': newAvatarUrl, 
									'name': name,
									'title': title,
									'sex': sex,
									'startDate': startDate,
									'officePhone': officePhone,
									'cellPhone': cellPhone,
									'sms': sms,
									'email': email,
									'manager': manager,
								}
						}, 
						{ 'new': true},
						(err, newEmployee) => {
							if (err) {
								console.log(err);
								res.status(500).json(err);
							}
							else {
								db.Employees
									.findByIdAndUpdate(newEmployee.manager,
									{
										'$push': { 'directReports': newEmployee._id }
									},
									{ 'new': true },
									(err, result) => {
										if (err) {
											console.log(err);
											res.status(500).json(err);
										}
										else {
											res.status(200).json(result);
										}
									});
							}
						});
				}
				// situation three: original has manager, after no manager
				else if (employee.manager && !manager) {
					db.Employees
						.findByIdAndUpdate(_id, 
						{
							'$set': 
								{ 
									'avatarUrl': newAvatarUrl, 
									'name': name,
									'title': title,
									'sex': sex,
									'startDate': startDate,
									'officePhone': officePhone,
									'cellPhone': cellPhone,
									'sms': sms,
									'email': email,
									'manager': manager
								}
						},
						{ 'new': true }, 
						(err, newEmployee) => {
							if (err) {
								console.log(err);
								res.status(500).json(err);
							}
							else {
								db.Employees
									.findByIdAndUpdate(employee.manager, 
									{
										'$pull': { directReports: newEmployee._id }
									},
									{ 'new': true }, 
									(err, result) => {
										if (err) {
											console.log(err);
											res.status(500).json(err);
										}
										else {
											res.status(200).json(result);
										}
									});
							}
						});
				}
				// situation four: original has manager, after has manager
				else {
					db.Employees
						.findByIdAndUpdate(employee.manager,
						{
							'$pull': { 'directReports': _id }
						}, 
						{ 'new': true },
						(err, newManager) => {
							db.Employees
								.findByIdAndUpdate(_id,
								{
									'$set': 
									{ 
										'avatarUrl': newAvatarUrl, 
										'name': name,
										'title': title,
										'sex': sex,
										'startDate': startDate,
										'officePhone': officePhone,
										'cellPhone': cellPhone,
										'sms': sms,
										'email': email,
										'manager': manager
									}
								}, 
								{ 'new': true }, 
								(err, newEmployee) => {
									if (err) {
										console.log(err);
										res.status(500).json(err);
									}
									else {
										db.Employees
											.findByIdAndUpdate(manager,
											{
												'$push': { 'directReports': newEmployee._id }
											},
											{ 'new': true },
											(err, result) => {
												if (err) {
													console.log(err);
													res.status(500).json(err);
												}
												else {
													res.status(200).json(result);
												}
											});
									}
								});
						});
				}
			}
		});
})

/*Delete a existed employee*/
app.delete('/api/delete/', (req, res) => {
	const { _id } = req.query;
	console.log(_id);
	db.Employees
		.findOne({ '_id': _id })
		.exec((err, employee) => {
			console.log("Find success");
			const avatarName = employee.avatarUrl.split('=')[1];
			fs.unlink(`./avatar/${avatarName}`, (err) => {
				if (err) {
					res.status(500).json('Fail to delete employee');
				}
				else {
					// situation one: employee no manager no directReports
					if (!employee.manager && !employee.directReports.length) {
						db.Employees
							.deleteOne()
							.where('_id').equals(_id)
							.exec((err, result) => {
								if (err) {
									console.log(err);
									res.status(500).json(err);
								}
								else {
									res.status(200).json(result);
								}
							});
					}		
					// situation two: employee has manager no directReports
					else if (employee.manager && !employee.directReports.length) {
						db.Employees
							.findByIdAndUpdate(employee.manager,
							{
								'$pull': { 'directReports': employee._id }
							},
							{ 'new': true}, 
							(err, newManager) => {
								if (err) {
									console.log(err);
									res.status(500).json(err);
								}
								else {
									// delete the employee
									db.Employees
										.deleteOne()
										.where('_id').equals(_id)
										.exec((err, result) => {
											if (err) {
												console.log(err);
												res.status(500).json(err);
											}
											else {
												res.status(200).json(result);
											}
										});
								}
							});
					}
					// situation three: employee no manager has directReports
					else if (!employee.manager && employee.directReports.length) {
						connectReportsToNewManager(employee.directReports, null, _id, res);
					}
					// situation four: employee has manager has directReports
					else {
						db.Employees
							.findByIdAndUpdate(employee.manager,
							{
								'$pull': { 'directReports': employee._id }
							},
							{ 'new': true}, 
							(err, result) => {
								if (err) {
									console.log(err);
									res.status(500).json(err);
								}
								else {
									connectReportsToNewManager(employee.directReports, employee.manager, _id, res);
								}
							});
					}
				}
			})
		});
})

app.get('/avatar', (req, res) => {
	const { imageName } = req.query;
	fs.readFile(`./avatar/${imageName}`, 'binary', (err, file) => {
		if (err) {
			console.log(err);
			res.json("error");
		}
		else {
			res.writeHead(200, {'Content-Type': 'image/png'});
			res.write(file, 'binary');
			res.end();
		} 
	});
});

app.post('/api/image/upload', upload.single('file'), (req, res) => {
	let files = req.file;
	const { preImage } = req.query;
	console.log(preImage);
	let result = {};
	if (!files) {
		result.code = 1;
		result.err = 'Fail to upload';
		res.status(500).json(result);
		return;
	}
	else {
		// delete the original user image file
		if (preImage) {
			fs.unlink(`./avatar/${preImage}`, (err) => {
				if (err) {
					result.code = 2;
					result.err = 'Fail to delete original file';
					res.status(500).json(result);
				}
				else {
					result.code = 0;
					result.url = `http://localhost:${PORT}/avatar/?imageName=` + files.filename;
					result.message = 'Success';
					res.status(200).json(result);
				}
			});
		}
		else {
			result.code = 0;
			result.url = `http://localhost:${PORT}/avatar/?imageName=` + files.filename;
			result.message = 'Success';
			res.status(200).json(result);
		}
	}
});

const addManagerNameToList = (result, count, res) => {
	if (count < result.employees.length) {
		if (!result.employees[count].manager) {
			addManagerNameToList(result, count + 1, res);
		}
		else {
			db.Employees
			.findOne({ '_id': result.employees[count].manager })
			.exec((err, curEmployee) => {
				if (err) {
					console.log(err);
					res.status(500).json(err);
				}
				else {
					result.employeeMap[curEmployee._id] = curEmployee.name;
					addManagerNameToList(result, count + 1, res);
				}
			});
		}
	}
	else {
		res.status(200).json(result);
	}
}

const getEmployeeDirectReportsList = (directReports, resultArray, count, res) => {
	if (count < directReports.length) {
		db.Employees
			.findOne({ '_id': directReports[count] })
			.exec((err, curEmployee) => {
				if (err) {
					console.log(err);
					res.status(500).json(err);
				}
				else {
					getEmployeeDirectReportsList(directReports, [...resultArray, curEmployee], count + 1, res);
				}
			})
	}
	else {
		res.status(200).json(resultArray);
	}
}

const findValidManager = (unValid, traArray, res) => {
	if (traArray.length > 0) {
		let currentId = traArray.shift();
		db.Employees
			.findOne({ '_id': currentId })
			.select('name directReports')
			.exec((err, result) => {
				if (err) {
					console.log(err);
					return;
				}
				else {
					unValid.push({ '_id': result._id, 'name': result.name });
					traArray = [...traArray, ...result.directReports];
					findValidManager(unValid, traArray, res);
				}
			});
	}
	else {
		db.Employees
			.find()
			.select('name')
			.exec((err, employees) => {
				let validEmployee = employees.filter(employee => {
					let isValid = true;
					for (let i = 0; i < unValid.length; i++) {
						if (JSON.stringify(unValid[i]) === JSON.stringify(employee)) {
							console.log("hello");
							isValid = false;
							break;
						}
					}
					return isValid;
				});
				console.log(validEmployee);
				res.status(200).json(validEmployee);
			});
	}
}

const connectReportsToNewManager = (reportsArray, newManager, deleteEmployeeId, res) => {
	if (reportsArray.length) {
		let employeeId = reportsArray.shift();
		console.log('newManager: ', newManager);
		console.log('employeeId: ', employeeId);
		db.Employees
			.findByIdAndUpdate(employeeId, 
			{
				'$set': { 'manager': newManager }
			},
			{ 'new': true }, 
			(err, result) => {
				if (err) {
					console.log(err);
					res.status(500).json(err);
				}
				else {
					if (newManager) {
						db.Employees
							.findByIdAndUpdate(newManager,
							{
								'$push': { 'directReports': employeeId }
							},
							{ 'new': true },
							(err, curResult) => {
								if (err) {
									console.log(err);
									res.status(500).json(err);
								}
								else {
									connectReportsToNewManager(reportsArray, newManager, deleteEmployeeId, res);
								}
							});
					}
					else {
						connectReportsToNewManager(reportsArray, newManager, deleteEmployeeId, res);
					}
				}
			})
	}
	else {
		db.Employees
			.deleteOne()
			.where('_id').equals(deleteEmployeeId)
			.exec((err, result) => {
				if (err) {
					console.log(err);
					res.status(500).json(err);
				}
				else {
					res.status(200).json(result);
				}
			});
	}
}

app.listen(PORT, () => {
	console.log(`Server is listening on port ${PORT}`);
})