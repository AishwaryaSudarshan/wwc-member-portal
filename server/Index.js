const express = require('express');
const multer = require('multer');
const mongoose = require('mongoose');
const User = require('./Models/User');  // Adjust the path as needed
const Event = require('./Models/RegularEvent'); // Note the './' indicating a relative path
const Application = require('./Models/SpecialEvents'); 
const path = require('path');
const fs = require('fs');

require('./db/connection');

const app = express();
app.use(express.json());
app.use(require('cors')());

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './files');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });

app.post('/', upload.single('resume'), async (req, res) => {
  try {
    const { name, email, password, pronouns,major,year,JPMorgan } = req.body;

    console.log('JPMorgan value received:', JPMorgan);

    const newUser = new User({
      name,
      email,
      password,
      pronouns,
      major,
      year,
      JPMorgan: req.body.JPMorgan === 'true', // Converts string to boolean 
      resume: {
        path: req.file.path,          // Store the file path
        contentType: req.file.mimetype // Store the MIME type
      }
    });

    await newUser.save();
    res.status(201).json(newUser);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error saving user or resume' });
  }
});

// Serve static files from the 'files' directory
app.use('/files', express.static(path.join(__dirname, 'files')));

app.get('/user/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    console.log(`Fetching user with ID: ${userId}`); // Log the ID for debugging
    const user = await User.findById(userId);
    if (!user) {
      console.error(`User with ID ${userId} not found`);
      return res.status(404).send('User not found');
    }
    // Return user information without the password
    const { name, email, pronouns, major, year, JPMorgan, resume } = user;
    res.json({ name, email, pronouns, major, year, JPMorgan, resume });
  } catch (error) {
    console.error(`Error fetching user details for user ID: ${req.params.id}`, error);
    res.status(500).send('Server error');
  }
});



app.get('/user/:id/resume', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (user && user.resume) {
      const filePath = path.join(__dirname, user.resume.path); // Build the file path

      // Check if the file exists
      if (fs.existsSync(filePath)) {
        res.sendFile(filePath); // Send the file to the client
      } else {
        console.error(`File not found: ${filePath}`);
        res.status(404).send('File not found');
      }
    } else {
      console.error(`User or resume not found for user ID: ${req.params.id}`);
      res.status(404).send('User or resume not found');
    }
  } catch (error) {
    console.error(`Server error while fetching resume for user ID: ${req.params.id}`, error);
    res.status(500).send('Server error');
  }
});

app.get('/user/:id/resume', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (user && user.resume) {
      const filePath = path.join(__dirname, user.resume.path); // Build the file path

      // Check if the file exists
      if (fs.existsSync(filePath)) {
        res.sendFile(filePath); // Send the file to the client
      } else {
        res.status(404).send('File not found');
      }
    } else {
      res.status(404).send('User or resume not found');
    }
  } catch (error) {
    res.status(500).send('Server error');
  }
});

//events table 
// RSVP endpoint
app.post('/regularevents/:eventId/rsvp', async (req, res) => {
  const eventId = req.params.eventId;
  const { userId, isChecked } = req.body; // Now receiving isChecked from frontend

  try {
      // Find the event by ID
      const event = await Event.findById(eventId);

      if (!event) {
          return res.status(404).json({ message: 'Event not found' });
      }

      if (isChecked) {
          // Add user to the attendees list if they checked the box
          if (!event.attendees.includes(userId)) {
              event.attendees.push(userId);
          } else {
              return res.status(400).json({ message: 'User has already RSVPed' });
          }
      } else {
          // Remove user from the attendees list if they unchecked the box
          event.attendees = event.attendees.filter(id => id.toString() !== userId);
      }

      await event.save(); // Save the updated event

      res.status(200).json({ message: 'RSVP updated successfully', event });
  } catch (error) {
      console.error('Error RSVPing for event:', error);
      res.status(500).json({ error: 'Error RSVPing for event' });
  }
});

//specialEvents (applications table)
app.post('/eventapplications/', async (req, res) => {
  const { userId, eventId, name, email, year, reason } = req.body;

  console.log('Incoming request data:', req.body);

  // Validate incoming data
  if (!userId || !eventId || !name || !email || !year || !reason) {
      return res.status(400).json({ message: 'All fields are required' });
  }

  try {
      const newApplication = new Application({
          userId,
          eventId,
          name,
          email,
          year,
          reason,
      });

      const savedApplication = await newApplication.save();
      res.status(201).json({ message: 'Application submitted successfully', application: savedApplication });
  } catch (error) {
      console.error('Error saving application:', error);
      res.status(500).json({ message: 'Error submitting application', error: error.message });
  }
});

//points 
app.post('/users', async (req, res) => {
  const { email, eventID } = req.body; 
  try {
    // Check if the user exists
    let user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found. Please register first.' });
    }

    user.points += 1;
    await user.save();

    let event = await RegularEvent.findOne({ eventID });
    const userID = user._id;

    if (!event) {
      return res.status(404).json({ message: 'Event not found.' });
    }

    if (!event.attendees.includes(userID.toString())) {
      event.attendees.push(userID.toString());
      await event.save();
    }

    res.json({ message: `Check-in successful! Your points are now ${user.points}.`, userID });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error during check-in.' });
  }
});

app.listen(4000, () => {
  console.log('Server is running on port 4000');
});

