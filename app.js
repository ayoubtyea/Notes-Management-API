require('dotenv').config(); // Load environment variables

const express = require('express');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');

const app = express();

// Initialize data (in-memory for this example)
const notes = [{
    noteId: uuidv4(),
    noteContent: "Sample Note",
    tags: ['default'],
    sharedWith: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    deleted: false  // Flag for soft delete
}];

// Email Transporter using Nodemailer
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Check if essential .env variables are set
if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error("Error: Missing EMAIL_USER or EMAIL_PASS in .env file");
    process.exit(1);
}

// Middlewares
app.set('view engine', 'ejs');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Home route to display all notes
app.get("/", (req, res) => {
    const page = parseInt(req.query.page) || 1;  // Default to page 1
    const limit = parseInt(req.query.limit) || 10;  // Default to 10 notes per page
    const offset = (page - 1) * limit;

    const paginatedNotes = notes.filter(note => !note.deleted).slice(offset, offset + limit);
    res.render("home", { data: paginatedNotes, searchTerm: '', currentPage: page });
});

// Route to handle searching notes by title or content
app.get("/search", (req, res) => {
    const searchTerm = req.query.q || '';
    const filteredNotes = notes.filter(note =>
        note.noteContent.toLowerCase().includes(searchTerm.toLowerCase()) ||
        note.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())) && !note.deleted
    );
    res.render("home", { data: filteredNotes, searchTerm });
});

// Route to filter notes by tags, creation date, or last updated date
app.get("/filter", (req, res) => {
    const { tag, startDate, endDate } = req.query;

    const filteredNotes = notes.filter(note => {
        if (note.deleted) return false;

        let matchesTag = true;
        let matchesDateRange = true;

        if (tag && !note.tags.includes(tag)) {
            matchesTag = false;
        }

        if (startDate || endDate) {
            const noteDate = new Date(note.updatedAt);
            const start = startDate ? new Date(startDate) : null;
            const end = endDate ? new Date(endDate) : null;

            if (start && noteDate < start) matchesDateRange = false;
            if (end && noteDate > end) matchesDateRange = false;
        }

        return matchesTag && matchesDateRange;
    });

    res.render("home", { data: filteredNotes, searchTerm: '' });
});

// Route to fetch a specific note by its ID
app.get("/notes/:id", (req, res) => {
    const note = notes.find(n => n.noteId === req.params.id && !n.deleted);
    if (note) {
        res.json(note);
    } else {
        res.status(404).send("Note not found");
    }
});

// Route to add a new note
app.post("/", (req, res) => {
    const { noteContent, tags = '' } = req.body;
    if (!noteContent.trim()) {
        return res.redirect('/');
    }

    const newNote = {
        noteId: uuidv4(),
        noteContent,
        tags: tags.split(',').map(tag => tag.trim()),
        sharedWith: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        deleted: false
    };

    notes.push(newNote);
    res.redirect('/');
});

// Route to update an existing note
app.post('/update', (req, res) => {
    const { noteId, noteContent, tags } = req.body;
    const note = notes.find(n => n.noteId === noteId && !n.deleted);
    if (note) {
        note.noteContent = noteContent.trim() || note.noteContent;
        note.tags = tags ? tags.split(',').map(tag => tag.trim()) : note.tags;
        note.updatedAt = new Date(); // Update the last modified time
    }
    res.redirect('/');
});

// Route to soft delete a note (mark as deleted)
app.post('/delete', (req, res) => {
    const { noteId } = req.body;
    const note = notes.find(n => n.noteId === noteId);
    if (note) {
        note.deleted = true;  // Soft delete the note
    }
    res.redirect('/');
});

// Route to handle note sharing (via UserID or Email)
app.post("/share", (req, res) => {
    const { noteId, email, userId } = req.body;
    const note = notes.find(n => n.noteId === noteId);

    if (!note) {
        return res.status(404).send("Note not found");
    }

    // Share with User ID (Example: Could be a database of users)
    if (userId) {
        note.sharedWith.push(userId);
    }

    // Share via Email
    if (email) {
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'A Note Has Been Shared With You',
            text: `Hello,\n\nA note has been shared with you:\n\n${note.noteContent}\n\nTags: ${note.tags.join(', ') || 'None'}\n\nBest regards,\nNotes App`
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Error sending email:', error);
                return res.status(500).send("Failed to send email");
            }
            console.log('Email sent: ' + info.response);
            res.redirect('/');
        });
    } else {
        res.redirect('/');
    }
});

// Start server
app.listen(3000, () => {
    console.log("App is running on port 3000");
});
